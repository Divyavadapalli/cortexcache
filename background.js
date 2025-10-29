// background.js - service worker for CortexCache extension (MV3)

let lastCapturedText = ''
// Keep track of externally-connected pages (PWA instances)
const externalPorts = []

chrome.runtime.onInstalled.addListener(() => {
  console.log('CortexCache Extension installed.')
})

// Accept connections from externally_connectable web pages (the PWA)
chrome.runtime.onConnectExternal.addListener((port) => {
  try {
    console.log('CortexCache [background]: External port connected:', port.name)
    externalPorts.push(port)
    port.onDisconnect.addListener(() => {
      const idx = externalPorts.indexOf(port)
      if (idx !== -1) externalPorts.splice(idx, 1)
      console.log('CortexCache [background]: External port disconnected')
    })
  } catch (e) {
    console.warn('CortexCache [background]: onConnectExternal error', e)
  }
})

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return

  // Inject content script on popup capture request
  if (msg.action === 'capture-page') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0]
      if (!tab) return sendResponse({ status: 'no-active-tab' })

      chrome.scripting
        .executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
        .then(() => {
          sendResponse({ status: 'injected' })
        })
        .catch((err) => sendResponse({ status: 'error', error: err.message }))
    })
    return true
  }

  // Backwards-compatible: content script may still send page-content
  if (msg.action === 'page-content') {
    const payload = {
      title: msg.title || '',
      url: msg.url || '',
      text: msg.text || '',
      timestamp: Date.now()
    }
    chrome.storage.local.set({ lastCaptured: payload }, () => {
      console.log('CortexCache: saved lastCaptured (page-content)')
      lastCapturedText = payload.text || ''
      sendResponse({ status: 'saved' })
    })
    return true
  }

  // Save capture (from content script) - lightweight in-memory + persist
  if (msg.type === 'save-capture') {
    lastCapturedText = msg.text || ''
    const payload = {
      title: msg.title || '',
      url: msg.url || '',
      text: msg.text || '',
      timestamp: Date.now()
    }
    chrome.storage.local.set({ lastCaptured: payload }, () => {
      console.log('CortexCache [background]: Saving capture:', payload)
      console.log('CortexCache [background]: Notifying PWA about new capture...')
      // Notify connected PWAs that a new capture is available
      try {
        externalPorts.forEach((p) => {
          try { p.postMessage({ type: 'capture-updated', payload }) } catch (e) { /* ignore */ }
        })
      } catch (e) {
        console.warn('CortexCache [background]: Failed to notify external ports', e)
      }

      // As a reliable fallback, directly postMessage into any open PWA tab
      try {
        chrome.tabs.query({ url: ['http://localhost:5373/*', 'https://localhost:5373/*'] }, (tabs) => {
          if (!tabs || tabs.length === 0) return
          tabs.forEach((t) => {
            try {
              chrome.scripting.executeScript({
                target: { tabId: t.id },
                func: (payload) => {
                  try {
                    window.postMessage({ source: 'cortexcache-extension', type: 'cortexcache-capture', payload }, '*')
                  } catch (e) { /* ignore */ }
                },
                args: [payload]
              }).catch(() => {})
            } catch (e) {
              // ignore per-tab failures
            }
          })
        })
      } catch (e) {
        // ignore
      }
      // also attempt a global runtime message as a best-effort fallback
      try {
        chrome.runtime.sendMessage({ type: 'capture-updated', payload }, (response) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.debug('CortexCache [background]: sendMessage lastError (no receiver):', chrome.runtime.lastError)
          } else {
            console.log('CortexCache [background]: Notification response:', response)
          }
        })
      } catch (e) {
        // ignore
      }
      sendResponse({ status: 'saved' })
    })
    return true
  }

  // PWA requests latest capture
  if (msg.type === 'get-last-capture') {
    // prefer persisted storage if available
    chrome.storage.local.get(['lastCaptured'], (data) => {
      if (chrome.runtime.lastError) {
        sendResponse({ status: 'error', error: chrome.runtime.lastError.message })
      } else {
        const text = (data && data.lastCaptured && data.lastCaptured.text) || lastCapturedText || ''
        sendResponse({ status: 'ok', text, lastCaptured: data.lastCaptured || null })
      }
    })
    return true
  }
})
