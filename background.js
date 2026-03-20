// ===== QUICK TEXT EXPANDER PRO – BACKGROUND SERVICE WORKER =====

const DEFAULT_SNIPPETS = {
  '`email': { text: 'your.email@example.com',          category: 'Personal', enabled: true, usageCount: 0, createdAt: Date.now() },
  '`hello': { text: 'Hello! How can I help you today?', category: 'Work',     enabled: true, usageCount: 0, createdAt: Date.now() },
  '`sig':   { text: 'Best regards,\nYour Name',         category: 'Work',     enabled: true, usageCount: 0, createdAt: Date.now() },
  '`date':  { text: '{date}',                           category: 'Utility',  enabled: true, usageCount: 0, createdAt: Date.now() },
  '`time':  { text: '{time}',                           category: 'Utility',  enabled: true, usageCount: 0, createdAt: Date.now() },
  '`addr':  { text: '123 Main Street, City, State 00000', category: 'Personal', enabled: true, usageCount: 0, createdAt: Date.now() },
};

// ── Install / Update ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      snippets:           DEFAULT_SNIPPETS,
      triggerKey:         'Tab',
      caseSensitive:      true,
      showSuggestions:    true,
      suggestionDuration: 5000,
    });
  } else if (details.reason === 'update') {
    // Migrate old string-format snippets to object format
    chrome.storage.sync.get(['snippets'], function (result) {
      const raw      = result.snippets || {};
      const migrated = {};
      let   changed  = false;
      for (const [key, val] of Object.entries(raw)) {
        if (typeof val === 'string') {
          migrated[key] = { text: val, category: 'General', enabled: true, usageCount: 0, createdAt: Date.now() };
          changed = true;
        } else {
          migrated[key] = val;
        }
      }
      if (changed) chrome.storage.sync.set({ snippets: migrated });
    });
  }
});

// ── Message dispatcher ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'trackUsage') {
    const { shortcut } = message;
    chrome.storage.sync.get(['snippets'], function (result) {
      const snippets = result.snippets || {};
      const entry    = snippets[shortcut];
      if (!entry) return;
      if (typeof entry === 'string') {
        snippets[shortcut] = { text: entry, category: 'General', enabled: true, usageCount: 1, lastUsed: Date.now(), createdAt: Date.now() };
      } else {
        snippets[shortcut].usageCount = (entry.usageCount || 0) + 1;
        snippets[shortcut].lastUsed   = Date.now();
      }
      chrome.storage.sync.set({ snippets }, () => {
        if (chrome.runtime.lastError) console.warn('QTE:', chrome.runtime.lastError.message);
      });
    });
    sendResponse({ ok: true });
    return true;
  }
});

// ── Keyboard shortcut → open options ─────────────────────────────────────────
chrome.commands.onCommand.addListener(function (command) {
  if (command === 'open-options') chrome.runtime.openOptionsPage();
});
