// ===== ULTIMATE TEXT EXPANDER – FIXED FOR WHATSAPP & DISCORD =====
let snippets = {};
let triggerKey = 'Tab';
let activeField = null;
let activeShortcut = '';

// Load settings
chrome.storage.sync.get(['snippets', 'triggerKey'], function(result) {
  snippets = result.snippets || {};
  triggerKey = result.triggerKey || 'Tab';
  console.log('✅ Text Expander ready with', Object.keys(snippets).length, 'snippets');
});

// Listen for updates
chrome.storage.onChanged.addListener(function(changes) {
  if (changes.snippets) snippets = changes.snippets.newValue || {};
  if (changes.triggerKey) triggerKey = changes.triggerKey.newValue || 'Tab';
});

// Find all editable fields
function findEditableFields() {
  const fields = new Set();
  const selectors = [
    'input[type="text"]', 'input[type="search"]', 'input[type="email"]',
    'input[type="url"]', 'input[type="tel"]', 'input[type="number"]',
    'input:not([type])', 'textarea',
    '[contenteditable="true"]', '[contenteditable=""]',
    '[role="textbox"]', '[role="combobox"]', '[role="searchbox"]',
    '.editable', '.text-input',
    '.public-DraftEditor-content', // WhatsApp, LinkedIn
    '[data-lexical-editor]', // Facebook
    '[data-slate-editor]',
    '[g_editable="true"]', // Gmail
    'div[aria-multiline="true"]', 'div[contenteditable]',
    '[data-tab="10"]', // WhatsApp
    '.copyable-text.selectable-text', // WhatsApp
    'div[spellcheck="true"]', 'div[aria-placeholder]',
    'div[data-testid="conversation-compose-message-input"]', // WhatsApp
    'div[title*="Type a message"]', 'div[aria-label*="Type a message"]',
    'div[placeholder*="Type a message"]',
    '#contenteditable-root', // YouTube comments
    '#textarea', // YouTube search
    'yt-formatted-string[contenteditable="true"]', // YouTube
    'div[role="textbox"][contenteditable="true"]', // Discord
    'div[data-slate-node="value"]', // Discord (new)
  ];
  selectors.forEach(selector => {
    try { document.querySelectorAll(selector).forEach(el => fields.add(el)); } catch (e) {}
  });
  document.querySelectorAll('[contenteditable]').forEach(el => fields.add(el));
  return Array.from(fields);
}

// Attach listeners to all fields
function attachToFields() {
  findEditableFields().forEach(field => {
    if (!field.hasAttribute('data-te-bound')) {
      field.setAttribute('data-te-bound', 'true');
      field.addEventListener('input', onInput);
      field.addEventListener('keydown', onKeyDown);
      if (field.isContentEditable || field.getAttribute('contenteditable')) {
        const observer = new MutationObserver(() => checkForShortcut(field));
        observer.observe(field, { childList: true, characterData: true, subtree: true });
      }
    }
  });
}

// Initial and periodic attachment
attachToFields();
setInterval(attachToFields, 1000);
new MutationObserver(attachToFields).observe(document.body, { childList: true, subtree: true });

function onInput(e) {
  const field = e.target;
  if (!isEditable(field)) return;
  checkForShortcut(field);
}

function onKeyDown(e) {
  const field = e.target;
  if (!isEditable(field)) return;

  if (e.key === triggerKey && activeField === field) {
    e.preventDefault();
    e.stopPropagation();
    expandShortcut(field, activeShortcut);
    hideSuggestion();
    return false;
  }

  if (e.key === 'Escape') hideSuggestion();

  if (e.key === 'Backspace' || e.key === 'Delete') {
    setTimeout(() => checkForShortcut(field), 10);
  }
}

function isEditable(field) {
  return field && (
    field.tagName === 'INPUT' ||
    field.tagName === 'TEXTAREA' ||
    field.isContentEditable ||
    field.getAttribute('contenteditable') === 'true'
  );
}

function getFieldText(field) {
  try {
    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') return field.value;
    return field.innerText || field.textContent || '';
  } catch (e) {
    return '';
  }
}

function checkForShortcut(field) {
  const text = getFieldText(field);
  if (!text) return hideSuggestion();

  const words = text.split(/\s+/);
  const lastWord = words[words.length - 1];

  if (lastWord && snippets.hasOwnProperty(lastWord)) {
    showSuggestion(field, lastWord);
    activeField = field;
    activeShortcut = lastWord;
  } else {
    hideSuggestion();
  }
}

function showSuggestion(field, shortcut) {
  hideSuggestion();
  const suggestion = document.createElement('div');
  suggestion.id = 'te-suggestion';
  Object.assign(suggestion.style, {
    position: 'absolute',
    zIndex: '2147483647',
    background: '#1e1e1e',
    color: 'white',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    pointerEvents: 'none',
    border: '1px solid #444',
  });
  suggestion.textContent = `[${triggerKey}] Expand: ${shortcut}`;
  try {
    const rect = field.getBoundingClientRect();
    suggestion.style.top = (window.scrollY + rect.bottom + 5) + 'px';
    suggestion.style.left = (window.scrollX + rect.left) + 'px';
  } catch (e) {
    suggestion.style.bottom = '20px';
    suggestion.style.right = '20px';
    suggestion.style.position = 'fixed';
  }
  document.body.appendChild(suggestion);
  setTimeout(() => {
    if (document.getElementById('te-suggestion') === suggestion) hideSuggestion();
  }, 2000);
}

function hideSuggestion() {
  const old = document.getElementById('te-suggestion');
  if (old) old.remove();
  activeField = null;
  activeShortcut = '';
}

// ===== ROBUST EXPANSION FOR CONTENTEDITABLE FIELDS =====
function expandShortcut(field, shortcut) {
  const snippet = snippets[shortcut];
  if (!snippet) return;

  if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
    // Simple input/textarea
    const text = field.value;
    const lastIndex = text.lastIndexOf(shortcut);
    if (lastIndex === -1) return;
    const newText = text.substring(0, lastIndex) + snippet + text.substring(lastIndex + shortcut.length);
    field.value = newText;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.selectionStart = field.selectionEnd = newText.length;
  } else {
    // Contenteditable: find the exact text node and replace
    field.focus();
    const fullText = field.innerText || field.textContent;
    const lastIndex = fullText.lastIndexOf(shortcut);
    if (lastIndex === -1) return;

    // Walk through text nodes to locate the exact position
    const range = document.createRange();
    let currentNode = field;
    let accumulated = 0;
    let found = false;

    function findTextNode(node) {
      if (found) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const len = node.textContent.length;
        const start = accumulated;
        const end = accumulated + len;
        if (lastIndex >= start && lastIndex < end) {
          // The shortcut starts inside this text node
          const offsetInNode = lastIndex - start;
          range.setStart(node, offsetInNode);
          range.setEnd(node, offsetInNode + shortcut.length);
          found = true;
        }
        accumulated += len;
      } else {
        for (let child of node.childNodes) {
          findTextNode(child);
          if (found) break;
        }
      }
    }

    findTextNode(field);

    if (found) {
      // Select the exact shortcut and replace
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, snippet);
    } else {
      // Fallback: replace using innerText (less reliable)
      field.innerText = fullText.substring(0, lastIndex) + snippet + fullText.substring(lastIndex + shortcut.length);
    }

    // Move cursor to end
    const newRange = document.createRange();
    newRange.selectNodeContents(field);
    newRange.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  // Visual feedback
  field.style.backgroundColor = '#e6f3e6';
  setTimeout(() => field.style.backgroundColor = '', 200);
}