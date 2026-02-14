document.addEventListener('DOMContentLoaded', function() {
  // Load and display snippets
  chrome.storage.sync.get(['snippets'], function(result) {
    const snippets = result.snippets || {};
    const div = document.getElementById('snippets');
    
    if (Object.keys(snippets).length === 0) {
      div.innerHTML = '<div class="empty">No snippets yet</div>';
      return;
    }
    
    let html = '';
    for (const [shortcut, text] of Object.entries(snippets)) {
      const preview = text.length > 30 ? text.substring(0, 30) + '...' : text;
      html += `
        <div class="snippet">
          <div class="shortcut">${shortcut}</div>
          <div class="preview">${preview}</div>
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