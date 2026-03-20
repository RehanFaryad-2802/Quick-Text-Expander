// ===== QUICK TEXT EXPANDER PRO – POPUP SCRIPT =====

let allSnippets = {};
let activeCategory = 'All';
let searchQuery = '';

document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.sync.get(['snippets', 'triggerKey'], function (result) {
    allSnippets = result.snippets || {};
    const triggerKey = result.triggerKey || 'Tab';
    const keyLabel = triggerKey === ' ' ? 'Space' : triggerKey;
    document.getElementById('triggerHint').textContent = keyLabel;
    buildUI();
  });

  document.getElementById('manageBtn').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('search').addEventListener('input', function () {
    searchQuery = this.value.trim().toLowerCase();
    renderSnippets();
  });
});

// ── Build category tabs and initial render ────────────────────────────────────
function buildUI() {
  const categories = new Set(['All']);
  for (const entry of Object.values(allSnippets)) {
    const cat = (typeof entry === 'object' && entry.category) ? entry.category : 'General';
    categories.add(cat);
  }

  const tabsEl = document.getElementById('tabs');
  tabsEl.innerHTML = '';
  for (const cat of categories) {
    const btn = document.createElement('button');
    btn.className = 'tab' + (cat === 'All' ? ' active' : '');
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.addEventListener('click', function () {
      activeCategory = cat;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderSnippets();
    });
    tabsEl.appendChild(btn);
  }

  renderStats();
  renderSnippets();
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function renderStats() {
  const entries = Object.values(allSnippets);
  const total = entries.length;
  const enabled = entries.filter(e => typeof e === 'string' || e.enabled !== false).length;
  const totalUses = entries.reduce((sum, e) => sum + ((typeof e === 'object' && e.usageCount) || 0), 0);

  const bar = document.getElementById('statsBar');
  bar.innerHTML = '';

  function stat(label) {
    const s = document.createElement('span');
    s.className = 'stat';
    const dot = document.createElement('span');
    dot.className = 'stat-dot';
    s.appendChild(dot);
    s.appendChild(document.createTextNode(label));
    return s;
  }

  bar.appendChild(stat(`${enabled}/${total} snippets`));
  if (totalUses > 0) {
    const sep = document.createElement('span');
    sep.style.cssText = 'color:#374151;padding:0 2px';
    sep.textContent = '·';
    bar.appendChild(sep);
    bar.appendChild(stat(`${totalUses} total expansions`));
  }
}

// ── Snippet list render ───────────────────────────────────────────────────────
function renderSnippets() {
  const container = document.getElementById('snippets');

  const filtered = Object.entries(allSnippets).filter(([shortcut, entry]) => {
    // Category filter
    if (activeCategory !== 'All') {
      const cat = (typeof entry === 'object' && entry.category) ? entry.category : 'General';
      if (cat !== activeCategory) return false;
    }
    // Search filter
    if (searchQuery) {
      const text = typeof entry === 'string' ? entry : (entry.text || '');
      const inShortcut = shortcut.toLowerCase().includes(searchQuery);
      const inText = text.toLowerCase().includes(searchQuery);
      if (!inShortcut && !inText) return false;
    }
    return true;
  });

  if (Object.keys(allSnippets).length === 0) {
    container.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'empty';
    const icon = document.createElement('div');
    icon.className = 'empty-icon';
    icon.textContent = '⚡';
    const title = document.createElement('div');
    title.className = 'empty-title';
    title.textContent = 'No snippets yet';
    const hint = document.createElement('div');
    hint.className = 'empty-hint';
    hint.textContent = 'Click "Manage Snippets" to add your first one';
    empty.appendChild(icon);
    empty.appendChild(title);
    empty.appendChild(hint);
    container.appendChild(empty);
    return;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    const noRes = document.createElement('div');
    noRes.className = 'no-results';
    noRes.textContent = 'No snippets match your search';
    container.appendChild(noRes);
    return;
  }

  // Sort: most-used first
  filtered.sort(([, a], [, b]) => {
    const au = (typeof a === 'object' && a.usageCount) || 0;
    const bu = (typeof b === 'object' && b.usageCount) || 0;
    return bu - au;
  });

  container.innerHTML = '';

  for (const [shortcut, entry] of filtered) {
    const text = typeof entry === 'string' ? entry : (entry.text || '');
    const cat = (typeof entry === 'object' && entry.category) ? entry.category : 'General';
    const usage = (typeof entry === 'object' && entry.usageCount) || 0;
    const enabled = typeof entry === 'string' || entry.enabled !== false;
    const preview = text.length > 60 ? text.slice(0, 60) + '…' : text;

    const card = document.createElement('div');
    card.className = 'snippet-card' + (enabled ? '' : ' disabled');

    // Top row
    const top = document.createElement('div');
    top.className = 'card-top';

    const tag = document.createElement('span');
    tag.className = 'shortcut-tag';
    tag.textContent = shortcut; // safe: textContent

    const catTag = document.createElement('span');
    catTag.className = 'cat-tag';
    catTag.textContent = cat;

    top.appendChild(tag);
    top.appendChild(catTag);

    if (usage > 0) {
      const usageEl = document.createElement('span');
      usageEl.className = 'usage-count';
      usageEl.textContent = `↩ ${usage}`;
      top.appendChild(usageEl);
    }

    const previewEl = document.createElement('div');
    previewEl.className = 'preview';
    previewEl.textContent = preview; // safe: textContent

    card.appendChild(top);
    card.appendChild(previewEl);
    container.appendChild(card);
  }
}
