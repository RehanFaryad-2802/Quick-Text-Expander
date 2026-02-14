document.addEventListener('DOMContentLoaded', function() {
  loadSnippets();
  loadSettings();
  
  document.getElementById('saveBtn').addEventListener('click', saveSnippet);
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
      document.getElementById('shortcut').value = ';';
      document.getElementById('snippetText').value = '';
      loadSnippets();
    });
  });
}

function displaySnippets(snippets) {
  const container = document.getElementById('snippetsList');
  
  if (Object.keys(snippets).length === 0) {
    container.innerHTML = '<p>No snippets yet. Add one above!</p>';
    return;
  }
  
  let html = '';
  for (const [shortcut, text] of Object.entries(snippets)) {
    html += `
      <div class="snippet-card" data-shortcut="${shortcut}">
        <div class="snippet-shortcut">${shortcut}</div>
        <div class="snippet-text">${text}</div>
        <div class="snippet-actions">
          <button class="delete">Delete</button>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Add delete listeners
  document.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', function() {
      const card = this.closest('.snippet-card');
      const shortcut = card.dataset.shortcut;
      deleteSnippet(shortcut);
    });
  });
}

function deleteSnippet(shortcut) {
  if (confirm(`Delete ${shortcut}?`)) {
    chrome.storage.sync.get(['snippets'], function(result) {
      const snippets = result.snippets || {};
      delete snippets[shortcut];
      chrome.storage.sync.set({ snippets: snippets }, function() {
        loadSnippets();
      });
    });
  }
}