document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const actionPanel = document.getElementById('actionPanel');
    const selectionActivePanel = document.getElementById('selectionActivePanel');
    const resultsDiv = document.getElementById('results');
    const resultsHeader = document.getElementById('resultsHeader');
    
    const extractBtn = document.getElementById('extractBtn');
    const extractBtnText = document.getElementById('extractBtnText');
    const loaderFull = document.getElementById('loaderFull');
    
    const selectContentBtn = document.getElementById('selectContentBtn');
    const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
  
    const imageCountEl = document.getElementById('imageCount');
    const textCountEl = document.getElementById('textCount');
    const extractedTextEl = document.getElementById('extractedText');
    const extractedImagesEl = document.getElementById('extractedImages');
    
    // Setup Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
      });
    });
  
    let currentImages = [];
    let currentText = "";
    const formatNumber = num => num.toLocaleString();
  
    // 1. Initial State Check
    initializeState();

    function showSystemPageError(btnLabel) {
        actionPanel.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        selectionActivePanel.classList.add('hidden');
        loaderFull.classList.add('hidden');
        btnLabel.textContent = 'Cannot run on system pages';
        setTimeout(() => { btnLabel.textContent = 'Extract Full Page'; extractBtn.disabled = false; }, 3000);
    }
  
    function initializeState() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (!activeTab || !activeTab.id || (activeTab.url && activeTab.url.startsWith('chrome'))) {
                return; // Wait for user interaction to show error explicitly
            }

            chrome.tabs.sendMessage(activeTab.id, { action: "getSelectionState" }, (response) => {
                if (chrome.runtime.lastError) return; // Script not injected yet

                if (response && response.success) {
                    if (response.isSelecting) {
                        // User is currently selecting right now
                        actionPanel.classList.add('hidden');
                        selectionActivePanel.classList.remove('hidden');
                        resultsDiv.classList.add('hidden');
                    } else if (response.currentSelection) {
                        // User finished selecting, display results
                        actionPanel.classList.add('hidden');
                        selectionActivePanel.classList.add('hidden');
                        renderResults(response.currentSelection.text, response.currentSelection.images, "Manual Selection Results");
                    }
                }
            });
        });
    }

    // 2. Full Page Extraction
    extractBtn.addEventListener('click', () => {
        extractBtn.disabled = true;
        extractBtnText.textContent = 'Extracting...';
        loaderFull.classList.remove('hidden');
  
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:'))) {
                return showSystemPageError(extractBtnText);
            }
  
            chrome.tabs.sendMessage(activeTab.id, { action: "extractContent" }, (response) => {
                loaderFull.classList.add('hidden');
                extractBtn.disabled = false;
                
                if (chrome.runtime.lastError) {
                    const msg = chrome.runtime.lastError.message;
                    extractBtnText.textContent = msg.includes("Receiving end does not exist") ? 'Pls refresh the page first!' : 'Failed. Try refreshing.';
                    setTimeout(() => extractBtnText.textContent = 'Extract Full Page', 3000);
                    return;
                }
                
                if (!response || !response.success) {
                    extractBtnText.textContent = 'Extraction Failed.';
                    setTimeout(() => extractBtnText.textContent = 'Extract Full Page', 3000);
                    return;
                }
                
                extractBtnText.textContent = 'Extract Full Page';
                actionPanel.classList.add('hidden');
                
                renderResults(response.text, response.images, "Full Page Results");
            });
        });
    });

    // 3. Enter Selection Mode
    selectContentBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:'))) {
                return showSystemPageError(document.getElementById('selectBtnText'));
            }

            chrome.tabs.sendMessage(activeTab.id, { action: "enterSelectionMode" }, (response) => {
                if (chrome.runtime.lastError) {
                    document.getElementById('selectBtnText').textContent = 'Pls refresh page first!';
                    setTimeout(() => document.getElementById('selectBtnText').textContent = 'Select Content', 3000);
                    return;
                }
                // Selection mode successfully started. Close popup so user can use the screen.
                window.close();
            });
        });
    });

    // 4. Cancel Selection Mode
    cancelSelectionBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "cancelSelectionMode" });
            actionPanel.classList.remove('hidden');
            selectionActivePanel.classList.add('hidden');
        });
    });

    // 5. Reset View
    resetViewBtn.addEventListener('click', () => {
        resultsDiv.classList.add('hidden');
        actionPanel.classList.remove('hidden');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if(tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "cancelSelectionMode" });
        });
    });
  
    // Main UI Renderer
    function renderResults(text, images, title) {
        resultsHeader.textContent = title;
        currentImages = images || [];
        currentText = text || "";
        
        imageCountEl.textContent = formatNumber(currentImages.length);
        textCountEl.textContent = formatNumber(currentText.length);
        extractedTextEl.value = currentText;
        
        extractedImagesEl.innerHTML = '';
        if (currentImages.length === 0) {
            extractedImagesEl.innerHTML = '<div class="empty-state">No images found in your selection.</div>';
            document.getElementById('downloadImagesBtn').disabled = true;
        } else {
            document.getElementById('downloadImagesBtn').disabled = false;
            const fragment = document.createDocumentFragment();
            const displayLimit = Math.min(currentImages.length, 100);
            
            for (let i = 0; i < displayLimit; i++) {
                const src = currentImages[i];
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
            if (currentImages.length > 100) {
                const more = document.createElement('div');
                more.className = 'empty-state';
                more.textContent = `+ ${formatNumber(currentImages.length - 100)} more images (ZIP to get all).`;
                extractedImagesEl.appendChild(more);
            }
        }
        resultsDiv.classList.remove('hidden');
    }
  
    // 6. Clipboard & Export Actions
    document.getElementById('copyTextBtn').addEventListener('click', (e) => {
      if (!currentText) return;
      navigator.clipboard.writeText(currentText).then(() => {
          const btn = e.target;
          const originalText = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = originalText, 2000);
      });
    });
  
    document.getElementById('exportTextBtn').addEventListener('click', () => {
      if (!currentText) return;
      const blob = new Blob([currentText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url: url, filename: 'extracted_text.txt', saveAs: true }, () => URL.revokeObjectURL(url));
    });
  
    document.getElementById('downloadImagesBtn').addEventListener('click', async (e) => {
      if (currentImages.length === 0 || typeof JSZip === 'undefined') return;
      
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'Preparing ZIP...';
  
      try {
          const zip = new JSZip();
          const imgFolder = zip.folder("images");
          let loaded = 0;
          
          for (let i = 0; i < currentImages.length; i++) {
              const url = currentImages[i];
              if(url.startsWith('data:')) {
                  try {
                      const arr = url.split(',');
                      const mime = arr[0].match(/:(.*?);/)[1];
                      const bstr = atob(arr[1]);
                      let n = bstr.length;
                      const u8arr = new Uint8Array(n);
                      while(n--) u8arr[n] = bstr.charCodeAt(n);
                      const blob = new Blob([u8arr], {type:mime});
                      
                      let ext = "jpeg";
                      if (mime.includes("png")) ext = "png";
                      else if (mime.includes("gif")) ext = "gif";
                      else if (mime.includes("webp")) ext = "webp";
                      else if (mime.includes("svg")) ext = "svg";
  
                      imgFolder.file(`image_${i + 1}_base64.${ext}`, blob);
                      loaded++;
                      btn.textContent = `Zipping... (${loaded}/${currentImages.length})`;
                  } catch(err) { }
                  continue;
              }
  
              try {
                  const response = await fetch(url);
                  if (!response.ok) throw new Error(`HTTP ${response.status}`);
                  const blob = await response.blob();
                  
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
              } catch (err) { }
          }
          
          btn.textContent = 'Generating...';
          const content = await zip.generateAsync({ type: "blob" });
          const outUrl = URL.createObjectURL(content);
          
          chrome.downloads.download({ url: outUrl, filename: "extracted_images.zip", saveAs: true }, () => URL.revokeObjectURL(outUrl));
      } catch (err) {
          alert("ZIP Error");
      } finally {
          btn.textContent = 'Download All (ZIP)';
          btn.disabled = false;
      }
    });
});
