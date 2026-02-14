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
  showToast('Trigger key updated! ⚡');
}

function saveSnippet() {
  const shortcut = document.getElementById('shortcut').value.trim();
  const text = document.getElementById('snippetText').value.trim();
  
  if (!shortcut || !text) {
    alert('Please fill in both fields');
    return;
  }
  
  chrome.storage.sync.get(['snippets'], function(result) {
    const snippets = result.snippets || {};
    snippets[shortcut] = text;
    
    chrome.storage.sync.set({ snippets: snippets }, function() {
      document.getElementById('shortcut').value = ';';
      document.getElementById('snippetText').value = '';
      loadSnippets();
      showToast('Snippet saved! 🌙');
    });
  });
}

function displaySnippets(snippets) {
  const container = document.getElementById('snippetsList');
  
  if (Object.keys(snippets).length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🌙</div>
        <div class="empty-state-title">No snippets yet</div>
        <div class="empty-state-text">Create your first snippet above to get started!</div>
      </div>
    `;
    return;
  }
  
  let html = '<div class="snippets-grid">';
  for (const [shortcut, text] of Object.entries(snippets)) {
    html += `
      <div class="snippet-item" data-shortcut="${shortcut}">
        <div class="snippet-shortcut">${shortcut}</div>
        <div class="snippet-text">${text}</div>
        <div class="snippet-actions">
          <button class="btn btn-delete delete">
            <span>🗑️</span>
            Delete
          </button>
        </div>
      </div>
    `;
  }
  html += '</div>';
  
  container.innerHTML = html;
  
  // Add delete listeners
  document.querySelectorAll('.delete').forEach(btn => {
    btn.addEventListener('click', function() {
      const card = this.closest('.snippet-item');
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
        showToast('Snippet deleted 🗑️');
      });
    });
  }
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #818cf8, #c084fc);
    color: white;
    padding: 12px 24px;
    border-radius: 40px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 20px rgba(129, 140, 248, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
    z-index: 9999;
    animation: slideIn 0.3s ease;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}
