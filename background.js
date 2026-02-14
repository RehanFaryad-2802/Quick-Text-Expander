// Initialize default snippets on install
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    const defaultSnippets = {
      ';email': 'your.email@example.com',
      ';points': 'Here are the key points:\n• Point 1\n• Point 2\n• Point 3',
      ';signature': 'Best regards,\nYour Name\nYour Title\nYour Company'
    };
    
    chrome.storage.sync.set({
      snippets: defaultSnippets,
      triggerKey: 'Tab'
    });
  }
});