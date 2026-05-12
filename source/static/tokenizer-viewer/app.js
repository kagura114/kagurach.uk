// ============ LOAD CHART.JS ============
const _chartReady = (function() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('加载 Chart.js 失败'));
    document.head.appendChild(s);
  });
})();

// ============ STATE ============
let allTokens = []; // [{token, id, type, length, decoded}]
let filteredTokens = [];
let vocabIdMap = {}; // {token: id}
let decodedVocabIdMap = {}; // {decoded_token: id}
let currentPage = 1;
let pageSize = 100;
const INFINITE_PAGE_SIZE = 'inf';
const INFINITE_CHUNK_SIZE = 200;
let infiniteTokensLoaded = 0;
let sortField = 'id';
let sortDir = 'asc';
let charts = {};

// Merges state
let allMerges = []; // [{rank, left, right, merged, decodedLeft, decodedRight, decodedMerged, resultId}]
let filteredMerges = [];
let mergesPage = 1;
let mergesPageSize = 100;
let infiniteMergesLoaded = 0;
let mergesSortField = 'rank';
let mergesSortDir = 'asc';

// ============ GPT-2 BYTE-LEVEL BPE DECODER ============
// GPT-2 uses a byte-to-unicode mapping for its BPE tokens.
// Characters like Ġ (U+0120) = space (0x20), Ċ (U+010A) = newline (0x0A), etc.
// We build the reverse map to decode raw tokens into human-readable text.

function buildBytesToUnicode() {
  // This replicates the bytes_to_unicode() function from GPT-2's encoder.py
  const bs = [];
  // printable ASCII ranges that map to themselves
  for (let i = '!'.charCodeAt(0); i <= '~'.charCodeAt(0); i++) bs.push(i);
  for (let i = '¡'.charCodeAt(0); i <= '¬'.charCodeAt(0); i++) bs.push(i);
  for (let i = '®'.charCodeAt(0); i <= 'ÿ'.charCodeAt(0); i++) bs.push(i);

  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (!bs.includes(b)) {
      bs.push(b);
      cs.push(256 + n);
      n++;
    }
  }
  // bs[i] -> cs[i] means byte bs[i] is represented as unicode char cs[i]
  // We want reverse: unicode char -> original byte
  const unicodeToByte = {};
  for (let i = 0; i < bs.length; i++) {
    unicodeToByte[String.fromCodePoint(cs[i])] = bs[i];
  }
  return unicodeToByte;
}

const UNICODE_TO_BYTE = buildBytesToUnicode();

function decodeToken(rawToken) {
  let token = rawToken;

  // Check if this is a special token (wrapped in < >) - don't decode those
  if (/^<[^>]+>$/.test(token) || /^<｜[^｜]+｜>$/.test(token)) {
    return token;
  }

  // Check if this is a byte-fallback token like <0xAB>
  if (/^<0x[0-9A-Fa-f]{2}>$/.test(token)) {
    const byte = parseInt(token.slice(3, 5), 16);
    if (byte >= 32 && byte < 127) return String.fromCharCode(byte);
    return `[0x${byte.toString(16).padStart(2, '0').toUpperCase()}]`;
  }

  // GPT-2 byte-level BPE decode:
  // Convert through the byte map, then try UTF-8 decode.
  // If UTF-8 decode fails (incomplete multi-byte sequence), show hex bytes.
  const chars = [...token];
  const allInMap = chars.length > 0 && chars.every(ch => ch in UNICODE_TO_BYTE);

  if (allInMap) {
    const bytes = new Uint8Array(chars.map(ch => UNICODE_TO_BYTE[ch]));
    return decodeBytesForDisplay(bytes);
  }

  // SentencePiece-style: ▁ = space prefix
  if (token.includes('▁')) {
    return token.replace(/▁/g, ' ');
  }

  return token;
}

// Core byte-to-display function: given raw bytes, produce the best
// human-readable representation. Valid UTF-8 runs are decoded as text;
// orphan / incomplete bytes are shown as [XX] hex.
function decodeBytesForDisplay(bytes) {
  const parts = [];
  let i = 0;

  while (i < bytes.length) {
    const b = bytes[i];
    let seqLen = 0;

    // Determine expected UTF-8 sequence length from the leading byte
    if (b < 0x80)      seqLen = 1;  // 0xxxxxxx  ASCII
    else if (b < 0xC0) seqLen = 0;  // 10xxxxxx  continuation byte (orphan)
    else if (b < 0xE0) seqLen = 2;  // 110xxxxx
    else if (b < 0xF0) seqLen = 3;  // 1110xxxx
    else if (b < 0xF8) seqLen = 4;  // 11110xxx
    else                seqLen = 0;  // Invalid leading byte

    if (seqLen === 0) {
      // Orphan continuation byte or invalid — show as hex
      parts.push(`[${byteHex(b)}]`);
      i++;
      continue;
    }

    if (i + seqLen > bytes.length) {
      // Incomplete sequence at the end — show remaining as hex
      while (i < bytes.length) {
        parts.push(`[${byteHex(bytes[i])}]`);
        i++;
      }
      break;
    }

    // Verify continuation bytes
    let valid = true;
    for (let j = 1; j < seqLen; j++) {
      if ((bytes[i + j] & 0xC0) !== 0x80) { valid = false; break; }
    }

    if (!valid) {
      parts.push(`[${byteHex(b)}]`);
      i++;
      continue;
    }

    // Valid UTF-8 sequence — decode it
    const slice = bytes.slice(i, i + seqLen);
    try {
      const ch = new TextDecoder('utf-8', { fatal: true }).decode(slice);
      parts.push(formatCharForDisplay(ch));
    } catch {
      // Overlong encoding or other oddity
      for (let j = 0; j < seqLen; j++) {
        parts.push(`[${byteHex(bytes[i + j])}]`);
      }
    }
    i += seqLen;
  }

  return parts.join('');
}

function byteHex(b) {
  return b.toString(16).padStart(2, '0').toUpperCase();
}

// Convert raw bytes for a GPT-2 token, returning the Uint8Array.
// Returns null if the token is not in the byte map.
function tokenToBytes(rawToken) {
  const chars = [...rawToken];
  if (chars.length === 0) return null;
  if (!chars.every(ch => ch in UNICODE_TO_BYTE)) return null;
  return new Uint8Array(chars.map(ch => UNICODE_TO_BYTE[ch]));
}

// Decode a merge pair: concatenate the raw bytes of left+right, then decode
// the combined bytes. This handles cases where left and right are each
// incomplete UTF-8 fragments that only become valid when joined.
function decodeMergePair(left, right) {
  const leftBytes = tokenToBytes(left);
  const rightBytes = tokenToBytes(right);

  // Decode individual pieces (with hex fallback for fragments)
  const decodedLeft = decodeToken(left);
  const decodedRight = decodeToken(right);

  // Decode the merged bytes (combined may form valid UTF-8)
  let decodedMerged;
  if (leftBytes && rightBytes) {
    const combined = new Uint8Array(leftBytes.length + rightBytes.length);
    combined.set(leftBytes, 0);
    combined.set(rightBytes, leftBytes.length);
    decodedMerged = decodeBytesForDisplay(combined);
  } else {
    // Fallback: just concatenate the individual decoded strings
    decodedMerged = decodedLeft + decodedRight;
  }

  return { decodedLeft, decodedRight, decodedMerged };
}

function formatCharForDisplay(ch) {
  // Make invisible/whitespace characters visible while keeping text readable
  switch (ch) {
    case '\t':   return '⇥TAB';
    case '\n':   return '↵';
    case '\r':   return '↵';
    case '\xA0': return '·NBSP';
    case '\x00': return '␀';
    case '\x0B': return '[VT]';
    case '\x0C': return '[FF]';
    case '\x7F': return '[DEL]';
    case '�': return '[FFFD]'; // replacement character
    default:
      // Other C0 controls
      const code = ch.charCodeAt(0);
      if (code >= 0x01 && code <= 0x08) return `[0x${byteHex(code)}]`;
      if (code >= 0x0E && code <= 0x1F) return `[0x${byteHex(code)}]`;
      return ch;
  }
}

function formatDecodedForDisplay(decoded) {
  // Character-by-character display formatting
  return [...decoded].map(formatCharForDisplay).join('');
}

const viewerRoot = document.querySelector('.tokenizer-viewer');

function getCssVar(name, fallback = '') {
  if (!viewerRoot) return fallback;
  const value = getComputedStyle(viewerRoot).getPropertyValue(name).trim();
  return value || fallback;
}

// ============ DOM REFS ============
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const urlInput = document.getElementById('urlInput');
const loadUrlBtn = document.getElementById('loadUrlBtn');
const exportBar = document.getElementById('exportBar');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const exportRawJsonBtn = document.getElementById('exportRawJsonBtn');
const copyJsonBtn = document.getElementById('copyJsonBtn');
const loadingState = document.getElementById('loadingState');
const emptyState = document.getElementById('emptyState');
const contentArea = document.getElementById('contentArea');
const searchInput = document.getElementById('searchInput');
const regexToggle = document.getElementById('regexToggle');
const typeFilter = document.getElementById('typeFilter');
const idMin = document.getElementById('idMin');
const idMax = document.getElementById('idMax');
const lengthFilter = document.getElementById('lengthFilter');
const tokenTableBody = document.getElementById('tokenTableBody');
const tableInfo = document.getElementById('tableInfo');
const pageInfo = document.getElementById('pageInfo');
const pageControls = document.getElementById('pageControls');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const tokenTableScroll = viewerRoot.querySelector('#tabVocab .table-scroll');
const idGapHint = document.getElementById('idGapHint');

// Merges DOM refs
const mergesBadge = document.getElementById('mergesBadge');
const mergesSearchInput = document.getElementById('mergesSearchInput');
const mergesRegexToggle = document.getElementById('mergesRegexToggle');
const mergesRankMin = document.getElementById('mergesRankMin');
const mergesRankMax = document.getElementById('mergesRankMax');
const mergesTableBody = document.getElementById('mergesTableBody');
const mergesTableInfo = document.getElementById('mergesTableInfo');
const mergesPageInfo = document.getElementById('mergesPageInfo');
const mergesPageControls = document.getElementById('mergesPageControls');
const mergesPageSizeSelect = document.getElementById('mergesPageSizeSelect');
const mergesEmptyState = document.getElementById('mergesEmptyState');
const mergesTableScroll = viewerRoot.querySelector('#tabMerges .table-scroll');

function isInfiniteMode(value) {
  return value === INFINITE_PAGE_SIZE;
}

function buildTokenRows(pageTokens, startIndex = 0) {
  return pageTokens.map((t, i) => {
    const isDifferent = t.token !== t.decoded;
    const decodedClass = isDifferent ? 'decoded-cell decoded-highlight' : 'decoded-cell';
    return `
    <tr>
      <td style="color:var(--text-muted)">${startIndex + i + 1}</td>
      <td class="token-cell" title="${escapeHtml(t.token)}">${escapeHtml(t.token)}</td>
      <td class="${decodedClass}" title="${escapeHtml(t.decoded)}">${escapeHtml(t.decoded)}</td>
      <td><strong>${t.id.toLocaleString()}</strong></td>
      <td><span class="badge badge-${t.type}">${t.type}</span></td>
      <td>${t.length}</td>
      <td><button class="copy-btn" onclick="copyToken(this, '${escapeJs(t.decoded)}', ${t.id})">复制</button></td>
    </tr>`;
  }).join('');
}

function updateInfiniteTokenStatus() {
  const visibleCount = Math.min(infiniteTokensLoaded, filteredTokens.length);
  tableInfo.textContent = `已显示 ${visibleCount.toLocaleString()} / ${filteredTokens.length.toLocaleString()} 个词元（总计 ${allTokens.length.toLocaleString()} 个）`;
  pageInfo.textContent = visibleCount >= filteredTokens.length
    ? `无限滚动，已加载全部 ${visibleCount.toLocaleString()} 项`
    : `无限滚动，已加载 ${visibleCount.toLocaleString()} / ${filteredTokens.length.toLocaleString()} 项`;
  pageControls.innerHTML = '';
  tokenTableScroll.classList.add('is-infinite');
}

function maybeLoadMoreTokens() {
  if (!isInfiniteMode(pageSize) || infiniteTokensLoaded >= filteredTokens.length) return;
  if (tokenTableScroll.scrollTop + tokenTableScroll.clientHeight < tokenTableScroll.scrollHeight - 120) return;

  const nextLoaded = Math.min(infiniteTokensLoaded + INFINITE_CHUNK_SIZE, filteredTokens.length);
  tokenTableBody.insertAdjacentHTML('beforeend', buildTokenRows(filteredTokens.slice(infiniteTokensLoaded, nextLoaded), infiniteTokensLoaded));
  infiniteTokensLoaded = nextLoaded;
  updateInfiniteTokenStatus();
}

function buildMergeRows(pageMerges) {
  return pageMerges.map(m => {
    const idStr = m.resultId !== null ? m.resultId.toLocaleString() : '-';
    return `
    <tr>
      <td class="rank-cell">${m.rank.toLocaleString()}</td>
      <td class="merge-raw" title="${escapeHtml(m.left)}">${escapeHtml(m.left)}</td>
      <td class="merge-raw" title="${escapeHtml(m.right)}">${escapeHtml(m.right)}</td>
      <td class="merge-arrow">+</td>
      <td><span class="merge-decoded" title="${escapeHtml(m.decodedLeft)}">${escapeHtml(m.decodedLeft)}</span></td>
      <td><span class="merge-decoded" title="${escapeHtml(m.decodedRight)}">${escapeHtml(m.decodedRight)}</span></td>
      <td class="merge-arrow">→</td>
      <td><span class="merge-result" title="${escapeHtml(m.decodedMerged)}">${escapeHtml(m.decodedMerged)}</span></td>
      <td><strong>${idStr}</strong></td>
    </tr>`;
  }).join('');
}

function updateInfiniteMergesStatus() {
  const visibleCount = Math.min(infiniteMergesLoaded, filteredMerges.length);
  mergesTableInfo.textContent = `已显示 ${visibleCount.toLocaleString()} / ${filteredMerges.length.toLocaleString()} 条合并规则（总计 ${allMerges.length.toLocaleString()} 条）`;
  mergesPageInfo.textContent = visibleCount >= filteredMerges.length
    ? `无限滚动，已加载全部 ${visibleCount.toLocaleString()} 项`
    : `无限滚动，已加载 ${visibleCount.toLocaleString()} / ${filteredMerges.length.toLocaleString()} 项`;
  mergesPageControls.innerHTML = '';
  mergesTableScroll.classList.add('is-infinite');
}

function maybeLoadMoreMerges() {
  if (!isInfiniteMode(mergesPageSize) || infiniteMergesLoaded >= filteredMerges.length) return;
  if (mergesTableScroll.scrollTop + mergesTableScroll.clientHeight < mergesTableScroll.scrollHeight - 120) return;

  const nextLoaded = Math.min(infiniteMergesLoaded + INFINITE_CHUNK_SIZE, filteredMerges.length);
  mergesTableBody.insertAdjacentHTML('beforeend', buildMergeRows(filteredMerges.slice(infiniteMergesLoaded, nextLoaded)));
  infiniteMergesLoaded = nextLoaded;
  updateInfiniteMergesStatus();
}

// ============ TAB SWITCHING ============
viewerRoot.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    viewerRoot.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    viewerRoot.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    viewerRoot.querySelector('#tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)).classList.add('active');
  });
});

// ============ FILE LOADING ============
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

loadUrlBtn.addEventListener('click', () => {
  const url = urlInput.value.trim();
  if (url) loadFromUrl(url);
});

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadUrlBtn.click();
});

// Preset quick-select buttons
document.querySelectorAll('.btn-preset[data-url]').forEach(btn => {
  btn.addEventListener('click', () => {
    const url = btn.dataset.url;
    urlInput.value = url;
    document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('is-loading'));
    btn.classList.add('is-loading');
    loadFromUrl(url).finally(() => btn.classList.remove('is-loading'));
  });
});

function loadFile(file) {
  showLoading();
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      processTokenizer(data);
    } catch (err) {
      showToast('解析 JSON 失败：' + err.message, 'error');
      hideLoading();
    }
  };
  reader.readAsText(file);
}

async function loadFromUrl(url) {
  showLoading();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const data = await res.json();
    processTokenizer(data);
  } catch (err) {
    showToast('获取失败：' + err.message, 'error');
    hideLoading();
  }
}

// ============ PARSER ============
function processTokenizer(data) {
  allTokens = [];
  vocabIdMap = {};
  decodedVocabIdMap = {};
  const specialTokenIds = new Set();

  // Collect added_tokens special IDs
  if (data.added_tokens && Array.isArray(data.added_tokens)) {
    for (const t of data.added_tokens) {
      if (t.special) specialTokenIds.add(t.id);
    }
  }

  // Parse model.vocab (main vocab: {token: id})
  if (data.model && data.model.vocab) {
    for (const [token, id] of Object.entries(data.model.vocab)) {
      const isSpecial = specialTokenIds.has(id);
      const decoded = decodeToken(token);
      allTokens.push({ token, decoded, id, type: isSpecial ? 'special' : 'normal', length: decoded.length });
      vocabIdMap[token] = id;
      decodedVocabIdMap[decoded] = id;
    }
  }

  // Parse added_tokens that might not be in model.vocab
  if (data.added_tokens && Array.isArray(data.added_tokens)) {
    for (const t of data.added_tokens) {
      if (!(t.content in vocabIdMap)) {
        const decoded = decodeToken(t.content);
        allTokens.push({
          token: t.content,
          decoded,
          id: t.id,
          type: t.special ? 'special' : 'normal',
          length: decoded.length
        });
        vocabIdMap[t.content] = t.id;
        decodedVocabIdMap[decoded] = t.id;
      } else {
        // Update type if in vocab but marked special in added_tokens
        if (t.special) {
          const existing = allTokens.find(x => x.token === t.content);
          if (existing) existing.type = 'special';
        }
      }
    }
  }

  // Sort by ID initially
  allTokens.sort((a, b) => a.id - b.id);
  filteredTokens = [...allTokens];

  // Parse model.merges
  // Supports both formats:
  //   - String format (GPT-2/LLaMA style): ["Ġ t", "e r", ...]
  //   - Array format (GLM/some newer models): [["Ġ", "t"], ["e", "r"], ...]
  allMerges = [];
  if (data.model && data.model.merges && Array.isArray(data.model.merges)) {
    for (let i = 0; i < data.model.merges.length; i++) {
      const entry = data.model.merges[i];
      let left, right;

      if (typeof entry === 'string') {
        // Standard string format: "tokenA tokenB"
        const parts = entry.split(' ');
        if (parts.length < 2) continue;
        left = parts[0];
        right = parts.slice(1).join(' '); // handle edge case of space token
      } else if (Array.isArray(entry) && entry.length >= 2) {
        // Array format: ["tokenA", "tokenB"]
        left = entry[0];
        right = entry[1];
      } else {
        // Unknown format, skip
        continue;
      }

      const merged = left + right;
      const { decodedLeft, decodedRight, decodedMerged } = decodeMergePair(left, right);
      const resultId = vocabIdMap[merged] !== undefined ? vocabIdMap[merged] : null;
      allMerges.push({
        rank: i + 1,
        left, right, merged,
        decodedLeft, decodedRight, decodedMerged,
        resultId
      });
    }
  }
  filteredMerges = [...allMerges];

  // Update merges badge
  if (allMerges.length > 0) {
    mergesBadge.textContent = allMerges.length.toLocaleString();
    mergesBadge.classList.remove('hidden');
  } else {
    mergesBadge.classList.add('hidden');
  }

  hideLoading();
  showContent();
  updateStats();
  renderCharts();
  applyFilters();
  applyMergesFilters();
  showToast(`已加载 ${allTokens.length.toLocaleString()} 个词元，${allMerges.length.toLocaleString()} 条合并规则`, 'success');
}

// ============ STATS ============
function updateStats() {
  const total = allTokens.length;
  const special = allTokens.filter(t => t.type === 'special').length;
  const normal = total - special;
  let minId = Infinity, maxId = -Infinity;
  for (let i = 0; i < total; i++) {
    const id = allTokens[i].id;
    if (id < minId) minId = id;
    if (id > maxId) maxId = id;
  }
  let sumLen = 0;
  const lengths = new Array(total);
  for (let i = 0; i < total; i++) {
    lengths[i] = allTokens[i].length;
    sumLen += lengths[i];
  }
  const avgLen = (sumLen / total).toFixed(1);
  lengths.sort((a, b) => a - b);
  const medianLen = lengths[Math.floor(total / 2)];

  document.getElementById('statTotal').textContent = total.toLocaleString();
  document.getElementById('statSpecial').textContent = special.toLocaleString();
  document.getElementById('statNormal').textContent = normal.toLocaleString();
  document.getElementById('statIdRange').textContent = `${minId.toLocaleString()} - ${maxId.toLocaleString()}`;
  document.getElementById('statAvgLen').textContent = avgLen;
  document.getElementById('statMedianLen').textContent = medianLen;
  document.getElementById('statMerges').textContent = allMerges.length.toLocaleString();
}

// ============ CHARTS ============
function renderCharts() {
  _chartReady.then(_doRenderCharts).catch(err => console.warn('Chart.js unavailable:', err));
}

function updateIdGapHint() {
  if (!idGapHint) return;
  if (allTokens.length < 2) {
    idGapHint.textContent = 'ID 数量过少，无法判断是否存在空隙。';
    return;
  }

  let hasGap = false;
  for (let i = 1; i < allTokens.length; i++) {
    if (allTokens[i].id - allTokens[i - 1].id > 1) {
      hasGap = true;
      break;
    }
  }

  idGapHint.textContent = hasGap
    ? '检测结果：ID 存在空隙。'
    : '检测结果：ID 连续，无空隙。';
}

function _doRenderCharts() {
  // Destroy existing charts
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const textSoft = getCssVar('--tv-text-soft', '#70899a');
  const accent = getCssVar('--tv-accent', '#1aa3be');
  const accentStrong = getCssVar('--tv-accent-strong', '#0c7797');
  const special = getCssVar('--tv-special', '#cb6156');
  const success = getCssVar('--tv-success', '#2f9a68');
  const warning = getCssVar('--tv-warning', '#bf8927');
  const secondary = getCssVar('--tv-secondary', '#f2a65a');
  const gridColor = getCssVar('--tv-grid', 'rgba(114, 150, 170, 0.18)');

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: textSoft,
          usePointStyle: true,
          boxWidth: 10,
          padding: 14
        }
      }
    },
    scales: {
      x: { ticks: { color: textSoft }, grid: { color: gridColor } },
      y: { ticks: { color: textSoft }, grid: { color: gridColor } }
    }
  };

  // Length Histogram
  const lengths = allTokens.map(t => t.length);
  let _maxLenVal = 0;
  for (let i = 0; i < lengths.length; i++) { if (lengths[i] > _maxLenVal) _maxLenVal = lengths[i]; }
  const maxLen = Math.min(_maxLenVal, 50);
  const bins = {};
  const binSize = maxLen > 20 ? 5 : 1;
  for (const len of lengths) {
    const binKey = Math.floor(Math.min(len, maxLen) / binSize) * binSize;
    bins[binKey] = (bins[binKey] || 0) + 1;
  }
  const binKeys = Object.keys(bins).map(Number).sort((a, b) => a - b);

  charts.length = new Chart(document.getElementById('lengthChart'), {
    type: 'bar',
    data: {
      labels: binKeys.map(k => binSize > 1 ? `${k}-${k + binSize - 1}` : String(k)),
      datasets: [{
        label: '词元数量',
        data: binKeys.map(k => bins[k]),
        backgroundColor: 'rgba(26, 163, 190, 0.72)',
        borderColor: accentStrong,
        borderWidth: 1.5,
        borderRadius: 8,
        maxBarThickness: 26
      }]
    },
    options: { ...chartOptions, plugins: { legend: { display: false } } }
  });

  // Category Pie
  const categories = categorizeTokens();
  charts.category = new Chart(document.getElementById('categoryChart'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        borderWidth: 0,
        backgroundColor: [
          accentStrong,
          special,
          success,
          warning,
          secondary,
          '#6caed7',
          '#95a7b5'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textSoft,
            usePointStyle: true,
            boxWidth: 10,
            padding: 14
          }
        }
      }
    }
  });

  // ID Distribution
  const idRanges = {};
  const rangeSize = 10000;
  for (const t of allTokens) {
    const rangeKey = Math.floor(t.id / rangeSize) * rangeSize;
    idRanges[rangeKey] = (idRanges[rangeKey] || 0) + 1;
  }
  const rangeKeys = Object.keys(idRanges).map(Number).sort((a, b) => a - b);

  charts.id = new Chart(document.getElementById('idChart'), {
    type: 'bar',
    data: {
      labels: rangeKeys.map(k => `${(k / 1000).toFixed(0)}k-${((k + rangeSize) / 1000).toFixed(0)}k`),
      datasets: [{
        label: '区间词元数量',
        data: rangeKeys.map(k => idRanges[k]),
        backgroundColor: 'rgba(108, 174, 215, 0.72)',
        borderColor: accent,
        borderWidth: 1.5,
        borderRadius: 8,
        maxBarThickness: 26
      }]
    },
    options: { ...chartOptions, plugins: { legend: { display: false } } }
  });

  updateIdGapHint();
}

function categorizeTokens() {
  const cats = { '普通文本': 0, '特殊控制': 0, '字节词元': 0, '标点符号': 0, '空白字符': 0, 'CJK': 0, '其他': 0 };

  for (const t of allTokens) {
    if (t.type === 'special') {
      cats['特殊控制']++;
    } else if (/^<0x[0-9A-F]{2}>$/.test(t.token)) {
      cats['字节词元']++;
    } else if (/^[一-鿿㐀-䶿]+$/.test(t.token.replace(/^▁/, ''))) {
      cats['CJK']++;
    } else if (/^[^\w\s]+$/.test(t.token.replace(/^▁/, '')) || /^▁?[^\w\s]+$/.test(t.token)) {
      cats['标点符号']++;
    } else if (/^\s+$/.test(t.token) || t.token === '▁') {
      cats['空白字符']++;
    } else if (/^▁?[a-zA-Z]/.test(t.token) || /^▁?\w/.test(t.token)) {
      cats['普通文本']++;
    } else {
      cats['其他']++;
    }
  }

  // Remove empty categories
  return Object.fromEntries(Object.entries(cats).filter(([, v]) => v > 0));
}

// ============ FILTERING & SORTING ============
function applyFilters() {
  const query = searchInput.value;
  const useRegex = regexToggle.checked;
  const type = typeFilter.value;
  const minIdVal = idMin.value ? parseInt(idMin.value) : -Infinity;
  const maxIdVal = idMax.value ? parseInt(idMax.value) : Infinity;
  const lenFilter = lengthFilter.value;

  filteredTokens = allTokens.filter(t => {
    // Search (matches both raw token and decoded form)
    if (query) {
      if (useRegex) {
        try {
          const re = new RegExp(query, 'i');
          if (!re.test(t.token) && !re.test(t.decoded)) return false;
        } catch { return false; }
      } else {
        const q = query.toLowerCase();
        if (!t.token.toLowerCase().includes(q) && !t.decoded.toLowerCase().includes(q)) return false;
      }
    }

    // Type
    if (type !== 'all' && t.type !== type) return false;

    // ID range
    if (t.id < minIdVal || t.id > maxIdVal) return false;

    // Length
    if (lenFilter !== 'all') {
      if (lenFilter === '1' && t.length !== 1) return false;
      if (lenFilter === '2-3' && (t.length < 2 || t.length > 3)) return false;
      if (lenFilter === '4-8' && (t.length < 4 || t.length > 8)) return false;
      if (lenFilter === '9+' && t.length < 9) return false;
    }

    return true;
  });

  // Sort
  filteredTokens.sort((a, b) => {
    let cmp = 0;
    if (sortField === 'token') cmp = a.token.localeCompare(b.token);
    else if (sortField === 'decoded') cmp = a.decoded.localeCompare(b.decoded);
    else if (sortField === 'id') cmp = a.id - b.id;
    else if (sortField === 'type') cmp = a.type.localeCompare(b.type);
    else if (sortField === 'length') cmp = a.length - b.length;
    else if (sortField === 'index') cmp = a.id - b.id;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  currentPage = 1;
  infiniteTokensLoaded = 0;
  tokenTableScroll.scrollTop = 0;
  renderTable();
}

// ============ TABLE RENDERING ============
function renderTable() {
  const infiniteMode = isInfiniteMode(pageSize);
  const totalPages = infiniteMode ? 1 : Math.ceil(filteredTokens.length / pageSize);

  tokenTableScroll.classList.toggle('is-infinite', infiniteMode);

  if (filteredTokens.length === 0) {
    tableInfo.textContent = `显示 0 / 0 个词元（总计 ${allTokens.length.toLocaleString()} 个）`;
    tokenTableBody.innerHTML = '<tr><td colspan="7"><div class="table-empty">当前筛选条件下没有匹配的词元。</div></td></tr>';
    pageInfo.textContent = '第 1 页，共 1 页';
    pageControls.innerHTML = '';
    return;
  }

  if (infiniteMode) {
    infiniteTokensLoaded = Math.max(infiniteTokensLoaded, Math.min(INFINITE_CHUNK_SIZE, filteredTokens.length));
    tokenTableBody.innerHTML = buildTokenRows(filteredTokens.slice(0, infiniteTokensLoaded), 0);
    updateInfiniteTokenStatus();
    return;
  }

  const start = (currentPage - 1) * pageSize;
  const end = Math.min(start + pageSize, filteredTokens.length);
  const pageTokens = filteredTokens.slice(start, end);

  tableInfo.textContent = `显示第 ${start + 1}-${end} 项，共 ${filteredTokens.length.toLocaleString()} 个词元（总计 ${allTokens.length.toLocaleString()} 个）`;
  tokenTableBody.innerHTML = buildTokenRows(pageTokens, start);

  pageInfo.textContent = `第 ${currentPage} 页，共 ${totalPages || 1} 页`;
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  let html = '';
  html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(1)">«</button>`;
  html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">‹</button>`;

  // Show limited page numbers
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})">${p}</button>`;
  }

  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">›</button>`;
  html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="goToPage(${totalPages})">»</button>`;
  pageControls.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  renderTable();
  viewerRoot.querySelector('#tabVocab .table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============ SORTING ============
viewerRoot.querySelectorAll('#tabVocab thead th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.sort;
    if (sortField === field) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDir = 'asc';
    }
    // Update UI
    viewerRoot.querySelectorAll('#tabVocab thead th[data-sort]').forEach(h => h.classList.remove('sorted'));
    th.classList.add('sorted');
    th.querySelector('.sort-arrow').textContent = sortDir === 'asc' ? '↑' : '↓';
    applyFilters();
  });
});

// ============ FILTER EVENT LISTENERS ============
let filterTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(applyFilters, 200);
});
regexToggle.addEventListener('change', applyFilters);
typeFilter.addEventListener('change', applyFilters);
idMin.addEventListener('input', () => { clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFilters, 300); });
idMax.addEventListener('input', () => { clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFilters, 300); });
lengthFilter.addEventListener('change', applyFilters);
pageSizeSelect.addEventListener('change', (e) => {
  pageSize = e.target.value === INFINITE_PAGE_SIZE ? INFINITE_PAGE_SIZE : parseInt(e.target.value, 10);
  currentPage = 1;
  infiniteTokensLoaded = 0;
  tokenTableScroll.scrollTop = 0;
  renderTable();
});

tokenTableScroll.addEventListener('scroll', maybeLoadMoreTokens);

// ============ MERGES FILTER, SORT, RENDER ============
function applyMergesFilters() {
  const query = mergesSearchInput.value;
  const useRegex = mergesRegexToggle.checked;
  const minRank = mergesRankMin.value ? parseInt(mergesRankMin.value) : -Infinity;
  const maxRank = mergesRankMax.value ? parseInt(mergesRankMax.value) : Infinity;

  filteredMerges = allMerges.filter(m => {
    // Search (match raw or decoded forms of left, right, merged)
    if (query) {
      const fields = [m.left, m.right, m.merged, m.decodedLeft, m.decodedRight, m.decodedMerged];
      if (useRegex) {
        try {
          const re = new RegExp(query, 'i');
          if (!fields.some(f => re.test(f))) return false;
        } catch { return false; }
      } else {
        const q = query.toLowerCase();
        if (!fields.some(f => f.toLowerCase().includes(q))) return false;
      }
    }
    // Rank range
    if (m.rank < minRank || m.rank > maxRank) return false;
    return true;
  });

  // Sort
  filteredMerges.sort((a, b) => {
    let cmp = 0;
    if (mergesSortField === 'rank') cmp = a.rank - b.rank;
    else if (mergesSortField === 'left') cmp = a.left.localeCompare(b.left);
    else if (mergesSortField === 'right') cmp = a.right.localeCompare(b.right);
    else if (mergesSortField === 'decodedLeft') cmp = a.decodedLeft.localeCompare(b.decodedLeft);
    else if (mergesSortField === 'decodedRight') cmp = a.decodedRight.localeCompare(b.decodedRight);
    else if (mergesSortField === 'decodedMerged') cmp = a.decodedMerged.localeCompare(b.decodedMerged);
    return mergesSortDir === 'asc' ? cmp : -cmp;
  });

  mergesPage = 1;
  infiniteMergesLoaded = 0;
  mergesTableScroll.scrollTop = 0;
  renderMergesTable();
}

function renderMergesTable() {
  mergesTableScroll.classList.toggle('is-infinite', isInfiniteMode(mergesPageSize));

  if (allMerges.length === 0) {
    mergesEmptyState.style.display = 'block';
    mergesTableBody.closest('.table-container').style.display = 'none';
    return;
  }
  mergesEmptyState.style.display = 'none';
  mergesTableBody.closest('.table-container').style.display = '';

  if (filteredMerges.length === 0) {
    mergesTableInfo.textContent = `显示 0 / 0 条合并规则（总计 ${allMerges.length.toLocaleString()} 条）`;
    mergesTableBody.innerHTML = '<tr><td colspan="9"><div class="table-empty">当前筛选条件下没有匹配的合并规则。</div></td></tr>';
    mergesPageInfo.textContent = '第 1 页，共 1 页';
    mergesPageControls.innerHTML = '';
    return;
  }

  if (isInfiniteMode(mergesPageSize)) {
    infiniteMergesLoaded = Math.max(infiniteMergesLoaded, Math.min(INFINITE_CHUNK_SIZE, filteredMerges.length));
    mergesTableBody.innerHTML = buildMergeRows(filteredMerges.slice(0, infiniteMergesLoaded));
    updateInfiniteMergesStatus();
    return;
  }

  const totalPages = Math.ceil(filteredMerges.length / mergesPageSize);
  const start = (mergesPage - 1) * mergesPageSize;
  const end = Math.min(start + mergesPageSize, filteredMerges.length);
  const pageMerges = filteredMerges.slice(start, end);

  mergesTableInfo.textContent = `显示第 ${start + 1}-${end} 项，共 ${filteredMerges.length.toLocaleString()} 条合并规则（总计 ${allMerges.length.toLocaleString()} 条）`;
  mergesTableBody.innerHTML = buildMergeRows(pageMerges);

  mergesPageInfo.textContent = `第 ${mergesPage} 页，共 ${totalPages || 1} 页`;
  renderMergesPagination(totalPages);
}

function renderMergesPagination(totalPages) {
  let html = '';
  html += `<button class="page-btn" ${mergesPage <= 1 ? 'disabled' : ''} onclick="goToMergesPage(1)">«</button>`;
  html += `<button class="page-btn" ${mergesPage <= 1 ? 'disabled' : ''} onclick="goToMergesPage(${mergesPage - 1})">‹</button>`;

  const maxVisible = 5;
  let startPage = Math.max(1, mergesPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="page-btn ${p === mergesPage ? 'active' : ''}" onclick="goToMergesPage(${p})">${p}</button>`;
  }

  html += `<button class="page-btn" ${mergesPage >= totalPages ? 'disabled' : ''} onclick="goToMergesPage(${mergesPage + 1})">›</button>`;
  html += `<button class="page-btn" ${mergesPage >= totalPages ? 'disabled' : ''} onclick="goToMergesPage(${totalPages})">»</button>`;
  mergesPageControls.innerHTML = html;
}

function goToMergesPage(page) {
  mergesPage = page;
  renderMergesTable();
  viewerRoot.querySelector('#tabMerges .table-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Merges sorting
viewerRoot.querySelectorAll('#tabMerges thead th[data-msort]').forEach(th => {
  th.addEventListener('click', () => {
    const field = th.dataset.msort;
    if (mergesSortField === field) {
      mergesSortDir = mergesSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      mergesSortField = field;
      mergesSortDir = 'asc';
    }
    viewerRoot.querySelectorAll('#tabMerges thead th[data-msort]').forEach(h => h.classList.remove('sorted'));
    th.classList.add('sorted');
    th.querySelector('.sort-arrow').textContent = mergesSortDir === 'asc' ? '↑' : '↓';
    applyMergesFilters();
  });
});

// Merges filter event listeners
let mergesFilterTimeout;
mergesSearchInput.addEventListener('input', () => {
  clearTimeout(mergesFilterTimeout);
  mergesFilterTimeout = setTimeout(applyMergesFilters, 200);
});
mergesRegexToggle.addEventListener('change', applyMergesFilters);
mergesRankMin.addEventListener('input', () => { clearTimeout(mergesFilterTimeout); mergesFilterTimeout = setTimeout(applyMergesFilters, 300); });
mergesRankMax.addEventListener('input', () => { clearTimeout(mergesFilterTimeout); mergesFilterTimeout = setTimeout(applyMergesFilters, 300); });
mergesPageSizeSelect.addEventListener('change', (e) => {
  mergesPageSize = e.target.value === INFINITE_PAGE_SIZE ? INFINITE_PAGE_SIZE : parseInt(e.target.value, 10);
  mergesPage = 1;
  infiniteMergesLoaded = 0;
  mergesTableScroll.scrollTop = 0;
  renderMergesTable();
});

mergesTableScroll.addEventListener('scroll', maybeLoadMoreMerges);

// ============ EXPORT ============
exportJsonBtn.addEventListener('click', () => {
  const json = JSON.stringify(decodedVocabIdMap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vocab-id-map.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 vocab-id-map.json（使用可读键名）', 'success');
});

exportRawJsonBtn.addEventListener('click', () => {
  const json = JSON.stringify(vocabIdMap, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vocab-id-map-raw.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出 vocab-id-map-raw.json（使用原始编码键名）', 'success');
});

copyJsonBtn.addEventListener('click', async () => {
  const json = JSON.stringify(decodedVocabIdMap, null, 2);
  try {
    await navigator.clipboard.writeText(json);
    showToast('已复制 JSON 到剪贴板（使用可读键名）', 'success');
  } catch {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = json;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('已复制 JSON 到剪贴板', 'success');
  }
});

// ============ COPY TOKEN ============
function copyToken(btn, token, id) {
  const text = `${token}\t${id}`;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
  });
}

// ============ UI HELPERS ============
function showLoading() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  contentArea.classList.add('hidden');
  exportBar.classList.add('hidden');
}

function hideLoading() {
  loadingState.classList.add('hidden');
}

function showContent() {
  contentArea.classList.remove('hidden');
  exportBar.classList.remove('hidden');
  emptyState.classList.add('hidden');
}

function showToast(msg, type = '') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  (viewerRoot || document.body).appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}
