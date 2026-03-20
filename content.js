// ===== QUICK TEXT EXPANDER PRO – CONTENT SCRIPT =====

let snippets = {};
let settings = {
  triggerKey:         'Tab',
  caseSensitive:      true,
  showSuggestions:    true,
  suggestionDuration: 5000,
};

let activeField     = null;
let activeShortcut  = '';
let suggestionTimer = null;

// ── Load & sync settings ──────────────────────────────────────────────────────

function loadAll() {
  chrome.storage.sync.get(
    ['snippets', 'triggerKey', 'caseSensitive', 'showSuggestions', 'suggestionDuration'],
    function (r) {
      snippets                    = r.snippets             || {};
      settings.triggerKey         = r.triggerKey           || 'Tab';
      settings.caseSensitive      = r.caseSensitive        !== false;
      settings.showSuggestions    = r.showSuggestions      !== false;
      settings.suggestionDuration = r.suggestionDuration   || 5000;
    }
  );
}
loadAll();

chrome.storage.onChanged.addListener(function (changes) {
  if (changes.snippets)           snippets                    = changes.snippets.newValue           || {};
  if (changes.triggerKey)         settings.triggerKey         = changes.triggerKey.newValue         || 'Tab';
  if (changes.caseSensitive)      settings.caseSensitive      = changes.caseSensitive.newValue      !== false;
  if (changes.showSuggestions)    settings.showSuggestions    = changes.showSuggestions.newValue    !== false;
  if (changes.suggestionDuration) settings.suggestionDuration = changes.suggestionDuration.newValue || 5000;
});

// ── Snippet helpers ───────────────────────────────────────────────────────────

function getSnippetText(entry) {
  if (typeof entry === 'string') return entry;
  return (entry && entry.text) || null;
}

function isSnippetEnabled(entry) {
  if (typeof entry === 'string') return true;
  return entry && entry.enabled !== false;
}

// ── Variable processor ────────────────────────────────────────────────────────
// IMPORTANT: ALL .replace() calls use a function () => value as the replacement,
// NOT a string literal. This prevents JS from treating $ in URLs/titles/etc. as
// special capture-group references ($1, $&, $', $`) which silently corrupt output.

function processVariables(text) {
  const now    = new Date();
  const pad    = (n) => String(n).padStart(2, '0');
  const locale = navigator.language || 'en-US';

  // ISO 8601 week number
  function weekNum(d) {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const y1 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    return Math.ceil((((tmp - y1) / 86400000) + 1) / 7);
  }

  function greeting() {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
  }

  function makeUUID() {
    try { return crypto.randomUUID(); } catch (_) {}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  const tz        = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) { return 'Unknown'; } })();
  const quarter   = 'Q' + (Math.floor(now.getMonth() / 3) + 1);
  const domain    = (() => { try { return window.location.hostname || ''; } catch (_) { return ''; } })();
  const pageUrl   = (() => { try { return window.location.href    || ''; } catch (_) { return ''; } })();
  const pageTitle = (() => { try { return document.title          || ''; } catch (_) { return ''; } })();

  // Process {random:min-max} FIRST so it isn't partially matched by {random}
  text = text.replace(/\{random:(\d+)-(\d+)\}/gi, (_, min, max) => {
    const lo = parseInt(min, 10), hi = parseInt(max, 10);
    return String(Math.floor(Math.random() * (hi - lo + 1)) + lo);
  });

  return text
    // Date / Time — all use () => to protect against $ in replacement
    .replace(/\{date\}/gi,       () => now.toLocaleDateString(locale))
    .replace(/\{time\}/gi,       () => `${pad(now.getHours())}:${pad(now.getMinutes())}`)
    .replace(/\{time12\}/gi,     () => now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: true }))
    .replace(/\{datetime\}/gi,   () => now.toLocaleString(locale))
    .replace(/\{day\}/gi,        () => now.toLocaleDateString(locale, { weekday: 'long' }))
    .replace(/\{dayshort\}/gi,   () => now.toLocaleDateString(locale, { weekday: 'short' }))
    .replace(/\{month\}/gi,      () => now.toLocaleDateString(locale, { month: 'long' }))
    .replace(/\{monthnum\}/gi,   () => pad(now.getMonth() + 1))
    .replace(/\{year\}/gi,       () => String(now.getFullYear()))
    .replace(/\{year2\}/gi,      () => String(now.getFullYear()).slice(-2))
    .replace(/\{quarter\}/gi,    () => quarter)
    .replace(/\{weeknum\}/gi,    () => String(weekNum(now)))
    .replace(/\{timestamp\}/gi,  () => String(now.getTime()))
    .replace(/\{iso\}/gi,        () => now.toISOString())
    // Utility
    .replace(/\{greeting\}/gi,   () => greeting())
    .replace(/\{timezone\}/gi,   () => tz)
    .replace(/\{uuid\}/gi,       () => makeUUID())
    .replace(/\{random\}/gi,     () => String(Math.floor(Math.random() * 9000) + 1000))
    // Page context — these especially need () => because URLs/titles contain $
    .replace(/\{domain\}/gi,     () => domain)
    .replace(/\{url\}/gi,        () => pageUrl)
    .replace(/\{title\}/gi,      () => pageTitle);
    // {cursor} handled separately in expandShortcut()
}

// ── Snippet key lookup ────────────────────────────────────────────────────────

function findMatchingKey(word) {
  if (!word) return null;
  const compare = settings.caseSensitive
    ? (a, b) => a === b
    : (a, b) => a.toLowerCase() === b.toLowerCase();
  for (const [key, entry] of Object.entries(snippets)) {
    if (compare(word, key) && isSnippetEnabled(entry)) return key;
  }
  return null;
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

// ── Field detection & binding ─────────────────────────────────────────────────

const bound = new WeakSet();

function isEditable(el) {
  if (!el) return false;
  if (el.tagName === 'INPUT') {
    const t = (el.type || '').toLowerCase();
    return ['text', 'search', 'email', 'url', 'tel', 'number', ''].includes(t);
  }
  if (el.tagName === 'TEXTAREA') return true;
  return el.isContentEditable;
}

function bindField(el) {
  if (bound.has(el)) return;
  bound.add(el);
  el.addEventListener('input', onInput, { passive: true });
  // capture:true is critical — Discord and WhatsApp register their own keydown
  // listeners at capture phase and call stopImmediatePropagation() on Tab to
  // handle autocomplete. Our handler must run first to claim the Tab key.
  el.addEventListener('keydown', onKeyDown, { capture: true });
}

function scanFields() {
  const sel = [
    'input[type="text"], input[type="search"], input[type="email"]',
    'input[type="url"], input[type="tel"], input[type="number"], input:not([type])',
    'textarea',
    '[contenteditable="true"], [contenteditable=""]',
    '[role="textbox"], [role="combobox"], [role="searchbox"]',
  ].join(', ');
  try {
    document.querySelectorAll(sel).forEach(el => { if (isEditable(el)) bindField(el); });
  } catch (_) {}
}

const domObserver = new MutationObserver(() => scanFields());
domObserver.observe(document.documentElement, { childList: true, subtree: true });
scanFields();

// ── Event handlers ────────────────────────────────────────────────────────────

function onInput(e) {
  checkForShortcut(e.target);
}

function onKeyDown(e) {
  const field = e.target;

  if (e.key === 'Escape') {
    hideSuggestion();
    return;
  }

  if (activeField === field && activeShortcut && e.key === settings.triggerKey) {
    if (settings.triggerKey === ' ' && !activeShortcut) return;
    e.preventDefault();
    e.stopPropagation();
    expandShortcut(field, activeShortcut);
    hideSuggestion();
    return;
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    setTimeout(() => checkForShortcut(field), 0);
  }
}

// ── Shortcut detection ────────────────────────────────────────────────────────

function getFieldText(field) {
  if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') return field.value;
  return field.innerText || field.textContent || '';
}

function getLastWord(text) {
  // Strip trailing whitespace + invisible Unicode that Discord/WhatsApp inject.
  // Discord <p> blocks add \n\n after innerText. Lexical adds \u200b zero-width spaces.
  // Without this, /\S+$/ returns '' and the shortcut is never detected.
  const cleaned = text.replace(/[\s\u00a0\u200b\u200c\u200d\u2060\ufeff]+$/, '');
  const m = cleaned.match(/\S+$/);
  return m ? m[0] : '';
}

function checkForShortcut(field) {
  if (!isEditable(field)) return;
  const lastWord = getLastWord(getFieldText(field));
  const matched  = lastWord ? findMatchingKey(lastWord) : null;
  if (matched) {
    activeField    = field;
    activeShortcut = matched;
    if (settings.showSuggestions) showSuggestion(field, matched);
  } else {
    hideSuggestion();
  }
}

// ── Suggestion tooltip ────────────────────────────────────────────────────────

const SUGGESTION_ID = 'qte-pro-suggestion';

function showSuggestion(field, shortcut) {
  const stale = document.getElementById(SUGGESTION_ID);
  if (stale) stale.remove();
  if (suggestionTimer) { clearTimeout(suggestionTimer); suggestionTimer = null; }

  const raw      = getSnippetText(snippets[shortcut]) || '';
  const preview  = raw.length > 45 ? raw.slice(0, 45) + '…' : raw;
  const keyLabel = settings.triggerKey === ' ' ? 'Space' : settings.triggerKey;

  const el = document.createElement('div');
  el.id = SUGGESTION_ID;
  el.setAttribute('role', 'tooltip');
  el.style.cssText = `
    all: initial;
    position: fixed !important;
    z-index: 2147483647 !important;
    background: rgba(13,14,17,0.96) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(245,158,11,0.35) !important;
    border-radius: 8px !important;
    padding: 7px 13px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
    font-size: 13px !important;
    line-height: 1 !important;
    color: #e5e7eb !important;
    box-shadow: 0 6px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,158,11,0.08) !important;
    pointer-events: none !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    max-width: 420px !important;
    white-space: nowrap !important;
  `;
  el.innerHTML = `
    <span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#0d0e0f;padding:3px 9px;border-radius:5px;font-family:'SF Mono','Cascadia Code',Consolas,monospace;font-size:11px;font-weight:700;letter-spacing:.3px;">${esc(shortcut)}</span>
    <span style="color:#6b7280;font-size:15px;">→</span>
    <span style="color:#d1d5db;overflow:hidden;text-overflow:ellipsis;max-width:200px;">${esc(preview)}</span>
    <span style="background:rgba(245,158,11,.12);color:#f59e0b;padding:3px 8px;border-radius:5px;font-size:11px;font-weight:600;border:1px solid rgba(245,158,11,.2);">${esc(keyLabel)}</span>
  `;

  try {
    const rect = field.getBoundingClientRect();
    let top  = rect.bottom + 6;
    let left = rect.left;
    if (top  + 44  > window.innerHeight) top  = rect.top  - 50;
    if (left + 440 > window.innerWidth)  left = window.innerWidth - 444;
    el.style.top  = Math.max(4, top)  + 'px';
    el.style.left = Math.max(4, left) + 'px';
  } catch (_) {
    el.style.bottom = '20px';
    el.style.left   = '20px';
  }

  document.documentElement.appendChild(el);

  // Auto-hide the tooltip but keep activeField/activeShortcut alive so
  // pressing Tab still works even after the tooltip disappears
  suggestionTimer = setTimeout(() => {
    const cur = document.getElementById(SUGGESTION_ID);
    if (cur) cur.remove();
    suggestionTimer = null;
  }, settings.suggestionDuration);
}

function hideSuggestion() {
  const el = document.getElementById(SUGGESTION_ID);
  if (el) el.remove();
  if (suggestionTimer) { clearTimeout(suggestionTimer); suggestionTimer = null; }
  activeField    = null;
  activeShortcut = '';
}

// ── Expansion entry point ─────────────────────────────────────────────────────

function expandShortcut(field, shortcut) {
  const entry = snippets[shortcut];
  if (!entry) return;
  let text = getSnippetText(entry);
  if (!text) return;

  text = processVariables(text);

  const cursorOffset = text.indexOf('{cursor}');
  const expandedText = text.replace('{cursor}', '');

  try { chrome.runtime.sendMessage({ type: 'trackUsage', shortcut }); } catch (_) {}

  field.focus();

  if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
    expandInput(field, shortcut, expandedText, cursorOffset);
  } else {
    expandContentEditable(field, shortcut, expandedText, cursorOffset);
  }
}

// ── Input / Textarea expansion ────────────────────────────────────────────────

function expandInput(field, shortcut, expandedText, cursorOffset) {
  const current = field.value;
  const idx     = current.lastIndexOf(shortcut);
  if (idx === -1) return;

  const newValue = current.slice(0, idx) + expandedText + current.slice(idx + shortcut.length);

  // Use native property descriptor so React/Vue synthetic event system fires
  const proto = field.tagName === 'TEXTAREA'
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) desc.set.call(field, newValue);
  else                  field.value = newValue;

  field.dispatchEvent(new Event('input',  { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));

  const caretPos = cursorOffset >= 0 ? idx + cursorOffset : idx + expandedText.length;
  requestAnimationFrame(() => { field.selectionStart = field.selectionEnd = caretPos; });
}

// ── ContentEditable expansion ─────────────────────────────────────────────────
//
// Discord (Slate.js) and WhatsApp (Lexical) both check event.isTrusted === true
// and silently ignore synthetic beforeinput / ClipboardEvent dispatched by
// content scripts (isTrusted is always false for script-created events).
//
// The ONLY approach that produces a trusted event from a content script is
// document.execCommand('paste'), which is allowed because we are executing
// inside a keydown handler (= user gesture context). We first write the
// expanded text to the clipboard via a hidden textarea + execCommand('copy'),
// then paste it. Both Slate and Lexical handle trusted paste correctly.

function writeToClipboardSync(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
  document.documentElement.appendChild(ta);
  ta.select();
  try   { document.execCommand('copy'); }
  catch (_) {}
  ta.remove();
}

function expandContentEditable(field, shortcut, expandedText, cursorOffset) {
  field.focus();
  const sel = window.getSelection();
  if (!sel) return;

  // 1. Find the shortcut text node
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  const nodes  = [];
  let nd;
  while ((nd = walker.nextNode())) nodes.push(nd);

  let targetNode = null, targetIdx = -1;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const idx = nodes[i].textContent.lastIndexOf(shortcut);
    if (idx !== -1) { targetNode = nodes[i]; targetIdx = idx; break; }
  }
  if (!targetNode) return;

  // 2. Select exactly the shortcut
  const range = document.createRange();
  range.setStart(targetNode, targetIdx);
  range.setEnd(targetNode, targetIdx + shortcut.length);
  sel.removeAllRanges();
  sel.addRange(range);

  // 3. Write expanded text to clipboard synchronously
  writeToClipboardSync(expandedText);

  // 4. Paste — trusted event, accepted by Discord and WhatsApp
  const pasted = document.execCommand('paste');

  // 5. Fallback for editors that don't respond to paste (e.g. older Notion)
  if (!pasted) {
    document.execCommand('delete', false);
    document.execCommand('insertText', false, expandedText);
  }

  // 6. Notify any remaining event listeners
  field.dispatchEvent(new InputEvent('input', {
    inputType: 'insertText',
    data:      expandedText,
    bubbles:   true,
  }));

  // 7. Reposition caret at {cursor} placeholder position
  if (cursorOffset >= 0) {
    try {
      const s = window.getSelection();
      if (s && s.rangeCount) {
        const r        = s.getRangeAt(0);
        const moveBack = expandedText.length - cursorOffset;
        if (moveBack > 0) {
          const newPos = Math.max(0, r.startOffset - moveBack);
          r.setStart(r.startContainer, newPos);
          r.setEnd(r.startContainer,   newPos);
          s.removeAllRanges();
          s.addRange(r);
        }
      }
    } catch (_) {}
  }
}
