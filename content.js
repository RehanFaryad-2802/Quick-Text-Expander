// ===== ULTIMATE TEXT EXPANDER - FIXED FOR WHATSAPP =====
let snippets = {};
let triggerKey = 'Tab';
let activeSuggestion = null;
let lastSnippetCheck = '';

// Safe way to communicate with background script
function loadSnippets() {
  try {
    // Try to send message to background script
    chrome.runtime.sendMessage({ action: 'getSnippets' }, function(response) {
      if (response && response.snippets) {
        snippets = response.snippets;
        triggerKey = response.triggerKey || 'Tab';
        console.log('✅ Text Expander loaded with', Object.keys(snippets).length, 'snippets');
      }
    });
  } catch (e) {
    console.log('Waiting for extension context...');
    // Retry after a delay
    setTimeout(loadSnippets, 500);
  }
}

// Listen for messages from background
try {
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'snippetsUpdated') {
      snippets = request.snippets;
      triggerKey = request.triggerKey || 'Tab';
    }
  });
} catch (e) {
  // Ignore errors
}

// Start loading snippets
setTimeout(loadSnippets, 100);

// ===== UNIVERSAL ELEMENT DETECTION =====
function findAllEditableElements() {
  const elements = new Set();
  
  // WhatsApp specific selectors
  const whatsappSelectors = [
    'div[contenteditable="true"][data-tab="10"]',
    'div[contenteditable="true"][role="textbox"]',
    '.copyable-text.selectable-text',
    'div[spellcheck="true"]',
    'div[contenteditable="true"]',
    '[role="textbox"]',
    'div[aria-placeholder]',
    'div[aria-multiline="true"]',
    'div[data-testid="conversation-compose-message-input"]',
    'div[title*="Type a message"]',
    'div[aria-label*="Type a message"]',
    'div[placeholder*="Type a message"]'
  ];
  
  // Try WhatsApp selectors first
  whatsappSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => elements.add(el));
    } catch (e) {}
  });
  
  // Standard input selectors
  const standardSelectors = [
    'input[type="text"]',
    'input[type="search"]',
    'input[type="email"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input:not([type])',
    'textarea',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[role="textbox"]',
    '[role="combobox"]',
    '[role="searchbox"]',
    '.editable',
    '.text-input',
    '.public-DraftEditor-content', // Draft.js (WhatsApp, LinkedIn)
    '[data-lexical-editor]',
    '[data-slate-editor]',
    '[g_editable="true"]', // Gmail
    'div[aria-multiline="true"]',
    'div[contenteditable]'
  ];
  
  standardSelectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => elements.add(el));
    } catch (e) {}
  });
  
  // Also check for any element with contenteditable
  document.querySelectorAll('[contenteditable]').forEach(el => elements.add(el));
  
  // Check all elements for editable attributes
  document.querySelectorAll('*').forEach(el => {
    if (el.isContentEditable || 
        el.getAttribute('contenteditable') === 'true' ||
        el.getAttribute('role') === 'textbox' ||
        el.getAttribute('role') === 'combobox' ||
        el.getAttribute('role') === 'searchbox' ||
        el.classList.contains('editable') ||
        el.classList.contains('selectable-text')) {
      elements.add(el);
    }
  });
  
  return Array.from(elements);
}

// ===== ATTACH TO EVERYTHING =====
function attachToAllFields() {
  const fields = findAllEditableElements();
  
  fields.forEach(field => {
    if (!field.hasAttribute('data-te-attached')) {
      field.setAttribute('data-te-attached', 'true');
      
      // Use capturing phase for better compatibility
      field.addEventListener('input', handleFieldInput, true);
      field.addEventListener('keydown', handleFieldKeyDown, true);
      field.addEventListener('keyup', handleFieldKeyUp, true);
      field.addEventListener('beforeinput', handleFieldInput, true);
      
      // Special for contenteditable
      if (field.isContentEditable || field.getAttribute('contenteditable')) {
        // Monitor for changes
        const observer = new MutationObserver((mutations) => {
          mutations.forEach(() => {
            checkFieldForSnippet(field);
          });
        });
        
        observer.observe(field, { 
          childList: true, 
          characterData: true, 
          subtree: true,
          characterDataOldValue: true
        });
      }
    }
  });
}

// ===== HANDLER FUNCTIONS =====
function handleFieldInput(e) {
  // Debounce check
  clearTimeout(field._checkTimeout);
  field._checkTimeout = setTimeout(() => checkFieldForSnippet(e.target), 50);
}

function handleFieldKeyUp(e) {
  // Check on keyup as well
  clearTimeout(field._checkTimeout);
  field._checkTimeout = setTimeout(() => checkFieldForSnippet(e.target), 50);
}

function handleFieldKeyDown(e) {
  const field = e.target;
  
  // Handle trigger key
  if (e.key === triggerKey) {
    // Check if there's an active suggestion for this field
    if (activeSuggestion && activeSuggestion.field === field) {
      e.preventDefault();
      e.stopPropagation();
      
      // Expand the snippet
      expandSnippet(field, activeSuggestion.shortcut);
      removeSuggestion();
      return false;
    }
  }
  
  // Check for backspace/delete to remove suggestion
  if (e.key === 'Backspace' || e.key === 'Delete') {
    clearTimeout(field._checkTimeout);
    field._checkTimeout = setTimeout(() => checkFieldForSnippet(field), 100);
  }
  
  // Escape to dismiss
  if (e.key === 'Escape' && activeSuggestion && activeSuggestion.field === field) {
    removeSuggestion();
    e.preventDefault();
  }
}

// ===== GET TEXT FROM FIELD =====
function getFieldText(field) {
  try {
    if (!field) return '';
    
    // Check if it's a WhatsApp message input
    if (field.classList.contains('selectable-text') || 
        field.getAttribute('data-tab') === '10' ||
        field.closest('[data-testid="conversation-compose-message-input"]')) {
      
      // WhatsApp stores text in spans
      const spans = field.querySelectorAll('span');
      let text = '';
      spans.forEach(span => {
        if (span.textContent && !span.querySelector('img')) {
          text += span.textContent;
        }
      });
      return text || field.textContent || field.innerText || '';
    }
    
    // Standard contenteditable
    if (field.isContentEditable || field.getAttribute('contenteditable') === 'true') {
      return field.innerText || field.textContent || '';
    }
    
    // Input/textarea
    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
      return field.value || '';
    }
    
    // Fallback
    return field.innerText || field.textContent || field.value || '';
  } catch (e) {
    return '';
  }
}

// ===== SET FIELD TEXT =====
function setFieldText(field, newText) {
  try {
    // Special handling for WhatsApp
    if (field.classList.contains('selectable-text') || 
        field.getAttribute('data-tab') === '10' ||
        field.closest('[data-testid="conversation-compose-message-input"]')) {
      
      // WhatsApp uses a complex structure - clear and insert text
      while (field.firstChild) {
        field.removeChild(field.firstChild);
      }
      
      // Create text nodes for each line
      const lines = newText.split('\n');
      lines.forEach((line, index) => {
        const span = document.createElement('span');
        span.textContent = line;
        field.appendChild(span);
        if (index < lines.length - 1) {
          field.appendChild(document.createElement('br'));
        }
      });
      
      // Trigger events
      field.dispatchEvent(new InputEvent('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      return true;
    }
    
    // Standard contenteditable
    if (field.isContentEditable || field.getAttribute('contenteditable') === 'true') {
      field.innerText = newText;
      
      field.dispatchEvent(new InputEvent('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(field);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      
      return true;
    }
    
    // Input/textarea
    if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
      field.value = newText;
      
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      
      field.selectionStart = field.selectionEnd = newText.length;
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error setting text:', e);
    return false;
  }
}

// ===== CHECK FIELD FOR SNIPPETS =====
function checkFieldForSnippet(field) {
  if (!field || Object.keys(snippets).length === 0) return;
  
  try {
    const text = getFieldText(field);
    if (!text) return;
    
    // Look for snippets at the end
    for (let shortcut in snippets) {
      // Check if text ends with the shortcut
      if (text.endsWith(shortcut) || 
          text.endsWith(' ' + shortcut) || 
          text.endsWith('\n' + shortcut)) {
        
        showModernSuggestion(field, shortcut, snippets[shortcut]);
        return;
      }
      
      // Also check if it's the last word
      const words = text.split(/[\s\n]+/);
      const lastWord = words[words.length - 1];
      if (lastWord === shortcut) {
        showModernSuggestion(field, shortcut, snippets[shortcut]);
        return;
      }
    }
    
    // If no match found, remove suggestion
    if (activeSuggestion && activeSuggestion.field === field) {
      removeSuggestion();
    }
  } catch (e) {
    // Ignore errors
  }
}

// ===== MODERN SUGGESTION UI =====
function showModernSuggestion(field, shortcut, snippet) {
  // Remove any existing suggestion
  removeSuggestion();
  
  // Create suggestion element
  const suggestion = document.createElement('div');
  suggestion.className = 'te-floating-suggestion';
  
  // Get snippet preview
  const preview = snippet.replace(/\n/g, ' ↵ ').substring(0, 40);
  
  suggestion.innerHTML = `
    <div class="te-suggestion-content" style="display: flex; align-items: center; gap: 8px; padding: 8px 16px;">
      <span style="background: #667eea; padding: 4px 10px; border-radius: 100px; font-weight: bold;">${shortcut}</span>
      <span style="color: #a0a0a0;">→</span>
      <span style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${preview}${snippet.length > 40 ? '…' : ''}</span>
      <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 100px; font-size: 11px;">[${triggerKey}]</span>
    </div>
  `;
  
  // Style the suggestion
  Object.assign(suggestion.style, {
    position: 'absolute',
    zIndex: '2147483647',
    background: 'rgba(33, 33, 33, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '100px',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    color: 'white',
    animation: 'teSlideUp 0.2s ease-out',
    pointerEvents: 'none'
  });
  
  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes teSlideUp {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  
  // Position near the field
  positionSuggestion(suggestion, field);
  
  document.body.appendChild(suggestion);
  
  activeSuggestion = { field, shortcut, element: suggestion };
  
  // Auto-remove after 2 seconds
  setTimeout(() => {
    if (activeSuggestion && activeSuggestion.element === suggestion) {
      removeSuggestion();
    }
  }, 2000);
}

function positionSuggestion(suggestion, field) {
  try {
    const rect = field.getBoundingClientRect();
    
    // Try to get cursor position
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const cursorRect = range.getBoundingClientRect();
      
      if (cursorRect.width > 0 || cursorRect.height > 0) {
        suggestion.style.top = (window.scrollY + cursorRect.bottom + 5) + 'px';
        suggestion.style.left = (window.scrollX + cursorRect.left) + 'px';
        return;
      }
    }
    
    // Fallback to field position
    suggestion.style.top = (window.scrollY + rect.bottom + 5) + 'px';
    suggestion.style.left = (window.scrollX + rect.left) + 'px';
  } catch (e) {
    suggestion.style.bottom = '20px';
    suggestion.style.right = '20px';
    suggestion.style.position = 'fixed';
  }
}

function removeSuggestion() {
  if (activeSuggestion && activeSuggestion.element) {
    activeSuggestion.element.remove();
    activeSuggestion = null;
  }
}

// ===== EXPAND SNIPPET =====
function expandSnippet(field, shortcut) {
  try {
    const snippet = snippets[shortcut];
    if (!snippet) return false;
    
    const currentText = getFieldText(field);
    
    // Replace the shortcut
    let newText = currentText;
    
    if (currentText.endsWith(shortcut)) {
      newText = currentText.slice(0, -shortcut.length) + snippet;
    } else if (currentText.endsWith(' ' + shortcut)) {
      newText = currentText.slice(0, -(shortcut.length + 1)) + ' ' + snippet;
    } else if (currentText.endsWith('\n' + shortcut)) {
      newText = currentText.slice(0, -(shortcut.length + 1)) + '\n' + snippet;
    } else {
      // Replace the last occurrence
      const lastIndex = currentText.lastIndexOf(shortcut);
      if (lastIndex !== -1) {
        newText = currentText.substring(0, lastIndex) + snippet + 
                 currentText.substring(lastIndex + shortcut.length);
      }
    }
    
    // Set the new text
    const success = setFieldText(field, newText);
    
    if (success) {
      // Visual feedback
      field.style.backgroundColor = 'rgba(76, 175, 80, 0.2)';
      field.style.transition = 'background-color 0.2s';
      setTimeout(() => {
        field.style.backgroundColor = '';
      }, 200);
      
      console.log('✅ Expanded:', shortcut);
    }
    
    return success;
  } catch (e) {
    console.error('Expansion failed:', e);
    return false;
  }
}

// ===== WATCH FOR DYNAMIC CHANGES =====
// Aggressive reattachment
setInterval(attachToAllFields, 1000);

// MutationObserver for new elements
const observer = new MutationObserver(() => {
  setTimeout(attachToAllFields, 100);
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Initial attachment
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(attachToAllFields, 500);
  setTimeout(attachToAllFields, 1500);
  setTimeout(attachToAllFields, 3000);
});

attachToAllFields();