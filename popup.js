document.addEventListener('DOMContentLoaded', function() {
  // Load and display snippets
  chrome.storage.sync.get(['snippets'], function(result) {
    const snippets = result.snippets || {};
    const div = document.getElementById('snippets');
    
    if (Object.keys(snippets).length === 0) {
      div.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌙</div>
          <div class="empty-state-text">No snippets yet</div>
          <div class="empty-state-hint">Click settings to add your first snippet</div>
        </div>
      `;
      return;
    }
    
    let html = '';
    for (const [shortcut, text] of Object.entries(snippets)) {
      const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
      html += `
        <div class="snippet-card">
          <div class="shortcut-badge">${shortcut}</div>
          <div class="preview-text">${preview}</div>
        </div>
      `;
    }
    div.innerHTML = html;
  });

  // Options button
  document.getElementById('options').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});