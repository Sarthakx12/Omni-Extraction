document.addEventListener('DOMContentLoaded', () => {
    // Top Level Panels
    const actionPanel = document.getElementById('actionPanel');
    const selectionActivePanel = document.getElementById('selectionActivePanel');
    const resultsDiv = document.getElementById('results');
    
    // Core Buttons
    const extractBtn = document.getElementById('extractBtn');
    const extractBtnText = document.getElementById('extractBtnText');
    const loaderFull = document.getElementById('loaderFull');
    const selectContentBtn = document.getElementById('selectContentBtn');
    const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
    const resetViewBtn = document.getElementById('resetViewBtn');
  
    // Results Elements
    const resultsHeader = document.getElementById('resultsHeader');
    const imageCountEl = document.getElementById('imageCount');
    const textCountEl = document.getElementById('textCount');
    const extractedTextEl = document.getElementById('extractedText');
    const extractedImagesEl = document.getElementById('extractedImages');
    
    // Tab Interaction
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabIndicator = document.getElementById('tabIndicator');
    
    // AI Elements
    const aiButtons = document.querySelectorAll('.ai-btn');
    const aiOutputText = document.getElementById('aiOutputText');
    const aiLoader = document.getElementById('aiLoader');
    const copyAiTextBtn = document.getElementById('copyAiTextBtn');
    const exportAiTextBtn = document.getElementById('exportAiTextBtn');
    let currentAIResult = "";
    
    tabBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
        
        // Move sliding indicator
        tabIndicator.style.transform = `translateX(${index * 100}%)`;
      });
    });
  
    let currentImages = [];
    let currentText = "";
    const formatNumber = num => num.toLocaleString();
  
    // Toast Notification System
    const toast = document.getElementById('toast');
    let toastTimeout;
    
    function showToast(message) {
        toast.textContent = message;
        toast.classList.remove('hidden');
        
        // Force reflow
        void toast.offsetWidth;
        toast.classList.add('show');
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 300); // Wait for transition
        }, 2500);
    }
  
    // Global initial mount
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
                return;
            }

            chrome.tabs.sendMessage(activeTab.id, { action: "getSelectionState" }, (response) => {
                if (chrome.runtime.lastError) return;

                if (response && response.success) {
                    if (response.isSelecting) {
                        actionPanel.classList.add('hidden');
                        selectionActivePanel.classList.remove('hidden');
                        resultsDiv.classList.add('hidden');
                    } else if (response.currentSelection) {
                        actionPanel.classList.add('hidden');
                        selectionActivePanel.classList.add('hidden');
                        renderResults(response.currentSelection.text, response.currentSelection.images, "Selected Content");
                    }
                }
            });
        });
    }

    // Extraction Engine
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
                    extractBtnText.textContent = msg.includes("Receiving end does not exist") ? 'Please refresh webpage' : 'Failed. Try refreshing.';
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
                renderResults(response.text, response.images, "Full Page Extraction");
                showToast("Extraction Successful!");
            });
        });
    });

    selectContentBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:'))) {
                return showSystemPageError(document.getElementById('selectBtnText'));
            }

            chrome.tabs.sendMessage(activeTab.id, { action: "enterSelectionMode" }, (response) => {
                if (chrome.runtime.lastError) {
                    document.getElementById('selectBtnText').textContent = 'Please refresh webpage';
                    setTimeout(() => document.getElementById('selectBtnText').textContent = 'Select Area', 3000);
                    return;
                }
                window.close();
            });
        });
    });

    cancelSelectionBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "cancelSelectionMode" });
            actionPanel.classList.remove('hidden');
            selectionActivePanel.classList.add('hidden');
        });
    });

    resetViewBtn.addEventListener('click', () => {
        resultsDiv.classList.add('hidden');
        actionPanel.classList.remove('hidden');
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if(tabs && tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: "cancelSelectionMode" });
        });
    });
  
    // Renderer
    function renderResults(text, images, title) {
        resultsHeader.textContent = title;
        currentImages = images || [];
        currentText = text || "";
        
        imageCountEl.textContent = formatNumber(currentImages.length);
        textCountEl.textContent = formatNumber(currentText.length);
        extractedTextEl.value = currentText;
        
        extractedImagesEl.innerHTML = '';
        if (currentImages.length === 0) {
            extractedImagesEl.innerHTML = '<div class="empty-state">No images found.</div>';
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
  
    // Actions - Standard Copying
    document.getElementById('copyTextBtn').addEventListener('click', () => {
      if (!currentText) return;
      navigator.clipboard.writeText(currentText).then(() => {
          showToast("Copied to clipboard!");
      });
    });
  
    document.getElementById('exportTextBtn').addEventListener('click', () => {
      if (!currentText) return;
      const blob = new Blob([currentText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({ url: url, filename: 'extracted_text.txt', saveAs: true }, () => {
          URL.revokeObjectURL(url);
          showToast("Text exported!");
      });
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
              // Support Base64 embedded UI nodes
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
          
          btn.textContent = 'Generating Package...';
          const content = await zip.generateAsync({ type: "blob" });
          const outUrl = URL.createObjectURL(content);
          
          chrome.downloads.download({ url: outUrl, filename: "extracted_images.zip", saveAs: true }, () => {
              URL.revokeObjectURL(outUrl);
              showToast("ZIP Archive Downloaded!");
          });
      } catch (err) {
          alert("ZIP Error");
      } finally {
          btn.textContent = 'Download All (ZIP)';
          btn.disabled = false;
      }
    });

    // AI Action Handlers
    aiButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const action = btn.dataset.action;
            if (!currentText || currentText.trim() === '') {
                showToast("No extracted text to process!");
                return;
            }

            // Lock UI
            aiButtons.forEach(b => b.disabled = true);
            aiLoader.classList.remove('hidden');
            aiOutputText.value = '';
            copyAiTextBtn.disabled = true;
            exportAiTextBtn.disabled = true;
            currentAIResult = "";

            try {
                // Call global AI engine
                const result = await window.AI.processText(action, currentText);
                currentAIResult = result;
                aiOutputText.value = currentAIResult;
                
                showToast("Transformation Complete ✨");
                copyAiTextBtn.disabled = false;
                exportAiTextBtn.disabled = false;
            } catch (err) {
                aiOutputText.value = "[Error] " + err.message;
                showToast("AI Processing failed");
            } finally {
                aiLoader.classList.add('hidden');
                aiButtons.forEach(b => b.disabled = false);
            }
        });
    });

    // Output Result Actions
    copyAiTextBtn.addEventListener('click', () => {
        if (!currentAIResult) return;
        navigator.clipboard.writeText(currentAIResult).then(() => {
            showToast("AI Response copied!");
        });
    });

    exportAiTextBtn.addEventListener('click', () => {
        if (!currentAIResult) return;
        const blob = new Blob([currentAIResult], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({ url: url, filename: 'ai_processed_content.txt', saveAs: true }, () => {
            URL.revokeObjectURL(url);
            showToast("AI document generated!");
        });
    });
});
