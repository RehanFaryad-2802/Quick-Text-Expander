let snippets = {};
let triggerKey = 'Tab'; // Default trigger key
let activeSuggestion = null;

// Load snippets and settings from storage
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

// Track input events
document.addEventListener('input', function(e) {
  const target = e.target;
  if (isEditableElement(target)) {
    checkForSnippet(target);
  }
});

// Track keydown for trigger key
document.addEventListener('keydown', function(e) {
  if (e.key === triggerKey && activeSuggestion) {
    e.preventDefault();
    expandSnippet(activeSuggestion.element, activeSuggestion.shortcut);
    removeSuggestion();
  } else if (e.key === 'Escape' && activeSuggestion) {
    removeSuggestion();
  }
});

function isEditableElement(element) {
  return element.isContentEditable || 
         element.tagName === 'INPUT' || 
         element.tagName === 'TEXTAREA';
}

function checkForSnippet(element) {
  const text = getElementText(element);
  const lastWord = getLastWord(text);
  
  if (lastWord && snippets[lastWord]) {
    showSuggestion(element, lastWord, snippets[lastWord]);
  } else {
    removeSuggestion();
  }
}

function getElementText(element) {
  if (element.isContentEditable) {
    return element.textContent;
  } else {
    return element.value;
  }
}

function getLastWord(text) {
  if (!text) return '';
  
  // Check if the last character is a space or new line
  const lastChar = text[text.length - 1];
  if (lastChar === ' ' || lastChar === '\n' || lastChar === '\t') {
    return '';
  }
  
  const words = text.split(/[\s\n\t]+/);
  const lastWord = words[words.length - 1];
  
  // Only trigger on words starting with ';'
  return lastWord.startsWith(';') ? lastWord : '';
}

function showSuggestion(element, shortcut, snippet) {
  removeSuggestion();
  
  const suggestion = document.createElement('div');
  suggestion.className = 'text-expander-suggestion';
  suggestion.textContent = `↹ ${shortcut} → ${snippet.substring(0, 30)}${snippet.length > 30 ? '...' : ''}`;
  
  const rect = element.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(element);
  const fontSize = computedStyle.fontSize;
  const lineHeight = computedStyle.lineHeight;
  
  suggestion.style.position = 'absolute';
  suggestion.style.top = (window.scrollY + rect.bottom + 5) + 'px';
  suggestion.style.left = (window.scrollX + rect.left) + 'px';
  suggestion.style.fontSize = fontSize;
  
  document.body.appendChild(suggestion);
  
  activeSuggestion = {
    element: element,
    shortcut: shortcut,
    div: suggestion
  };
}

function removeSuggestion() {
  if (activeSuggestion && activeSuggestion.div) {
    activeSuggestion.div.remove();
    activeSuggestion = null;
  }
}

function expandSnippet(element, shortcut) {
  const snippet = snippets[shortcut];
  if (!snippet) return;
  
  const currentText = getElementText(element);
  const words = currentText.split(/(?=[\s\n\t])|(?<=[\s\n\t])/);
  
  // Find and replace the last occurrence of the shortcut
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].trim() === shortcut) {
      words[i] = snippet;
      break;
    }
  }
  
  const newText = words.join('');
  
  if (element.isContentEditable) {
    element.textContent = newText;
    // Move cursor to end
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    element.value = newText;
    // Move cursor to end
    element.selectionStart = element.selectionEnd = newText.length;
  }
  
  // Trigger input event
  element.dispatchEvent(new Event('input', { bubbles: true }));
}