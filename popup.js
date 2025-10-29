const statusEl = document.getElementById('status');

document.getElementById('capture').addEventListener('click', () => {
  statusEl.textContent = 'Capturing...';
  chrome.runtime.sendMessage({ action: 'capture-page' }, (resp) => {
    if (!resp) {
      statusEl.textContent = 'No response (maybe background not running)';
      return;
    }
    statusEl.textContent = resp.status || JSON.stringify(resp);

    // optionally read back saved snapshot
    if (resp.status === 'injected') {
      // Give content script a moment to store
      setTimeout(() => {
        chrome.storage.local.get(['lastCaptured'], (data) => {
          if (chrome.runtime.lastError) {
            statusEl.textContent = 'Error reading storage';
            return;
          }
          if (data && data.lastCaptured) {
            statusEl.textContent = 'Saved: ' + (data.lastCaptured.title || data.lastCaptured.url);
          }
        });
      }, 500);
    }
  });
});

document.getElementById('open').addEventListener('click', () => {
  // Point to local dev PWA on the devport the project expects
  const url = 'http://localhost:5373';
  window.open(url, '_blank');
});
