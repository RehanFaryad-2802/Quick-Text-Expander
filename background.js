// Store snippets
let snippets = {};
let triggerKey = 'Tab';

// Load saved snippets
chrome.storage.sync.get(['snippets', 'triggerKey'], function(result) {
  snippets = result.snippets || {};
  triggerKey = result.triggerKey || 'Tab';
});

// Listen for storage changes
chrome.storage.onChanged.addListener(function(changes) {
  if (changes.snippets) {
    snippets = changes.snippets.newValue || {};
  }
  if (changes.triggerKey) {
    triggerKey = changes.triggerKey.newValue || 'Tab';
  }
  
  // Notify all tabs about the update
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'snippetsUpdated',
        snippets: snippets,
        triggerKey: triggerKey
      }).catch(() => {}); // Ignore errors for tabs without content script
    });
  });
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getSnippets') {
    sendResponse({
      snippets: snippets,
      triggerKey: triggerKey
    });
  }
  return true;
});

// Initialize default snippets on install
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    const defaultSnippets = {
      ';email': 'your.email@example.com',
      ';pg': 'Points to consider:\n• Point 1\n• Point 2\n• Point 3',
      ';sig': 'Best regards,\nYour Name'
    };
    
    chrome.storage.sync.set({
      snippets: defaultSnippets,
      triggerKey: 'Tab'
    });
  }
});