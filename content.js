chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractContent") {
    try {
      // Extract visible text
      const extractedText = document.body ? document.body.innerText : "";

      // Extract image URLs safely with deduping
      const images = document.images;
      const imageUrls = [];
      const seen = new Set();
      
      for (let i = 0; i < images.length; i++) {
          const src = images[i].src;
          if (src && !seen.has(src) && !src.startsWith('data:')) {  // Ignore raw base64 strings if needed, though they can be valid too. Let's keep them if user wants, but base64 breaks some zip flows if too large. Actually let's include all.
              seen.add(src);
              imageUrls.push(src);
          }
      }

      sendResponse({ 
        success: true,
        text: extractedText, 
        images: imageUrls 
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  return true; 
});
