// ===== QUICK TEXT EXPANDER PRO – OPTIONS SCRIPT =====

let snippets = {};
let settings = { triggerKey: 'Tab', caseSensitive: true, showSuggestions: true, suggestionDuration: 5000 };

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  loadAll();
  setupTabs();
  setupAddForm();
  setupSettings();
  setupVariablesPanel();
  setupImportExport();
  setupModal();
});

function loadAll() {
  chrome.storage.sync.get(
    ['snippets', 'triggerKey', 'caseSensitive', 'showSuggestions', 'suggestionDuration'],
    function (r) {
      snippets = r.snippets || {};
      settings.triggerKey = r.triggerKey || 'Tab';
      settings.caseSensitive = r.caseSensitive !== false;
      settings.showSuggestions = r.showSuggestions !== false;
      settings.suggestionDuration = r.suggestionDuration || 5000;
      renderSnippets();
      populateSettings();
      updateTotalCount();
      updateCategoryLists();
    }
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEntry(shortcut) { return snippets[shortcut]; }

function getText(entry) {
  if (typeof entry === 'string') return entry;
  return (entry && entry.text) || '';
}
function getCat(entry) {
  if (typeof entry === 'string') return 'General';
  return (entry && entry.category) || 'General';
}
function getEnabled(entry) {
  if (typeof entry === 'string') return true;
  return entry && entry.enabled !== false;
}
function getUsage(entry) {
  if (typeof entry === 'object') return entry.usageCount || 0;
  return 0;
}
function getCreatedAt(entry) {
  if (typeof entry === 'object') return entry.createdAt || 0;
  return 0;
}

function allCategories() {
  const cats = new Set();
  for (const e of Object.values(snippets)) cats.add(getCat(e));
  return [...cats].sort();
}

// Safe DOM text setter
function setText(el, str) { el.textContent = String(str); }

function updateTotalCount() {
  const total = Object.keys(snippets).length;
  const el = document.getElementById('totalCount');
  el.innerHTML = '';
  el.appendChild(document.createTextNode(total + ' '));
  const strong = document.createElement('strong');
  strong.textContent = total === 1 ? 'snippet' : 'snippets';
  el.appendChild(strong);
}

function updateCategoryLists() {
  const cats = allCategories();
  const dl = document.getElementById('categoryList');
  dl.innerHTML = '';
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    dl.appendChild(opt);
  });

  // Filter select
  const filterSel = document.getElementById('filterCat');
  const current = filterSel.value;
  filterSel.innerHTML = '';
  const allOpt = document.createElement('option');
  allOpt.value = 'All';
  allOpt.textContent = 'All categories';
  filterSel.appendChild(allOpt);
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    filterSel.appendChild(opt);
  });
  filterSel.value = cats.includes(current) ? current : 'All';
}

function saveSnippets(cb) {
  chrome.storage.sync.set({ snippets }, function () {
    if (chrome.runtime.lastError) {
      showToast('⚠️ Save failed: ' + chrome.runtime.lastError.message, true);
    } else {
      if (cb) cb();
    }
  });
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      // Hide all tab panels (both .tab-panel and the analysis div)
      document.querySelectorAll('.tab-panel, #tab-analysis').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
      });
      this.classList.add('active');
      const panel = document.getElementById('tab-' + this.dataset.tab);
      if (panel) {
        panel.style.display = 'block';
        panel.classList.add('active');
        if (this.dataset.tab === 'analysis') loadAnalysisData();
      }
    });
  });
}

// ── Add Form ──────────────────────────────────────────────────────────────────
function setupAddForm() {
  const shortcutEl = document.getElementById('newShortcut');
  const textEl     = document.getElementById('newText');
  const catEl      = document.getElementById('newCategory');
  const enabledEl  = document.getElementById('newEnabled');
  const dupWarn    = document.getElementById('dupWarn');
  const counter    = document.getElementById('charCounter');

  // Toggle
  enabledEl.addEventListener('click', function () {
    this.classList.toggle('on');
    document.getElementById('newEnabledLabel').textContent =
      this.classList.contains('on') ? 'Enabled' : 'Disabled';
  });

  // Char counter
  textEl.addEventListener('input', function () {
    setText(counter, this.value.length + ' chars');
  });

  // Duplicate check
  shortcutEl.addEventListener('input', function () {
    const dup = snippets.hasOwnProperty(this.value.trim()) && this.value.trim() !== '';
    dupWarn.classList.toggle('show', dup);
  });

  document.getElementById('addBtn').addEventListener('click', function () {
    const shortcut = shortcutEl.value.trim();
    const text     = textEl.value.trim();
    const cat      = (catEl.value.trim() || 'General');
    const enabled  = enabledEl.classList.contains('on');

    if (!shortcut) { showToast('⚠️ Please enter a shortcut', true); return; }
    if (!text)     { showToast('⚠️ Please enter expanded text', true); return; }

    snippets[shortcut] = {
      text,
      category: cat,
      enabled,
      usageCount: 0,
      createdAt: Date.now(),
    };

    saveSnippets(() => {
      shortcutEl.value = ';';
      textEl.value = '';
      catEl.value = '';
      enabledEl.classList.add('on');
      document.getElementById('newEnabledLabel').textContent = 'Enabled';
      setText(counter, '0 chars');
      dupWarn.classList.remove('show');
      renderSnippets();
      updateTotalCount();
      updateCategoryLists();
      showToast('✨ Snippet created');
    });
  });
}

// ── Render Snippets ───────────────────────────────────────────────────────────
function renderSnippets() {
  const container = document.getElementById('snippetsList');
  const query     = (document.getElementById('searchSnippets').value || '').trim().toLowerCase();
  const sortBy    = document.getElementById('sortBy').value;
  const catFilter = document.getElementById('filterCat').value;

  let entries = Object.entries(snippets);

  // Filter by category
  if (catFilter !== 'All') {
    entries = entries.filter(([, e]) => getCat(e) === catFilter);
  }

  // Search filter
  if (query) {
    entries = entries.filter(([shortcut, e]) =>
      shortcut.toLowerCase().includes(query) ||
      getText(e).toLowerCase().includes(query) ||
      getCat(e).toLowerCase().includes(query)
    );
  }

  // Sort
  entries.sort(([ka, a], [kb, b]) => {
    if (sortBy === 'usage')   return getUsage(b) - getUsage(a);
    if (sortBy === 'recent')  return (getLastUsed(b) || 0) - (getLastUsed(a) || 0);
    if (sortBy === 'created') return getCreatedAt(b) - getCreatedAt(a);
    return ka.localeCompare(kb); // name A-Z
  });

  container.innerHTML = '';

  if (Object.keys(snippets).length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('div'); icon.className = 'empty-icon'; icon.textContent = '⚡';
    const title = document.createElement('div'); title.className = 'empty-title'; title.textContent = 'No snippets yet';
    const text = document.createElement('div'); text.className = 'empty-text'; text.textContent = 'Add your first snippet using the form above';
    empty.appendChild(icon); empty.appendChild(title); empty.appendChild(text);
    container.appendChild(empty);
    return;
  }

  if (entries.length === 0) {
    const noRes = document.createElement('div');
    noRes.className = 'empty-state';
    noRes.style.padding = '40px';
    const icon = document.createElement('div'); icon.textContent = '🔍'; icon.style.cssText = 'font-size:36px;margin-bottom:10px;opacity:.4';
    const title = document.createElement('div'); title.className = 'empty-title'; title.textContent = 'No snippets match';
    noRes.appendChild(icon); noRes.appendChild(title);
    container.appendChild(noRes);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'snippets-grid';

  for (const [shortcut, entry] of entries) {
    const item = buildSnippetCard(shortcut, entry);
    grid.appendChild(item);
  }

  container.appendChild(grid);

  // Wire up search + sort
  const searchEl = document.getElementById('searchSnippets');
  if (!searchEl.dataset.bound) {
    searchEl.dataset.bound = '1';
    searchEl.addEventListener('input', () => renderSnippets());
  }
  const sortEl = document.getElementById('sortBy');
  if (!sortEl.dataset.bound) {
    sortEl.dataset.bound = '1';
    sortEl.addEventListener('change', () => renderSnippets());
  }
  const catEl = document.getElementById('filterCat');
  if (!catEl.dataset.bound) {
    catEl.dataset.bound = '1';
    catEl.addEventListener('change', () => renderSnippets());
  }
}

function getLastUsed(entry) {
  if (typeof entry === 'object') return entry.lastUsed || 0;
  return 0;
}

function buildSnippetCard(shortcut, entry) {
  const enabled = getEnabled(entry);
  const item = document.createElement('div');
  item.className = 'snippet-item' + (enabled ? '' : ' disabled');

  // Top row
  const top = document.createElement('div'); top.className = 'si-top';

  const tag = document.createElement('span'); tag.className = 'si-shortcut';
  tag.textContent = shortcut; // safe

  const badges = document.createElement('div'); badges.className = 'si-badges';
  const catBadge = document.createElement('span'); catBadge.className = 'si-cat';
  catBadge.textContent = getCat(entry);

  const usage = getUsage(entry);
  const usageEl = document.createElement('span'); usageEl.className = 'si-usage';
  usageEl.textContent = usage > 0 ? '↩ ' + usage + 'x' : '';

  badges.appendChild(catBadge);
  if (usage > 0) badges.appendChild(usageEl);
  top.appendChild(tag);
  top.appendChild(badges);

  // Text preview
  const textEl = document.createElement('div'); textEl.className = 'si-text';
  textEl.textContent = getText(entry); // safe

  // Actions
  const actions = document.createElement('div'); actions.className = 'si-actions';

  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-ghost btn-sm';
  editBtn.textContent = '✏️ Edit';
  editBtn.addEventListener('click', () => openEditModal(shortcut));

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn btn-ghost btn-sm';
  toggleBtn.textContent = enabled ? '⏸ Disable' : '▶ Enable';
  toggleBtn.addEventListener('click', () => {
    if (typeof snippets[shortcut] === 'string') {
      snippets[shortcut] = { text: snippets[shortcut], category: 'General', enabled: false, usageCount: 0, createdAt: Date.now() };
    } else {
      snippets[shortcut].enabled = !enabled;
    }
    saveSnippets(() => { renderSnippets(); showToast(enabled ? '⏸ Snippet disabled' : '▶ Snippet enabled'); });
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-red btn-sm';
  delBtn.textContent = '🗑';
  delBtn.title = 'Delete snippet';
  delBtn.addEventListener('click', () => {
    if (!confirm('Delete shortcut "' + shortcut + '"?')) return;
    delete snippets[shortcut];
    saveSnippets(() => {
      renderSnippets();
      updateTotalCount();
      updateCategoryLists();
      showToast('🗑 Snippet deleted');
    });
  });

  actions.appendChild(editBtn);
  actions.appendChild(toggleBtn);
  actions.appendChild(delBtn);

  item.appendChild(top);
  item.appendChild(textEl);
  item.appendChild(actions);
  return item;
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function setupModal() {
  document.getElementById('cancelEditBtn').addEventListener('click', closeModal);
  document.getElementById('editModal').addEventListener('click', function (e) {
    if (e.target === this) closeModal();
  });

  const editEnabledBtn = document.getElementById('editEnabled');
  editEnabledBtn.addEventListener('click', function () {
    this.classList.toggle('on');
    document.getElementById('editEnabledLabel').textContent =
      this.classList.contains('on') ? 'Enabled' : 'Disabled';
  });

  document.getElementById('saveEditBtn').addEventListener('click', saveEdit);
}

function openEditModal(shortcut) {
  const entry = snippets[shortcut];
  document.getElementById('editOriginalShortcut').value = shortcut;
  document.getElementById('editShortcut').value = shortcut;
  document.getElementById('editText').value = getText(entry);
  document.getElementById('editCategory').value = getCat(entry);

  const enabledBtn = document.getElementById('editEnabled');
  const en = getEnabled(entry);
  enabledBtn.classList.toggle('on', en);
  document.getElementById('editEnabledLabel').textContent = en ? 'Enabled' : 'Disabled';

  document.getElementById('editModal').classList.add('open');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
}

function saveEdit() {
  const original = document.getElementById('editOriginalShortcut').value;
  const newShortcut = document.getElementById('editShortcut').value.trim();
  const newText = document.getElementById('editText').value.trim();
  const newCat = document.getElementById('editCategory').value.trim() || 'General';
  const enabled = document.getElementById('editEnabled').classList.contains('on');

  if (!newShortcut) { showToast('⚠️ Shortcut cannot be empty', true); return; }
  if (!newText)     { showToast('⚠️ Text cannot be empty', true); return; }

  const existing = snippets[original] || {};
  const updated = {
    text: newText,
    category: newCat,
    enabled,
    usageCount: getUsage(existing),
    createdAt: getCreatedAt(existing) || Date.now(),
    lastUsed: typeof existing === 'object' ? existing.lastUsed : undefined,
  };

  if (original !== newShortcut) delete snippets[original];
  snippets[newShortcut] = updated;

  saveSnippets(() => {
    closeModal();
    renderSnippets();
    updateTotalCount();
    updateCategoryLists();
    showToast('✅ Snippet updated');
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────
function setupSettings() {
  setupToggle('caseSensitiveToggle', 'caseLabel', 'Case sensitive (default)', 'Case insensitive');
  setupToggle('suggestionsToggle', 'suggestionsLabel', 'Suggestions on', 'Suggestions off');

  const durationEl = document.getElementById('suggDuration');
  const durationLabel = document.getElementById('suggDurationLabel');
  durationEl.addEventListener('input', function () {
    durationLabel.textContent = (this.value / 1000).toFixed(1) + 's';
  });

  document.getElementById('saveSettingsBtn').addEventListener('click', function () {
    settings.triggerKey = document.getElementById('triggerKey').value;
    settings.caseSensitive = document.getElementById('caseSensitiveToggle').classList.contains('on');
    settings.showSuggestions = document.getElementById('suggestionsToggle').classList.contains('on');
    settings.suggestionDuration = parseInt(document.getElementById('suggDuration').value);

    chrome.storage.sync.set({
      triggerKey: settings.triggerKey,
      caseSensitive: settings.caseSensitive,
      showSuggestions: settings.showSuggestions,
      suggestionDuration: settings.suggestionDuration,
    }, function () {
      if (chrome.runtime.lastError) {
        showToast('⚠️ Save failed', true);
      } else {
        showToast('⚙️ Settings saved');
      }
    });
  });
}

function populateSettings() {
  document.getElementById('triggerKey').value = settings.triggerKey;
  setToggle('caseSensitiveToggle', 'caseLabel', settings.caseSensitive, 'Case sensitive (default)', 'Case insensitive');
  setToggle('suggestionsToggle', 'suggestionsLabel', settings.showSuggestions, 'Suggestions on', 'Suggestions off');

  const dur = document.getElementById('suggDuration');
  dur.value = settings.suggestionDuration;
  document.getElementById('suggDurationLabel').textContent = (settings.suggestionDuration / 1000).toFixed(1) + 's';
}

function setupToggle(btnId, labelId, onText, offText) {
  document.getElementById(btnId).addEventListener('click', function () {
    this.classList.toggle('on');
    document.getElementById(labelId).textContent =
      this.classList.contains('on') ? onText : offText;
  });
}

function setToggle(btnId, labelId, value, onText, offText) {
  const btn = document.getElementById(btnId);
  btn.classList.toggle('on', value);
  document.getElementById(labelId).textContent = value ? onText : offText;
}

// ── Variables Panel ───────────────────────────────────────────────────────────
function setupVariablesPanel() {
  const VAR_GROUPS = [
    {
      group: '📅 Date & Time',
      vars: [
        { name: '{date}',     desc: 'Full date in local format',         example: 'e.g. 3/19/2026' },
        { name: '{time}',     desc: '24-hour time (HH:MM)',              example: 'e.g. 14:35' },
        { name: '{time12}',   desc: '12-hour time with AM/PM',           example: 'e.g. 2:35 PM' },
        { name: '{datetime}', desc: 'Full date and time',                example: 'e.g. 3/19/2026, 2:35 PM' },
        { name: '{day}',      desc: 'Full weekday name',                 example: 'e.g. Thursday' },
        { name: '{dayshort}', desc: 'Abbreviated weekday',               example: 'e.g. Thu' },
        { name: '{month}',    desc: 'Full month name',                   example: 'e.g. March' },
        { name: '{monthnum}', desc: 'Month as 2-digit number',           example: 'e.g. 03' },
        { name: '{year}',     desc: 'Full 4-digit year',                 example: 'e.g. 2026' },
        { name: '{year2}',    desc: 'Last 2 digits of year',             example: 'e.g. 26' },
        { name: '{quarter}',  desc: 'Current business quarter',          example: 'e.g. Q1' },
        { name: '{weeknum}',  desc: 'ISO week number of the year',       example: 'e.g. 12' },
        { name: '{iso}',      desc: 'Full ISO 8601 timestamp',           example: 'e.g. 2026-03-19T14:35:00Z' },
        { name: '{timestamp}',desc: 'Unix timestamp in milliseconds',    example: 'e.g. 1742389200000' },
      ]
    },
    {
      group: '🌐 Page Context',
      vars: [
        { name: '{domain}',   desc: 'Hostname of the current website',   example: 'e.g. mail.google.com' },
        { name: '{url}',      desc: 'Full URL of the current page',      example: 'e.g. https://example.com/page' },
        { name: '{title}',    desc: 'Tab title of the current page',     example: 'e.g. Gmail – Inbox' },
      ]
    },
    {
      group: '💬 Smart Text',
      vars: [
        { name: '{greeting}',       desc: 'Time-aware greeting',                  example: 'Good morning / afternoon / evening' },
        { name: '{timezone}',       desc: 'Your local timezone name',             example: 'e.g. America/New_York' },
        { name: '{random}',         desc: 'Random 4-digit number',                example: 'e.g. 4271' },
        { name: '{random:1-100}',   desc: 'Random number in a custom range',      example: 'e.g. {random:1-100} → 42' },
        { name: '{uuid}',           desc: 'Random UUID v4 string',                example: 'e.g. a3f1c2d4-...' },
      ]
    },
    {
      group: '✏️ Cursor Control',
      vars: [
        { name: '{cursor}',   desc: 'Move cursor here after expansion',   example: '(caret lands at this position)' },
      ]
    },
  ];

  const grid = document.getElementById('varGrid');
  grid.innerHTML = '';
  // Override grid to be single-column groups layout
  grid.style.cssText = 'display:flex;flex-direction:column;gap:24px';

  VAR_GROUPS.forEach(({ group, vars }) => {
    const section = document.createElement('div');

    const groupLabel = document.createElement('div');
    groupLabel.textContent = group;
    groupLabel.style.cssText = 'font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px';
    section.appendChild(groupLabel);

    const cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px';

    vars.forEach(v => {
      const card = document.createElement('div');
      card.className = 'var-card';
      card.style.cursor = 'pointer';
      card.title = 'Click to copy';

      const name = document.createElement('div');
      name.className = 'var-name';
      name.textContent = v.name;

      const desc = document.createElement('div');
      desc.className = 'var-desc';
      desc.textContent = v.desc;

      const ex = document.createElement('div');
      ex.className = 'var-example';
      ex.textContent = v.example;

      card.appendChild(name);
      card.appendChild(desc);
      card.appendChild(ex);

      card.addEventListener('click', () => {
        navigator.clipboard.writeText(v.name).catch(() => {});
        showToast('📋 Copied ' + v.name);
      });

      cardsRow.appendChild(card);
    });

    section.appendChild(cardsRow);
    grid.appendChild(section);
  });
}

// ── Import / Export ───────────────────────────────────────────────────────────
function setupImportExport() {
  // Export
  document.getElementById('exportBtn').addEventListener('click', function () {
    const json = buildExportJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'qte-snippets-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('exportArea').value = json;
    showToast('📤 Exported ' + Object.keys(snippets).length + ' snippets');
  });

  document.getElementById('copyExportBtn').addEventListener('click', function () {
    const json = buildExportJson();
    document.getElementById('exportArea').value = json;
    navigator.clipboard.writeText(json).then(() => {
      showToast('📋 Copied to clipboard');
    }).catch(() => showToast('⚠️ Copy failed', true));
  });

  // Import
  document.getElementById('importBtn').addEventListener('click', function () {
    const raw = document.getElementById('importArea').value.trim();
    if (!raw) { showToast('⚠️ Nothing to import', true); return; }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      showToast('⚠️ Invalid JSON: ' + e.message, true);
      return;
    }

    let count = 0;
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'string') {
        snippets[key] = { text: val, category: 'Imported', enabled: true, usageCount: 0, createdAt: Date.now() };
        count++;
      } else if (val && typeof val.text === 'string') {
        snippets[key] = { ...val, usageCount: val.usageCount || 0, createdAt: val.createdAt || Date.now() };
        count++;
      }
    }

    if (count === 0) { showToast('⚠️ No valid snippets found', true); return; }

    saveSnippets(() => {
      renderSnippets();
      updateTotalCount();
      updateCategoryLists();
      document.getElementById('importArea').value = '';
      showToast('📥 Imported ' + count + ' snippet' + (count === 1 ? '' : 's'));
    });
  });

  document.getElementById('clearImportBtn').addEventListener('click', function () {
    document.getElementById('importArea').value = '';
  });
}

function buildExportJson() {
  return JSON.stringify(snippets, null, 2);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, isError = false) {
  // Remove any existing toast
  document.querySelectorAll('.toast').forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = 'toast';
  if (isError) toast.style.borderColor = 'rgba(239,68,68,.4)';

  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  // Extract emoji from start of message for icon
  const emojiMatch = message.match(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}⚠✅📋⚙️⏸▶🗑📤📥✨]/u);
  if (emojiMatch) {
    icon.textContent = emojiMatch[0];
    message = message.slice(emojiMatch[0].length).trimStart();
  }

  const text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}
