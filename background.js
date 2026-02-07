// Simple background script
chrome.runtime.onInstalled.addListener(() => {
  console.log('DOM Editor installed');
  
  // Set default settings
  chrome.storage.local.set({
    theme: 'light',
    autoApply: false,
    savedStyles: []
  });
});