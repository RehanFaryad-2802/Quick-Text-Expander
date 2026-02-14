let snippets = {};
let triggerKey = 'Tab';
let activeSuggestion = null;
let lastInput = '';
let lastInputTime = 0;

// Load snippets and settings
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
});

// Use multiple event listeners for better compatibility
document.addEventListener('input', handleInput, true);
document.addEventListener('keydown', handleKeyDown, true);
document.addEventListener('keyup', handleKeyUp, true);

function handleInput(e) {
  const target = e.target;
  lastInputTime = Date.now();
  
  // Check if it's an editable element
  if (isEditableElement(target)) {
    setTimeout(() => checkForSnippet(target), 50);
  }
}

function handleKeyDown(e) {
  // Special handling for different trigger keys
  if (e.key === triggerKey) {
    if (activeSuggestion) {
      e.preventDefault();
      e.stopPropagation();
      expandSnippet(activeSuggestion.element, activeSuggestion.shortcut);
      removeSuggestion();
    } else if (triggerKey === 'Tab') {
      // Let Tab work normally if no suggestion
      // But we'll check again after a tiny delay
      setTimeout(() => {
        if (activeSuggestion) {
          expandSnippet(activeSuggestion.element, activeSuggestion.shortcut);
          removeSuggestion();
        }
      }, 10);
    }
  } else if (e.key === 'Escape' && activeSuggestion) {
    e.preventDefault();
    removeSuggestion();
  }
}

function handleKeyUp(e) {
  // For sites that might need keyup detection
  const target = e.target;
  if (isEditableElement(target) && Date.now() - lastInputTime > 10) {
    setTimeout(() => checkForSnippet(target), 50);
  }
}

function isEditableElement(element) {
  if (!element) return false;
  
  // Check various editable states
  return element.isContentEditable || 
         element.tagName === 'INPUT' || 
         element.tagName === 'TEXTAREA' ||
         element.getAttribute('contenteditable') === 'true' ||
         element.role === 'textbox' ||
         element.classList.contains('editable') ||
         // WhatsApp Web specific
         element.getAttribute('data-tab') === '10' ||
         // Gmail compose specific
         element.getAttribute('g_editable') === 'true' ||
         element.getAttribute('role') === 'textbox';
}

function getElementText(element) {
  try {
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      return element.textContent || element.innerText || '';
    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return element.value || '';
    } else {
      // Try to get text from various properties
      return element.textContent || element.innerText || element.value || '';
    }
  } catch (e) {
    return '';
  }
}

function setElementText(element, newText) {
  try {
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
      // For contenteditable elements
      element.textContent = newText;
      
      // Trigger appropriate events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } else if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      // For input/textarea elements
      const start = element.selectionStart;
      element.value = newText;
      
      // Trigger events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      
      // Move cursor to end
      element.selectionStart = element.selectionEnd = newText.length;
    } else {
      // Fallback for other elements
      element.textContent = newText;
    }
    
    return true;
  } catch (e) {
    console.error('Error setting text:', e);
    return false;
  }
}

function getLastWord(text) {
  if (!text) return '';
  
  // Get the last word, considering various delimiters
  const matches = text.match(/(?:^|\s|,|\.|;|:|\?|!)(;[^\s,\.;:?!]+)$/);
  if (matches) {
    return matches[1].trim();
  }
  
  // Alternative: just get last word if it starts with ;
  const words = text.split(/[\s\n\t\r,\.;:?!]+/);
  const lastWord = words[words.length - 1];
  return lastWord && lastWord.startsWith(';') ? lastWord : '';
}

function checkForSnippet(element) {
  if (!element) return;
  
  const text = getElementText(element);
  const lastWord = getLastWord(text);
  
  if (lastWord && snippets[lastWord]) {
    showSuggestion(element, lastWord, snippets[lastWord]);
  } else {
    removeSuggestion();
  }
}

function showSuggestion(element, shortcut, snippet) {
  removeSuggestion();
  
  // Create suggestion popup with better UI
  const suggestion = document.createElement('div');
  suggestion.className = 'text-expander-suggestion';
  
  // Add icon
  const icon = document.createElement('span');
  icon.className = 'suggestion-icon';
  icon.textContent = '⚡';
  
  // Add content
  const content = document.createElement('span');
  content.className = 'suggestion-content';
  
  const shortcutSpan = document.createElement('span');
  shortcutSpan.className = 'suggestion-shortcut';
  shortcutSpan.textContent = shortcut;
  
  const previewSpan = document.createElement('span');
  previewSpan.className = 'suggestion-preview';
  const preview = snippet.replace(/\n/g, '↵ ').substring(0, 40);
  previewSpan.textContent = ` → ${preview}${snippet.length > 40 ? '…' : ''}`;
  
  // Add trigger hint
  const hintSpan = document.createElement('span');
  hintSpan.className = 'suggestion-hint';
  hintSpan.textContent = ` [${triggerKey} to expand]`;
  
  content.appendChild(shortcutSpan);
  content.appendChild(previewSpan);
  content.appendChild(hintSpan);
  
  suggestion.appendChild(icon);
  suggestion.appendChild(content);
  
  // Position near the element
  positionSuggestion(suggestion, element);
  
  document.body.appendChild(suggestion);
  
  activeSuggestion = {
    element: element,
    shortcut: shortcut,
    div: suggestion
  };
}

function positionSuggestion(suggestion, element) {
  try {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Default position below the element
    let top = window.scrollY + rect.bottom + 5;
    let left = window.scrollX + rect.left;
    
    // Adjust if would go off screen
    const suggestionWidth = 400; // Approximate width
    const suggestionHeight = 40; // Approximate height
    
    if (left + suggestionWidth > viewportWidth) {
      left = viewportWidth - suggestionWidth - 10;
    }
    
    if (top + suggestionHeight > viewportHeight + window.scrollY) {
      top = window.scrollY + rect.top - suggestionHeight - 5;
    }
    
    suggestion.style.position = 'absolute';
    suggestion.style.top = top + 'px';
    suggestion.style.left = left + 'px';
    suggestion.style.zIndex = '10000';
  } catch (e) {
    // Fallback positioning
    suggestion.style.position = 'fixed';
    suggestion.style.bottom = '20px';
    suggestion.style.left = '20px';
  }
}

function removeSuggestion() {
  if (activeSuggestion && activeSuggestion.div) {
    activeSuggestion.div.remove();
    activeSuggestion = null;
  }
}

function expandSnippet(element, shortcut) {
  const snippet = snippets[shortcut];
  if (!snippet) return false;
  
  const currentText = getElementText(element);
  
  // Find and replace the shortcut
  let newText = currentText;
  const shortcutIndex = currentText.lastIndexOf(shortcut);
  
  if (shortcutIndex !== -1) {
    newText = currentText.substring(0, shortcutIndex) + 
              snippet + 
              currentText.substring(shortcutIndex + shortcut.length);
  } else {
    // If we can't find exact position, use regex
    newText = currentText.replace(new RegExp(shortcut + '$'), snippet);
  }
  
  // Set the new text
  const success = setElementText(element, newText);
  
  if (success) {
    // Flash effect to show expansion happened
    flashElement(element);
  }
  
  return success;
}

function flashElement(element) {
  const originalBg = element.style.backgroundColor;
  element.style.backgroundColor = '#e6ffe6';
  element.style.transition = 'background-color 0.3s';
  
  setTimeout(() => {
    element.style.backgroundColor = originalBg;
  }, 300);
}

// Special handler for shadow DOM (WhatsApp, etc.)
function findShadowRoots(element) {
  if (!element) return [];
  
  const roots = [];
  if (element.shadowRoot) {
    roots.push(element.shadowRoot);
  }
  
  for (let child of element.children) {
    roots.push(...findShadowRoots(child));
  }
  
  return roots;
}

// Watch for dynamically added elements
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.type === 'childList') {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) { // Element node
          if (isEditableElement(node)) {
            // New editable element found
          }
        }
      });
    }
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});