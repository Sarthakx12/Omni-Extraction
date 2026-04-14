document.addEventListener('DOMContentLoaded', () => {
  const btnText = document.getElementById('extractBtnText');
  const extractBtn = document.getElementById('extractBtn');
  const loader = document.getElementById('loader');
  const resultsDiv = document.getElementById('results');
  const imageCountEl = document.getElementById('imageCount');
  const textCountEl = document.getElementById('textCount');
  const extractedTextEl = document.getElementById('extractedText');
  const extractedImagesEl = document.getElementById('extractedImages');
  
  // Tab Switching Logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.target).classList.add('active');
    });
  });

  // Global State
  let currentImages = [];
  let currentText = "";

  // Helper format
  const formatNumber = num => num.toLocaleString();

  // Primary Extract Action
  extractBtn.addEventListener('click', () => {
    // Show Loading State
    extractBtn.disabled = true;
    btnText.textContent = 'Extracting...';
    loader.classList.remove('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      // Check for restricted URLs immediately before sending a message
      if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:'))) {
          loader.classList.add('hidden');
          btnText.textContent = 'Cannot run on system pages';
          setTimeout(() => { btnText.textContent = 'Extract Content'; extractBtn.disabled = false; }, 3000);
          return;
      }

      chrome.tabs.sendMessage(activeTab.id, { action: "extractContent" }, (response) => {
        // Reset Loader
        loader.classList.add('hidden');
        extractBtn.disabled = false;
        
        if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
            // This error happens when the script isn't injected (e.g. extension just installed and page wasn't refreshed)
            if (chrome.runtime.lastError.message.includes("Receiving end does not exist")) {
                btnText.textContent = 'Pls refresh the page first!';
            } else {
                btnText.textContent = 'Failed. Try refreshing.';
            }
            setTimeout(() => btnText.textContent = 'Extract Content', 3000);
            return;
        }
        
        if (!response || !response.success) {
            btnText.textContent = 'Extraction Failed. Try again.';
            setTimeout(() => btnText.textContent = 'Extract Content', 3000);
            return;
        }

        btnText.textContent = 'Re-extract Content';
        
        const { text, images } = response;
        currentImages = images;
        currentText = text;

        // Statistics
        imageCountEl.textContent = formatNumber(images.length);
        textCountEl.textContent = formatNumber(text.length);
        
        // Populate Text Output
        extractedTextEl.value = text;
        
        // Populate Images Output
        extractedImagesEl.innerHTML = '';
        if (images.length === 0) {
            extractedImagesEl.innerHTML = '<div class="empty-state">No images found on this page.</div>';
            document.getElementById('downloadImagesBtn').disabled = true;
        } else {
            document.getElementById('downloadImagesBtn').disabled = false;
            
            // Document Fragment for performance on large pages
            const fragment = document.createDocumentFragment();
            // Cap visual render to 100 to prevent locking up popup on massive pages
            const displayLimit = Math.min(images.length, 100);
            
            for (let i = 0; i < displayLimit; i++) {
                const src = images[i];
                const item = document.createElement('div');
                item.className = 'img-item';
                
                const img = document.createElement('img');
                img.src = src;
                img.className = 'img-preview';
                img.loading = 'lazy';
                img.onerror = () => { img.src = ''; };

                const urlSpan = document.createElement('span');
                urlSpan.className = 'img-url';
                urlSpan.textContent = src;
                
                const link = document.createElement('a');
                link.href = src;
                link.className = 'img-link';
                link.textContent = 'Open';
                link.target = '_blank';

                item.appendChild(img);
                item.appendChild(urlSpan);
                item.appendChild(link);
                fragment.appendChild(item);
            }
            
            extractedImagesEl.appendChild(fragment);
            
            if (images.length > 100) {
                const more = document.createElement('div');
                more.className = 'empty-state';
                more.textContent = `+ ${formatNumber(images.length - 100)} more images not shown here. Download ZIP to get all.`;
                extractedImagesEl.appendChild(more);
            }
        }

        resultsDiv.classList.remove('hidden');
      });
    });
  });

  // Clipboard functionality
  document.getElementById('copyTextBtn').addEventListener('click', (e) => {
    if (!currentText) return;
    navigator.clipboard.writeText(currentText).then(() => {
        const btn = e.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = originalText, 2000);
    }).catch(err => {
        console.error('Failed to copy', err);
        alert('Failed to copy to clipboard');
    });
  });

  // Export Text functionality
  document.getElementById('exportTextBtn').addEventListener('click', () => {
    if (!currentText) return;
    const blob = new Blob([currentText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
        url: url,
        filename: 'extracted_text.txt',
        saveAs: true
    }, () => {
        URL.revokeObjectURL(url); // Cleanup
    });
  });

  // Download ZIP functionality
  document.getElementById('downloadImagesBtn').addEventListener('click', async (e) => {
    if (currentImages.length === 0) return;
    
    if (typeof JSZip === 'undefined') {
        alert("JSZip library failed to load.");
        return;
    }

    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Preparing ZIP...';

    try {
        const zip = new JSZip();
        const imgFolder = zip.folder("images");
        
        let loaded = 0;
        
        // Fetch all images concurrently in small chunks to prevent network blocking, or just iteratively
        for (let i = 0; i < currentImages.length; i++) {
            const url = currentImages[i];
            
            // Basic check to avoid data URIs failing fetch if malformed
            if(url.startsWith('data:')) {
                try {
                    const arr = url.split(',');
                    const mime = arr[0].match(/:(.*?);/)[1];
                    const bstr = atob(arr[1]);
                    let n = bstr.length;
                    const u8arr = new Uint8Array(n);
                    while(n--){
                        u8arr[n] = bstr.charCodeAt(n);
                    }
                    const blob = new Blob([u8arr], {type:mime});
                    // Ext parse
                    let ext = "jpeg";
                    if (mime.includes("png")) ext = "png";
                    else if (mime.includes("gif")) ext = "gif";
                    else if (mime.includes("webp")) ext = "webp";
                    else if (mime.includes("svg")) ext = "svg";

                    imgFolder.file(`image_${i + 1}_base64.${ext}`, blob);
                    loaded++;
                    btn.textContent = `Zipping... (${loaded}/${currentImages.length})`;
                } catch(e) { } // silent ignore broken base64
                continue;
            }

            try {
                // Fetch image as blob
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const blob = await response.blob();
                
                // Determine extension safely
                let ext = "jpg";
                const mime = blob.type;
                if (mime) {
                    if (mime.includes("png")) ext = "png";
                    else if (mime.includes("gif")) ext = "gif";
                    else if (mime.includes("webp")) ext = "webp";
                    else if (mime.includes("svg")) ext = "svg";
                } else {
                    const match = url.match(/\.(png|jpg|jpeg|gif|webp|svg)\b/i);
                    if (match) ext = match[1];
                }
                
                imgFolder.file(`image_${i + 1}.${ext}`, blob);
                
                loaded++;
                btn.textContent = `Zipping... (${loaded}/${currentImages.length})`;
            } catch (err) {
                console.warn("Skipping image fetch due to error (likely CORS):", url);
            }
        }
        
        btn.textContent = 'Generating ZIP...';
        const content = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(content);
        
        chrome.downloads.download({
            url: url,
            filename: "extracted_images.zip",
            saveAs: true
        }, () => {
            URL.revokeObjectURL(url);
        });

    } catch (err) {
        console.error(err);
        alert("An error occurred creating the ZIP file.");
    } finally {
        btn.textContent = 'Download All (ZIP)';
        btn.disabled = false;
    }
  });

});
