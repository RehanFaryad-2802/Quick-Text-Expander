// Background script for handling messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'elementSelected') {
    // Store the last selected element for popup
    chrome.storage.local.set({ lastSelectedElement: message.selector });
  }
});

// Optional: Handle installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('DOM Editor Pro installed');
});