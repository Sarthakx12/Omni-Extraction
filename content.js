// content.js
let selectionMode = false;
let startX, startY;
let overlay, marquee;
let currentSelection = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractContent") {
    // Current full page logic
    try {
      const extractedText = document.body ? document.body.innerText : "";
      const images = document.images;
      const imageUrls = [];
      const seen = new Set();
      
      for (let i = 0; i < images.length; i++) {
          const src = images[i].src;
          if (src && !seen.has(src)) { 
              seen.add(src);
              imageUrls.push(src);
          }
      }

      sendResponse({ success: true, text: extractedText, images: imageUrls });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  } else if (request.action === "enterSelectionMode") {
    startSelectionMode();
    sendResponse({ success: true });
  } else if (request.action === "cancelSelectionMode") {
    cancelSelectionMode();
    sendResponse({ success: true });
  } else if (request.action === "getSelectionState") {
    sendResponse({ success: true, isSelecting: selectionMode, currentSelection: currentSelection });
  }
  return true; 
});

function startSelectionMode() {
    if (selectionMode) return;
    selectionMode = true;
    currentSelection = null;
    
    // Clear any previous selection natively
    window.getSelection().removeAllRanges();
    
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '2147483646'; // High z-index
    overlay.style.cursor = 'crosshair';
    overlay.style.background = 'rgba(0,0,0,0.05)'; // slight dim
    
    document.body.appendChild(overlay);
    
    overlay.addEventListener('mousedown', onMouseDown);
}

function cancelSelectionMode() {
    selectionMode = false;
    currentSelection = null;
    if (overlay) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
    }
    if (marquee) {
        if (marquee.parentNode) marquee.parentNode.removeChild(marquee);
        marquee = null;
    }
    window.getSelection().removeAllRanges();
}

function onMouseDown(e) {
    if (e.button !== 0) return; // Left click only
    startX = e.clientX;
    startY = e.clientY;
    
    if (marquee && marquee.parentNode) marquee.parentNode.removeChild(marquee);
    
    marquee = document.createElement('div');
    marquee.style.position = 'fixed';
    marquee.style.border = '2px dashed #4f46e5';
    marquee.style.background = 'rgba(79, 70, 229, 0.15)';
    marquee.style.zIndex = '2147483647';
    marquee.style.left = startX + 'px';
    marquee.style.top = startY + 'px';
    marquee.style.width = '0px';
    marquee.style.height = '0px';
    marquee.style.pointerEvents = 'none'; // pass events to overlay
    
    document.body.appendChild(marquee);
    
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
}

function onMouseMove(e) {
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);
    
    marquee.style.width = width + 'px';
    marquee.style.height = height + 'px';
    marquee.style.left = left + 'px';
    marquee.style.top = top + 'px';
}

function intersectRect(r1, r2) {
    return !(r2.left > r1.right || 
             r2.right < r1.left || 
             r2.top > r1.bottom ||
             r2.bottom < r1.top);
}

function onMouseUp(e) {
    overlay.removeEventListener('mousemove', onMouseMove);
    overlay.removeEventListener('mouseup', onMouseUp);
    
    const rect = marquee.getBoundingClientRect();
    
    // Ignore tiny clicks (accidental clicks)
    if (rect.width < 10 && rect.height < 10) {
        if (marquee.parentNode) marquee.parentNode.removeChild(marquee);
        marquee = null;
        return;
    }
    
    // Hide overlay so we can measure elements under it realistically if needed
    overlay.style.pointerEvents = 'none';
    
    extractBoundedContent(rect);
    
    // Remove the dimmer overlay but keep marquee
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
        overlay = null;
    }
}

function extractBoundedContent(rect) {
    // Collect Images
    const images = document.images;
    const imageUrls = new Set();
    for (let img of images) {
        const r = img.getBoundingClientRect();
        // Intersection check
        if (intersectRect(rect, r) && r.width > 0 && r.height > 0) {
            if (img.src && !img.src.startsWith('data:')) {
                imageUrls.add(img.src);
            }
        }
    }
    
    // Collect Text
    let selectedText = "";
    const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            // Ignore text in script/style tags
            if (node.parentNode && (node.parentNode.nodeName === 'SCRIPT' || node.parentNode.nodeName === 'STYLE')) {
                return NodeFilter.FILTER_REJECT;
            }
            // Ignore completely invisible elements
            const style = window.getComputedStyle(node.parentNode);
            if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    }, false);
    
    const nativeRange = document.createRange();
    const sel = window.getSelection();
    sel.removeAllRanges();
    
    let textSnippets = [];
    let firstNode = null;
    let lastNode = null;

    while(treeWalker.nextNode()) {
        const node = treeWalker.currentNode;
        if (node.nodeValue.trim() === '') continue;
        
        nativeRange.selectNodeContents(node);
        const nodeRects = nativeRange.getClientRects();
        
        // A text node might wrap lines, so check its individual rects
        let nodeIntersects = false;
        for (let i = 0; i < nodeRects.length; i++) {
            if (intersectRect(rect, nodeRects[i])) {
                nodeIntersects = true;
                break;
            }
        }
        
        if (nodeIntersects) {
            textSnippets.push(node.nodeValue.trim());
            if (!firstNode) firstNode = node;
            lastNode = node;
        }
    }
    
    selectedText = textSnippets.join(' ');
    
    // Highlight Native Text natively
    if (firstNode && lastNode) {
        try {
            const finalRange = document.createRange();
            finalRange.setStart(firstNode, 0);
            finalRange.setEnd(lastNode, lastNode.nodeValue.length);
            sel.addRange(finalRange);
        } catch(e) { }
    }

    currentSelection = {
        success: true,
        text: selectedText,
        images: Array.from(imageUrls)
    };
    
    selectionMode = false;
    
    // Little alert or floating tooltip
    const tooltip = document.createElement('div');
    tooltip.textContent = `✔ Extracted ${currentSelection.images.length} images & ${currentSelection.text.length} characters. Open extension to view!`;
    tooltip.style.position = 'fixed';
    tooltip.style.bottom = '20px';
    tooltip.style.right = '20px';
    tooltip.style.padding = '12px 16px';
    tooltip.style.background = '#0f172a';
    tooltip.style.color = '#fff';
    tooltip.style.borderRadius = '8px';
    tooltip.style.zIndex = '2147483647';
    tooltip.style.fontFamily = 'sans-serif';
    tooltip.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    tooltip.style.animation = 'fadeInOut 4s forwards';
    
    if(!document.getElementById('extractor-styles')){
        const xStyle = document.createElement('style');
        xStyle.id = 'extractor-styles';
        xStyle.textContent = `@keyframes fadeInOut { 0% { opacity: 0; transform: translateY(10px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(10px); } }`;
        document.head.appendChild(xStyle);
    }
    
    document.body.appendChild(tooltip);
    setTimeout(() => {
        if(tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
        if(marquee && marquee.parentNode) marquee.parentNode.removeChild(marquee);
    }, 4000);
}
