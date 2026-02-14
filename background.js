// Initialize default snippets on install
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    const defaultSnippets = {
      ';email': 'your.email@example.com',
      ';hello': 'Hello! How can I help you today?',
      ';sig': 'Best regards,\nYour Name'
    };
    
    chrome.storage.sync.set({
      snippets: defaultSnippets,
      triggerKey: 'Tab'
    });
  }
});