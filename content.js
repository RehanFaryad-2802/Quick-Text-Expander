class DOMEditorContent {
  constructor() {
    this.isEditorActive = false;
    this.isPickerActive = false;
    this.hoveredElement = null;
    this.highlightStyle = null;
    this.settings = {};
    this.selectedElement = null;
    this.escHandler = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.applySavedStyles();
    this.initMessageListener();
    this.checkPickerState();
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'autoApply', 'highlightOnHover', 'highlightColor', 'savedStyles', 'isPickerActive'
    ]);
    this.settings = settings;
  }

  async applySavedStyles() {
    const { savedStyles = [], autoApply = false } = this.settings;
    
    if (!autoApply) return;
    
    const currentUrl = window.location.href;
    const currentDomain = window.location.hostname;
    
    savedStyles.forEach(style => {
      if (currentUrl.includes(style.domain) || currentDomain.includes(style.domain)) {
        this.applyCSS(style.target, style.css, true);
      }
    });
  }

  initMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'toggleEditor':
          this.toggleEditor();
          sendResponse({ success: true });
          break;
        case 'startPicker':
          this.startElementPicker();
          sendResponse({ success: true });
          break;
        case 'previewStyle':
          const previewSuccess = this.applyCSS(request.target, request.css, false);
          sendResponse({ success: previewSuccess });
          break;
        case 'applyStyle':
          const applySuccess = this.applyCSS(request.target, request.css, true);
          sendResponse({ success: applySuccess });
          break;
      }
      return true;
    });
  }

  async checkPickerState() {
    // Check if picker was activated
    const { isPickerActive } = await chrome.storage.local.get('isPickerActive');
    if (isPickerActive) {
      setTimeout(() => this.startElementPicker(), 100);
    }
  }

  toggleEditor() {
    this.isEditorActive = !this.isEditorActive;
    
    if (this.isEditorActive) {
      this.enableEditor();
    } else {
      this.disableEditor();
    }
  }

  enableEditor() {
    this.disableEditor(); // Clean up first
    
    // Use capturing phase to ensure we get events first
    document.addEventListener('mouseover', this.onMouseOver.bind(this), { capture: true, passive: true });
    document.addEventListener('mouseout', this.onMouseOut.bind(this), { capture: true, passive: true });
    document.addEventListener('click', this.onClick.bind(this), { capture: true, passive: false });
    
    this.createHighlightStyle();
  }

  disableEditor() {
    document.removeEventListener('mouseover', this.onMouseOver.bind(this), true);
    document.removeEventListener('mouseout', this.onMouseOut.bind(this), true);
    document.removeEventListener('click', this.onClick.bind(this), true);
    
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }
    
    if (this.highlightStyle) {
      this.highlightStyle.remove();
      this.highlightStyle = null;
    }
    
    if (this.hoveredElement) {
      this.hoveredElement.classList.remove('dom-editor-hover');
      this.hoveredElement = null;
    }
    
    if (this.selectedElement) {
      this.selectedElement.classList.remove('dom-editor-selected');
      this.selectedElement = null;
    }
    
    // Remove notification
    const notification = document.getElementById('dom-editor-picker-notification');
    if (notification) notification.remove();
    
    this.isPickerActive = false;
    chrome.storage.local.set({ isPickerActive: false });
  }

  createHighlightStyle() {
    this.highlightStyle = document.createElement('style');
    this.highlightStyle.id = 'dom-editor-highlight-styles';
    this.highlightStyle.textContent = `
      .dom-editor-hover {
        outline: 3px dashed ${this.settings.highlightColor || '#ff6b6b'} !important;
        outline-offset: 2px !important;
        cursor: crosshair !important;
        position: relative;
        z-index: 2147483647 !important;
        pointer-events: auto !important;
      }
      
      .dom-editor-selected {
        outline: 4px solid ${this.settings.highlightColor || '#ff6b6b'} !important;
        outline-offset: 3px !important;
        cursor: crosshair !important;
        position: relative;
        z-index: 2147483647 !important;
        animation: dom-editor-pulse 1s infinite;
        pointer-events: auto !important;
      }
      
      @keyframes dom-editor-pulse {
        0% { outline-color: ${this.settings.highlightColor || '#ff6b6b'}; }
        50% { outline-color: #ffffff; }
        100% { outline-color: ${this.settings.highlightColor || '#ff6b6b'}; }
      }
      
      /* Disable pointer events on everything except our hovered element */
      .dom-editor-picker-active * {
        pointer-events: none !important;
      }
      
      .dom-editor-picker-active .dom-editor-hover {
        pointer-events: auto !important;
      }
    `;
    document.head.appendChild(this.highlightStyle);
  }

  startElementPicker() {
    this.isEditorActive = true;
    this.isPickerActive = true;
    this.enableEditor();
    
    // Add class to body to enable picker mode
    document.body.classList.add('dom-editor-picker-active');
    
    // Show notification
    this.showPickerNotification();
  }

  showPickerNotification() {
    // Remove existing notification
    const existing = document.getElementById('dom-editor-picker-notification');
    if (existing) existing.remove();
    
    // Create a notification overlay
    const notification = document.createElement('div');
    notification.id = 'dom-editor-picker-notification';
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4a6fa5;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 300px;
      animation: dom-editor-slideIn 0.3s ease-out;
      pointer-events: none;
    `;
    
    notification.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">DOM Editor - Element Picker</div>
      <div>Hover and click on any element to select it</div>
      <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">
        Press ESC to cancel
      </div>
    `;
    
    // Add animation style
    const animationStyle = document.createElement('style');
    animationStyle.textContent = `
      @keyframes dom-editor-slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(animationStyle);
    
    document.body.appendChild(notification);
    
    // Add ESC key listener
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.disableEditor();
        document.body.classList.remove('dom-editor-picker-active');
      }
    };
    
    document.addEventListener('keydown', this.escHandler);
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
      if (animationStyle.parentNode) {
        animationStyle.remove();
      }
    }, 15000);
  }

  onMouseOver(e) {
    if (!this.isEditorActive || !this.isPickerActive) return;
    
    e.stopImmediatePropagation();
    e.preventDefault();
    
    const element = e.target;
    
    // Skip body, html, and our own notification
    if (element === document.body || 
        element === document.documentElement ||
        element.id === 'dom-editor-picker-notification') {
      return;
    }
    
    // Skip if element is the same
    if (this.hoveredElement === element) return;
    
    this.removeHover();
    this.hoveredElement = element;
    element.classList.add('dom-editor-hover');
  }

  onMouseOut(e) {
    if (!this.isEditorActive || !this.isPickerActive) return;
    
    if (e.target === this.hoveredElement) {
      this.removeHover();
    }
  }

  onClick(e) {
    if (!this.isEditorActive || !this.isPickerActive) return;
    
    e.stopImmediatePropagation();
    e.preventDefault();
    
    const element = e.target;
    
    // Don't select our notification
    if (element.id === 'dom-editor-picker-notification') {
      return;
    }
    
    const selector = this.getElementSelector(element);
    
    console.log('Selected element:', element);
    console.log('Generated selector:', selector);
    
    // Store the selected selector
    chrome.storage.local.set({
      lastSelectedElement: selector,
      isPickerActive: false
    }).then(() => {
      console.log('Selector saved to storage:', selector);
    });
    
    // Show selection feedback
    this.showSelectionFeedback(element, selector);
    
    // Clean up
    this.disableEditor();
    document.body.classList.remove('dom-editor-picker-active');
    
    // Send message to popup if it's open
    try {
      chrome.runtime.sendMessage({
        action: 'elementSelected',
        selector: selector,
        url: window.location.href
      });
    } catch (error) {
      // Popup is closed, that's fine
      console.log('Popup closed, selector saved to storage');
    }
  }

  showSelectionFeedback(element, selector) {
    // Highlight the selected element
    element.classList.add('dom-editor-selected');
    
    // Create a temporary notification
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: #2ecc71;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      z-index: 2147483647;
      font-family: monospace;
      font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      max-width: 400px;
      animation: dom-editor-slideIn 0.3s ease-out;
      pointer-events: none;
    `;
    
    feedback.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 4px;">✓ Element Selected!</div>
      <div style="word-break: break-all; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; margin: 8px 0;">
        ${selector}
      </div>
      <div style="font-size: 12px; opacity: 0.9;">
        Return to the extension popup to use this selector
      </div>
    `;
    
    document.body.appendChild(feedback);
    
    // Remove after 5 seconds
    setTimeout(() => {
      if (feedback.parentNode) {
        feedback.remove();
      }
      element.classList.remove('dom-editor-selected');
    }, 5000);
  }

  removeHover() {
    if (this.hoveredElement) {
      this.hoveredElement.classList.remove('dom-editor-hover');
      this.hoveredElement = null;
    }
  }

  getElementSelector(element) {
    if (!element || !element.tagName) return '';

    // Try ID first (most specific)
    if (element.id && document.querySelectorAll(`#${CSS.escape(element.id)}`).length === 1) {
      return `#${CSS.escape(element.id)}`;
    }

    // Try data attributes
    const dataAttrs = Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `[${attr.name}="${CSS.escape(attr.value)}"]`);
    
    if (dataAttrs.length > 0) {
      const selector = `${element.tagName.toLowerCase()}${dataAttrs.join('')}`;
      if (document.querySelectorAll(selector).length === 1) {
        return selector;
      }
    }

    // Try classes
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(/\s+/).filter(c => c.length > 0);
      if (classes.length > 0) {
        const classSelector = classes.map(c => `.${CSS.escape(c)}`).join('');
        const tagName = element.tagName.toLowerCase();
        const fullSelector = `${tagName}${classSelector}`;
        
        // Check if this selector is unique
        const matches = document.querySelectorAll(fullSelector);
        if (matches.length === 1) {
          return fullSelector;
        }
        
        // Try with fewer classes
        for (let i = classes.length; i > 0; i--) {
          const partialClasses = classes.slice(0, i);
          const partialSelector = `${tagName}${partialClasses.map(c => `.${CSS.escape(c)}`).join('')}`;
          const partialMatches = document.querySelectorAll(partialSelector);
          if (partialMatches.length === 1) {
            return partialSelector;
          }
        }
      }
    }

    // Build path with parent hierarchy
    const path = [];
    let current = element;
    
    for (let i = 0; i < 5 && current && current !== document.body; i++) {
      let selector = current.tagName.toLowerCase();
      
      // Add ID if exists
      if (current.id) {
        selector = `#${CSS.escape(current.id)}`;
        path.unshift(selector);
        break;
      }
      
      // Add classes if exist
      if (current.className && typeof current.className === 'string') {
        const classes = current.className.split(/\s+/).filter(c => c.length > 0);
        if (classes.length > 0) {
          selector += classes.map(c => `.${CSS.escape(c)}`).join('');
        }
      }
      
      // Add :nth-child if needed
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children);
        const index = siblings.indexOf(current) + 1;
        if (index > 1 || siblings.length > 1) {
          selector += `:nth-child(${index})`;
        }
      }
      
      path.unshift(selector);
      current = parent;
    }
    
    const fullPath = path.join(' > ');
    return fullPath || element.tagName.toLowerCase();
  }

  applyCSS(selector, css, persistent = false) {
    try {
      if (!selector || !selector.trim()) {
        console.error('Invalid selector:', selector);
        return false;
      }

      // Clean and format CSS
      let cssText = css.trim();
      
      // For background-image URL issue: You need to properly escape the URL
      // The URL you provided has special characters that need escaping
      if (cssText.includes('background-image') && cssText.includes('url(')) {
        // Extract and fix the URL
        const urlMatch = cssText.match(/url\(["']?(.*?)["']?\)/);
        if (urlMatch) {
          const originalUrl = urlMatch[1];
          // Properly escape the URL
          const fixedUrl = originalUrl.replace(/(["'])/g, '\\$1');
          cssText = cssText.replace(originalUrl, fixedUrl);
          
          // Also ensure the URL is wrapped in quotes
          if (!urlMatch[0].includes('"') && !urlMatch[0].includes("'")) {
            cssText = cssText.replace(/url\(([^"']+)\)/, 'url("$1")');
          }
        }
      }
      
      // Create style ID
      const styleId = persistent ? 
        `dom-editor-persistent-${btoa(selector).replace(/[^a-zA-Z0-9]/g, '')}` :
        `dom-editor-temp-${btoa(selector).replace(/[^a-zA-Z0-9]/g, '')}`;
      
      // Remove existing style
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();

      // Create new style
      const style = document.createElement('style');
      style.id = styleId;
      
      // Check if CSS is a full rule or just properties
      if (cssText.includes('{') && cssText.includes('}')) {
        // Full CSS rule
        style.textContent = cssText;
      } else {
        // Inline style properties - ensure it ends with semicolon
        if (!cssText.endsWith(';')) {
          cssText += ';';
        }
        style.textContent = `${selector} { ${cssText} }`;
      }
      
      console.log('Applying CSS:', { selector, css: cssText, styleId });
      document.head.appendChild(style);
      
      // If temporary, remove after 10 seconds
      if (!persistent) {
        setTimeout(() => {
          if (style.parentNode) {
            style.remove();
          }
        }, 10000);
      }
      
      return true;
    } catch (error) {
      console.error('Error applying CSS:', error);
      return false;
    }
  }
}

// Initialize only once
if (!window.domEditorInitialized) {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.domEditor = new DOMEditorContent();
      window.domEditorInitialized = true;
    });
  } else {
    window.domEditor = new DOMEditorContent();
    window.domEditorInitialized = true;
  }
}