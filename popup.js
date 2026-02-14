document.addEventListener('DOMContentLoaded', function() {
  loadSnippets();
  
  document.getElementById('optionsBtn').addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
});

function loadSnippets() {
  chrome.storage.sync.get(['snippets'], function(result) {
    const snippets = result.snippets || {};
    const listDiv = document.getElementById('snippetList');
    
    if (Object.keys(snippets).length === 0) {
      listDiv.innerHTML = '<p style="color: #666;">No snippets yet. Add some in options!</p>';
      return;
    }
    
    let html = '';
    for (const [shortcut, text] of Object.entries(snippets)) {
      html += `
        <div class="snippet-item">
          <div class="shortcut">${shortcut}</div>
          <div class="preview">${text.substring(0, 50)}${text.length > 50 ? '...' : ''}</div>
        </div>
      `;
    }
    listDiv.innerHTML = html;
  });
}