// content.js - Keep the existing content script
// It will be loaded automatically on page load

class DOMEditorContent {
  constructor() {
    this.settings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.applySavedStyles();
    this.initMessageListener();
  }

  async loadSettings() {
    const settings = await chrome.storage.local.get([
      "autoApply",
      "savedStyles",
    ]);
    this.settings = settings;
  }

  async applySavedStyles() {
    const { savedStyles = [], autoApply = false } = this.settings;

    if (!autoApply) return;

    const currentUrl = window.location.href;
    const currentDomain = window.location.hostname;

    savedStyles.forEach((style) => {
      if (
        currentUrl.includes(style.domain) ||
        currentDomain.includes(style.domain)
      ) {
        this.applyCSS(style.target, style.css, true);
      }
    });
  }

  initMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case "previewStyle":
          const previewSuccess = this.applyCSS(
            request.target,
            request.css,
            false,
          );
          sendResponse({ success: previewSuccess });
          break;
        case "applyStyle":
          const applySuccess = this.applyCSS(request.target, request.css, true);
          sendResponse({ success: applySuccess });
          break;
      }
      return true;
    });
  }

  applyCSS(selector, css, persistent = false) {
    try {
      if (!selector || !selector.trim()) {
        console.error("Invalid selector:", selector);
        return false;
      }

      // Clean CSS
      let cssText = css.trim();

      // Create style ID
      const styleId = persistent
        ? `dom-editor-persistent-${Date.now()}`
        : `dom-editor-temp-${Date.now()}`;

      // Remove existing style with same selector
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();

      // Create new style
      const style = document.createElement("style");
      style.id = styleId;

      // Format CSS properly
      if (!cssText.includes("{") && !cssText.includes("}")) {
        // Inline properties
        if (!cssText.endsWith(";")) {
          cssText += ";";
        }
        style.textContent = `${selector} { ${cssText} }`;
      } else {
        // Full CSS rule
        style.textContent = cssText;
      }

      document.head.appendChild(style);
      console.log("CSS applied:", { selector, css: cssText });

      // Remove temporary styles after 10 seconds
      if (!persistent) {
        setTimeout(() => {
          if (style.parentNode) {
            style.remove();
          }
        }, 10000);
      }

      return true;
    } catch (error) {
      console.error("Error applying CSS:", error);
      return false;
    }
  }
}

// Initialize only once
if (!window.domEditorInitialized) {
  const init = () => {
    window.domEditor = new DOMEditorContent();
    window.domEditorInitialized = true;
  };
  
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}