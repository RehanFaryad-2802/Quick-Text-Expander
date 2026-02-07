class DOMEditor {
  constructor() {
    this.isPickerMode = false;
    this.initElements();
    this.loadSettings();
    this.loadSavedStyles();
    this.initEventListeners();
    this.setupPickerListener();
    this.checkForPickedElement()
  }

  initElements() {
    // Inputs
    this.domainInput = document.getElementById('domainInput');
    this.targetInput = document.getElementById('targetInput');
    this.cssInput = document.getElementById('cssInput');
    this.searchInput = document.createElement('input'); // Will be added dynamically
    
    // Buttons
    this.saveBtn = document.getElementById('saveBtn');
    this.previewBtn = document.getElementById('previewBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.useCurrentBtn = document.getElementById('useCurrent');
    this.pickElementBtn = document.getElementById('pickElement');
    this.themeToggle = document.getElementById('themeToggle');
    this.openSettings = document.getElementById('openSettings');
    this.toggleEditorBtn = document.getElementById('toggleEditor');
    
    // Sections
    this.editorSection = document.getElementById('editorSection');
    this.settingsSection = document.getElementById('settingsSection');
    this.savedStylesContainer = document.getElementById('savedStyles');
    this.targetGroups = document.getElementById('targetGroups');
    
    // Settings
    this.autoApply = document.getElementById('autoApply');
    this.highlightOnHover = document.getElementById('highlightOnHover');
    this.highlightColor = document.getElementById('highlightColor');
    this.exportBtn = document.getElementById('exportBtn');
    this.importBtn = document.getElementById('importBtn');
    this.resetBtn = document.getElementById('resetBtn');
    
    this.status = document.getElementById('status');
    
    // Create search input
    this.createSearchBar();
  }

  async restoreFromPicker() {
  // Check for picked element
  const { lastSelectedElement } = await chrome.storage.local.get('lastSelectedElement');
  
  if (lastSelectedElement) {
    this.targetInput.value = lastSelectedElement;
    
    // Restore any temporarily saved form data
    const { tempDomain, tempTarget, tempCSS } = await chrome.storage.local.get([
      'tempDomain', 'tempTarget', 'tempCSS'
    ]);
    
    if (tempDomain && !this.domainInput.value) {
      this.domainInput.value = tempDomain;
    }
    if (tempTarget && !this.targetInput.value) {
      this.targetInput.value = tempTarget;
    }
    if (tempCSS && !this.cssInput.value) {
      this.cssInput.value = tempCSS;
    }
    
    // Clear temporary storage
    await chrome.storage.local.remove(['tempDomain', 'tempTarget', 'tempCSS', 'lastSelectedElement']);
    
    this.showStatus('Element selected!', 'success');
  }
  
  // Reset picker button state
  this.resetPickerButton();
}

  createSearchBar() {
    const savedStylesSection = document.querySelector('.section:last-child');
    const header = savedStylesSection.querySelector('h3');
    
    const searchContainer = document.createElement('div');
    searchContainer.className = 'search-container';
    searchContainer.innerHTML = `
      <input type="text" id="searchStyles" placeholder="Search saved styles..." class="search-input">
      <button id="clearSearch" class="icon-btn" title="Clear search">✕</button>
    `;
    
    header.insertAdjacentElement('afterend', searchContainer);
    
    this.searchInput = document.getElementById('searchStyles');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    this.searchInput.addEventListener('input', () => this.filterSavedStyles());
    clearSearchBtn.addEventListener('click', () => {
      this.searchInput.value = '';
      this.filterSavedStyles();
    });
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      'theme', 'autoApply', 'highlightOnHover', 'highlightColor'
    ]);
    
    if (settings.theme === 'dark') {
      document.body.classList.add('dark');
      this.themeToggle.querySelector('.theme-icon').textContent = '☀️';
    }
    
    this.autoApply.checked = settings.autoApply || false;
    this.highlightOnHover.checked = settings.highlightOnHover !== false;
    this.highlightColor.value = settings.highlightColor || '#ff6b6b';
  }

  async loadSavedStyles() {
    const { savedStyles = [] } = await chrome.storage.local.get('savedStyles');
    this.allStyles = savedStyles; // Store all styles for filtering
    this.renderSavedStyles(savedStyles);
    // Remove target groups rendering as requested
    this.targetGroups.style.display = 'none';
  }

  initEventListeners() {
    // Theme toggle
    this.themeToggle.addEventListener('click', () => this.toggleTheme());
    
    // Settings toggle
    this.openSettings.addEventListener('click', () => this.toggleSettings());
    
    // Editor mode toggle
    this.toggleEditorBtn.addEventListener('click', () => this.toggleEditorMode());
    
    // Main buttons
    this.saveBtn.addEventListener('click', () => this.saveStyle());
    this.previewBtn.addEventListener('click', () => this.previewStyle());
    this.clearBtn.addEventListener('click', () => this.clearForm());
    this.useCurrentBtn.addEventListener('click', () => this.useCurrentDomain());
    this.pickElementBtn.addEventListener('click', () => this.startElementPicker());
    
    // Settings
    this.autoApply.addEventListener('change', () => this.saveSetting('autoApply', this.autoApply.checked));
    this.highlightOnHover.addEventListener('change', () => this.saveSetting('highlightOnHover', this.highlightOnHover.checked));
    this.highlightColor.addEventListener('change', () => this.saveSetting('highlightColor', this.highlightColor.value));
    
    this.exportBtn.addEventListener('click', () => this.exportSettings());
    this.importBtn.addEventListener('click', () => this.importSettings());
    this.resetBtn.addEventListener('click', () => this.resetSettings());
  }

  setupPickerListener() {
    // Listen for storage changes (when element is picked)
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.lastSelectedElement) {
        const selector = changes.lastSelectedElement.newValue;
        this.targetInput.value = selector;
        this.showStatus('Element selected: ' + selector, 'success');
        
        // Re-open popup if it was closed
        this.reopenPopup();
      }
    });
  }

  reopenPopup() {
    // Recreate the popup UI (simpler approach)
    chrome.action.openPopup();
  }

  toggleTheme() {
    const isDark = document.body.classList.toggle('dark');
    const themeIcon = this.themeToggle.querySelector('.theme-icon');
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    this.saveSetting('theme', isDark ? 'dark' : 'light');
  }

  toggleSettings() {
    const isSettingsVisible = this.settingsSection.style.display !== 'none';
    this.settingsSection.style.display = isSettingsVisible ? 'none' : 'block';
    this.editorSection.style.display = isSettingsVisible ? 'block' : 'none';
    this.openSettings.textContent = isSettingsVisible ? '⚙️' : '← Back';
  }

  async toggleEditorMode() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!this.canAccessTab(tab)) {
        this.showStatus('Cannot edit this page (restricted URL)', 'error');
        return;
      }
      
      await chrome.tabs.sendMessage(tab.id, { action: 'toggleEditor' });
      this.showStatus('Editor mode toggled', 'success');
    } catch (error) {
      console.error('Error toggling editor:', error);
      this.showStatus('Error: Content script not loaded on this page', 'error');
    }
  }

  async useCurrentDomain() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!this.canAccessTab(tab)) {
        this.showStatus('Cannot access this page', 'error');
        return;
      }
      
      const url = new URL(tab.url);
      this.domainInput.value = url.hostname;
      this.showStatus('Domain set to current page', 'success');
    } catch (error) {
      this.showStatus('Cannot get current URL', 'error');
    }
  }

  async startElementPicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!this.canAccessTab(tab)) {
      this.showStatus('Cannot pick elements on this page', 'error');
      return;
    }
    
    // Set picker mode
    this.isPickerMode = true;
    this.pickElementBtn.textContent = 'Picking...';
    this.pickElementBtn.disabled = true;
    this.pickElementBtn.classList.add('picker-mode');
    
    // Save current inputs temporarily
    await chrome.storage.local.set({
      tempDomain: this.domainInput.value,
      tempTarget: this.targetInput.value,
      tempCSS: this.cssInput.value,
      isPickerActive: true
    });
    
    // Clear last selected element
    await chrome.storage.local.remove('lastSelectedElement');
    
    // Try to send message to content script
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
      this.showStatus('Click on any element to select it', 'success');
      
      // Set up a listener for when user returns to popup
      window.addEventListener('focus', this.handlePopupFocus.bind(this));
      
    } catch (sendError) {
      // If content script isn't loaded, inject it
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css']
      });
      
      // Wait for injection
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try sending message again
      await chrome.tabs.sendMessage(tab.id, { action: 'startPicker' });
      this.showStatus('Click on any element to select it', 'success');
      
      // Set up focus listener
      window.addEventListener('focus', this.handlePopupFocus.bind(this));
    }
    
  } catch (error) {
    console.error('Error starting element picker:', error);
    this.showStatus('Failed to start element picker', 'error');
    this.resetPickerButton();
  }
}
handlePopupFocus() {
  // When popup gets focus again, check for picked element
  setTimeout(() => {
    this.restoreFromPicker();
    window.removeEventListener('focus', this.handlePopupFocus.bind(this));
  }, 500);
}
async checkForPickedElement() {
  const { lastSelectedElement } = await chrome.storage.local.get('lastSelectedElement');
  if (lastSelectedElement) {
    this.targetInput.value = lastSelectedElement;
    await chrome.storage.local.remove('lastSelectedElement');
  }
}

  resetPickerButton() {
    this.pickElementBtn.textContent = 'Pick';
    this.pickElementBtn.disabled = false;
    this.isPickerMode = false;
    
    // Restore popup size
    document.body.style.width = '';
    document.body.style.height = '';
    document.querySelector('.container').style.padding = '';
    document.querySelector('main').style.display = '';
    document.querySelector('footer').style.display = '';
    document.querySelector('header h1').textContent = 'DOM Editor';
  }

  async saveStyle() {
    const domain = this.domainInput.value.trim();
    const target = this.targetInput.value.trim();
    const css = this.cssInput.value.trim();

    if (!domain || !target || !css) {
      this.showStatus('Please fill all fields', 'error');
      return;
    }

    const style = {
      id: Date.now().toString(),
      domain,
      target,
      css,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { savedStyles = [] } = await chrome.storage.local.get('savedStyles');
    
    // Check if style already exists for this domain+target
    const existingIndex = savedStyles.findIndex(s => 
      s.domain === domain && s.target === target
    );
    
    if (existingIndex > -1) {
      // Update existing style
      savedStyles[existingIndex] = {
        ...savedStyles[existingIndex],
        css,
        updatedAt: new Date().toISOString()
      };
      this.showStatus('Style updated successfully!', 'success');
    } else {
      // Add new style
      savedStyles.push(style);
      this.showStatus('Style saved successfully!', 'success');
    }
    
    await chrome.storage.local.set({ savedStyles });
    this.clearForm();
    this.loadSavedStyles();
  }

  async previewStyle() {
    const target = this.targetInput.value.trim();
    const css = this.cssInput.value.trim();

    if (!target || !css) {
      this.showStatus('Please enter target and CSS', 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!this.canAccessTab(tab)) {
        this.showStatus('Cannot preview on this page', 'error');
        return;
      }
      
      await chrome.tabs.sendMessage(tab.id, {
        action: 'previewStyle',
        target,
        css
      });
      
      this.showStatus('Preview applied', 'success');
    } catch (error) {
      console.error('Error previewing style:', error);
      this.showStatus('Error applying preview', 'error');
    }
  }

  clearForm() {
    this.domainInput.value = '';
    this.targetInput.value = '';
    this.cssInput.value = '';
  }

  async deleteStyle(id) {
    if (!confirm('Are you sure you want to delete this style?')) return;
    
    const { savedStyles = [] } = await chrome.storage.local.get('savedStyles');
    const updated = savedStyles.filter(style => style.id !== id);
    await chrome.storage.local.set({ savedStyles: updated });
    this.loadSavedStyles();
    this.showStatus('Style deleted', 'success');
  }

  async editStyle(id) {
    const { savedStyles = [] } = await chrome.storage.local.get('savedStyles');
    const style = savedStyles.find(s => s.id === id);
    
    if (!style) return;
    
    // Load style into form
    this.domainInput.value = style.domain;
    this.targetInput.value = style.target;
    this.cssInput.value = style.css;
    
    this.showStatus('Style loaded for editing', 'success');
    
    // Scroll to form
    this.editorSection.scrollIntoView({ behavior: 'smooth' });
  }

  async applyStyle(id) {
    try {
      const { savedStyles = [] } = await chrome.storage.local.get('savedStyles');
      const style = savedStyles.find(s => s.id === id);
      
      if (!style) return;
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!this.canAccessTab(tab)) {
        this.showStatus('Cannot apply on this page', 'error');
        return;
      }
      
      const currentUrl = new URL(tab.url);
      
      if (currentUrl.hostname.includes(style.domain) || tab.url.includes(style.domain)) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'applyStyle',
          target: style.target,
          css: style.css
        });
        this.showStatus('Style applied', 'success');
      } else {
        this.showStatus(`Domain mismatch. Style is for: ${style.domain}`, 'error');
      }
    } catch (error) {
      console.error('Error applying style:', error);
      this.showStatus('Error applying style', 'error');
    }
  }

  filterSavedStyles() {
    const searchTerm = this.searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
      this.renderSavedStyles(this.allStyles);
      return;
    }
    
    const filtered = this.allStyles.filter(style => 
      style.domain.toLowerCase().includes(searchTerm) ||
      style.target.toLowerCase().includes(searchTerm) ||
      style.css.toLowerCase().includes(searchTerm)
    );
    
    this.renderSavedStyles(filtered);
  }

  renderSavedStyles(styles) {
    this.savedStylesContainer.innerHTML = '';
    
    if (styles.length === 0) {
      const message = this.searchInput.value ? 
        'No styles match your search' : 
        'No saved styles yet';
      
      this.savedStylesContainer.innerHTML = `
        <div class="empty-state">
          <p>${message}</p>
          ${this.searchInput.value ? 
            '<button id="clearSearchAll" class="small-btn">Clear Search</button>' : 
            ''}
        </div>
      `;
      
      if (this.searchInput.value) {
        this.savedStylesContainer.querySelector('#clearSearchAll').addEventListener('click', () => {
          this.searchInput.value = '';
          this.filterSavedStyles();
        });
      }
      return;
    }

    // Sort by domain then by target
    styles.sort((a, b) => {
      if (a.domain === b.domain) {
        return a.target.localeCompare(b.target);
      }
      return a.domain.localeCompare(b.domain);
    });

    styles.forEach(style => {
      const div = document.createElement('div');
      div.className = 'style-item';
      div.innerHTML = `
        <div class="style-info">
          <div class="style-header">
            <span class="style-domain">${style.domain}</span>
            <span class="style-date">${new Date(style.updatedAt || style.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="style-target">${style.target}</div>
          <div class="style-css-preview">${style.css.substring(0, 100)}${style.css.length > 100 ? '...' : ''}</div>
        </div>
        <div class="style-actions">
          <button class="small-btn action-btn edit-btn" data-id="${style.id}" title="Edit">
            ✏️
          </button>
          <button class="small-btn action-btn apply-btn" data-id="${style.id}" title="Apply">
            ▶️
          </button>
          <button class="small-btn action-btn delete-btn" data-id="${style.id}" title="Delete">
            🗑️
          </button>
        </div>
      `;
      
      this.savedStylesContainer.appendChild(div);
    });

    // Add event listeners for dynamic buttons
    this.savedStylesContainer.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.editStyle(e.target.closest('button').dataset.id);
      });
    });

    this.savedStylesContainer.querySelectorAll('.apply-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.applyStyle(e.target.closest('button').dataset.id);
      });
    });

    this.savedStylesContainer.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.deleteStyle(e.target.closest('button').dataset.id);
      });
    });
  }

  async saveSetting(key, value) {
    await chrome.storage.local.set({ [key]: value });
  }

  async exportSettings() {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dom-editor-settings.json';
    a.click();
    URL.revokeObjectURL(url);
    this.showStatus('Settings exported', 'success');
  }

  async importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const text = await file.text();
      const data = JSON.parse(text);
      await chrome.storage.local.set(data);
      this.loadSettings();
      this.loadSavedStyles();
      this.showStatus('Settings imported successfully', 'success');
    };
    
    input.click();
  }

  async resetSettings() {
    if (confirm('Are you sure? This will delete ALL saved styles and settings.')) {
      await chrome.storage.local.clear();
      
      // Restore defaults
      await chrome.storage.local.set({
        theme: 'light',
        autoApply: false,
        highlightOnHover: true,
        highlightColor: '#ff6b6b',
        savedStyles: []
      });
      
      this.loadSettings();
      this.loadSavedStyles();
      this.showStatus('All data reset to defaults', 'success');
    }
  }

  showStatus(message, type = 'success') {
    this.status.textContent = message;
    this.status.className = `status ${type}`;
    
    setTimeout(() => {
      this.status.textContent = '';
      this.status.className = 'status';
    }, 3000);
  }

  canAccessTab(tab) {
    if (!tab || !tab.url) return false;
    
    const blockedPatterns = [
      'chrome://',
      'chrome-extension://',
      'about:',
      'edge://',
      'brave://',
      'opera://',
      'vivaldi://'
    ];
    
    return !blockedPatterns.some(pattern => tab.url.startsWith(pattern));
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new DOMEditor();
});