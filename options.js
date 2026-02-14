document.addEventListener('DOMContentLoaded', function() {
  loadSnippets();
  loadSettings();
  
  document.getElementById('saveSnippet').addEventListener('click', saveSnippet);
  document.getElementById('triggerKey').addEventListener('change', saveTriggerKey);
});

function loadSnippets() {
  chrome.storage.sync.get(['snippets'], function(result) {
    const snippets = result.snippets || {};
    displaySnippets(snippets);
  });
}

function loadSettings() {
  chrome.storage.sync.get(['triggerKey'], function(result) {
    if (result.triggerKey) {
      document.getElementById('triggerKey').value = result.triggerKey;
    }
  });
}

function saveTriggerKey() {
  const triggerKey = document.getElementById('triggerKey').value;
  chrome.storage.sync.set({ triggerKey: triggerKey });
}

function saveSnippet() {
  const shortcut = document.getElementById('shortcut').value.trim();
  const text = document.getElementById('snippetText').value.trim();
  
  if (!shortcut || !text) {
    alert('Please fill in both fields');
    return;
  }
  
  if (!shortcut.startsWith(';')) {
    alert('Shortcut must start with ;');
    return;
  }
  
  chrome.storage.sync.get(['snippets'], function(result) {
    const snippets = result.snippets || {};
    snippets[shortcut] = text;
    
    chrome.storage.sync.set({ snippets: snippets }, function() {
      // Clear form
      document.getElementById('shortcut').value = ';';
      document.getElementById('snippetText').value = '';
      
      // Reload snippets list
      loadSnippets();
    });
  });
}

function displaySnippets(snippets) {
  const container = document.getElementById('snippetsContainer');
  
  if (Object.keys(snippets).length === 0) {
    container.innerHTML = '<p>No snippets yet. Add your first one above!</p>';
    return;
  }
  
  let html = '';
  for (const [shortcut, text] of Object.entries(snippets)) {
    html += `
      <div class="snippet-card">
        <div class="snippet-shortcut">${shortcut}</div>
        <div class="snippet-text">${text}</div>
        <div class="snippet-actions">
          <button class="btn btn-danger" onclick="deleteSnippet('${shortcut}')">Delete</button>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

function deleteSnippet(shortcut) {
  if (confirm(`Delete snippet ${shortcut}?`)) {
    chrome.storage.sync.get(['snippets'], function(result) {
      const snippets = result.snippets || {};
      delete snippets[shortcut];
      
      chrome.storage.sync.set({ snippets: snippets }, function() {
        loadSnippets();
      });
    });
  }
}