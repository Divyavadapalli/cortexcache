// content.js - runs in page context to extract visible text
(function () {
  try {
    const text = document.body ? document.body.innerText || '' : '';
    const title = document.title || '';
    const url = location.href || '';

    // send the capture to the background using the lightweight save-capture message
    console.log('CortexCache [content]: Capturing page:', { title, url, textLength: text.length });
    chrome.runtime.sendMessage({ type: 'save-capture', title, url, text }, (resp) => {
      console.log('CortexCache [content]: Capture sent to background, response:', resp);
    });
  } catch (e) {
    console.error('CortexCache: content script error', e);
  }
})();
