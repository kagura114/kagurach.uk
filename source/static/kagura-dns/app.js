(function () {
  'use strict';

  const PAGE_SELECTOR = '[data-kagura-dns-root]';

  const DOH_SERVERS = [
    { name: 'snd.kagurach.uk', url: 'https://snd.kagurach.uk' },
    { name: 'snd.lolicon.cyou', url: 'https://snd.lolicon.cyou' }
  ];

  const SERVER_DESCRIPTIONS = {
    'snd.kagurach.uk': '走 Cloudflare，无限速',
    'snd.lolicon.cyou': '直连，存在一定限速'
  };

  const RECORD_TYPE_MAP = {
    A: 1,
    NS: 2,
    CNAME: 5,
    SOA: 6,
    PTR: 12,
    MX: 15,
    TXT: 16,
    AAAA: 28,
    SRV: 33,
    DS: 43,
    RRSIG: 46,
    DNSKEY: 48,
    NSEC3: 50,
    HTTPS: 65,
    CAA: 257,
    SVCB: 64
  };

  const RECORD_TYPE_NAME = Object.keys(RECORD_TYPE_MAP).reduce((map, key) => {
    map[RECORD_TYPE_MAP[key]] = key;
    return map;
  }, {});

  const RECORD_TYPE_INFO = [
    { type: 'A', name: 'IPv4 地址记录', desc: '把域名解析到 IPv4 地址，是最常见的基础记录。' },
    { type: 'AAAA', name: 'IPv6 地址记录', desc: '把域名解析到 IPv6 地址，用于 IPv6 网络访问。' },
    { type: 'CNAME', name: '别名记录', desc: '将一个域名指向另一个域名，常见于 CDN 与业务分流。' },
    { type: 'MX', name: '邮件交换记录', desc: '指定负责接收该域名邮件的服务器。' },
    { type: 'NS', name: '域名服务器记录', desc: '声明当前域名所使用的权威 DNS 服务器。' },
    { type: 'TXT', name: '文本记录', desc: '常用于 SPF、DKIM、站点验证等文本型配置。' },
    { type: 'SOA', name: '起始授权记录', desc: '包含区域序列号、刷新周期等权威区基础信息。' },
    { type: 'SRV', name: '服务记录', desc: '为特定服务声明主机名与端口。' },
    { type: 'PTR', name: '反向解析记录', desc: '将 IP 地址反向映射回域名。' },
    { type: 'CAA', name: '证书授权记录', desc: '限定哪些 CA 可以为当前域名签发证书。' },
    { type: 'DS', name: '委托签名记录', desc: 'DNSSEC 中父区到子区信任链的一部分。' },
    { type: 'DNSKEY', name: 'DNS 密钥记录', desc: '保存 DNSSEC 验签所需的公钥。' },
    { type: 'RRSIG', name: '记录签名', desc: 'DNSSEC 对记录集的签名结果。' },
    { type: 'NSEC3', name: '安全否定存在', desc: 'DNSSEC 中用于证明记录不存在并降低枚举风险。' },
    { type: 'HTTPS', name: 'HTTPS 绑定记录', desc: '为浏览器提供 HTTPS 连接参数与候选终端。' },
    { type: 'SVCB', name: '服务绑定记录', desc: '为通用服务发现提供端点与参数描述。' }
  ];

  const runtime = {
    activeServer: DOH_SERVERS[0],
    speedTestDone: false
  };

  function createCacheBuster() {
    return '_=' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
  }

  function buildDnsQueryUrl(server, domain, type, withCacheBuster) {
    const cacheBuster = withCacheBuster ? '&' + createCacheBuster() : '';
    return server.url + '/dns-query?name=' + encodeURIComponent(domain) + '&type=' + type + cacheBuster;
  }

  function createDetailedError(message, issueType, server) {
    const error = new Error(message);
    error.issueType = issueType;
    error.server = server;
    return error;
  }

  async function detectFetchIssue(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);

    try {
      await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal
      });

      return {
        issueType: 'cors',
        message: '服务器可达但响应被 CORS 策略拦截'
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          issueType: 'timeout',
          message: '连接超时'
        };
      }

      return {
        issueType: 'network',
        message: '网络连接失败'
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function testServerLatency(server) {
    const url = buildDnsQueryUrl(server, 'example.com', 'A', true);
    const start = performance.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      if (!response.ok) {
        return { server, latency: Infinity, error: 'HTTP ' + response.status, issueType: 'http' };
      }

      try {
        await response.text();
      } catch (error) {
        // Ignore response body parsing errors for the latency test.
      }

      return {
        server,
        latency: Math.round(performance.now() - start),
        error: null,
        issueType: null
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { server, latency: Infinity, error: '连接超时', issueType: 'timeout' };
      }

      const detected = await detectFetchIssue(url);
      return {
        server,
        latency: Infinity,
        error: detected.message,
        issueType: detected.issueType
      };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function runSpeedTest() {
    const results = await Promise.all(DOH_SERVERS.map(testServerLatency));
    const available = results.filter((item) => Number.isFinite(item.latency));

    if (available.length > 0) {
      available.sort((left, right) => left.latency - right.latency);
      runtime.activeServer = available[0].server;
    }

    runtime.speedTestDone = true;

    return {
      results: results.map((item) => ({
        name: item.server.name,
        latency: Number.isFinite(item.latency) ? item.latency : null,
        error: item.error,
        issueType: item.issueType,
        selected: item.server === runtime.activeServer && Number.isFinite(item.latency)
      })),
      selected: available.length > 0 ? runtime.activeServer.name : null
    };
  }

  function getActiveServer() {
    return {
      name: runtime.activeServer.name,
      url: runtime.activeServer.url,
      speedTestDone: runtime.speedTestDone
    };
  }

  async function requestDnsFromServer(server, domain, type) {
    const url = buildDnsQueryUrl(server, domain, type, false);
    const startTime = performance.now();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });

      const queryTime = Math.round(performance.now() - startTime);

      if (!response.ok) {
        throw createDetailedError('服务器返回错误: HTTP ' + response.status, 'http', server);
      }

      const data = await response.json();

      return {
        success: true,
        domain: domain,
        type: type,
        queryTime: queryTime,
        status: data.Status,
        statusText: getStatusText(data.Status),
        records: parseRecords(data.Answer || []),
        authority: parseRecords(data.Authority || []),
        rawResponse: data,
        server: server.name
      };
    } catch (error) {
      if (error.issueType) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw createDetailedError('连接超时', 'timeout', server);
      }

      const detected = await detectFetchIssue(url);
      throw createDetailedError(detected.message, detected.issueType, server);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function queryDns(domain, type) {
    const normalizedDomain = domain.trim().toLowerCase();
    const typeCode = RECORD_TYPE_MAP[type];

    if (!normalizedDomain) {
      throw new Error('请输入域名');
    }

    if (typeCode === undefined) {
      throw new Error('不支持的记录类型: ' + type);
    }

    const serversToTry = [
      runtime.activeServer,
      ...DOH_SERVERS.filter((server) => server.url !== runtime.activeServer.url)
    ];
    const errors = [];

    for (const server of serversToTry) {
      try {
        const result = await requestDnsFromServer(server, normalizedDomain, type);
        runtime.activeServer = server;
        return result;
      } catch (error) {
        errors.push(error);
      }
    }

    const corsErrors = errors.filter((error) => error.issueType === 'cors');
    if (corsErrors.length === serversToTry.length) {
      throw new Error('所有 DNS 节点都疑似被浏览器 CORS 策略拦截，请检查服务端跨域配置');
    }

    const timeoutErrors = errors.filter((error) => error.issueType === 'timeout');
    if (timeoutErrors.length === serversToTry.length) {
      throw new Error('所有 DNS 节点请求都已超时，请稍后重试');
    }

    const detail = errors.map((error) => (error.server ? error.server.name : '未知节点') + '：' + error.message).join('；');
    throw new Error('DNS 查询失败，已尝试自动切换节点。' + detail);
  }

  function parseRecords(records) {
    return records.map((record) => ({
      name: record.name || '',
      type: RECORD_TYPE_NAME[record.type] || 'TYPE' + record.type,
      ttl: record.TTL || 0,
      data: record.data || ''
    }));
  }

  function getStatusText(status) {
    const map = {
      0: 'NOERROR - 查询成功',
      1: 'FORMERR - 格式错误',
      2: 'SERVFAIL - 服务器失败',
      3: 'NXDOMAIN - 域名不存在',
      4: 'NOTIMP - 未实现',
      5: 'REFUSED - 查询被拒绝'
    };

    return Object.prototype.hasOwnProperty.call(map, status) ? map[status] : '未知状态 (' + status + ')';
  }

  function formatTtl(seconds) {
    if (seconds < 60) {
      return seconds + ' 秒';
    }

    if (seconds < 3600) {
      return Math.floor(seconds / 60) + ' 分 ' + seconds % 60 + ' 秒';
    }

    if (seconds < 86400) {
      return Math.floor(seconds / 3600) + ' 时 ' + Math.floor(seconds % 3600 / 60) + ' 分';
    }

    return Math.floor(seconds / 86400) + ' 天 ' + Math.floor(seconds % 86400 / 3600) + ' 时';
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildSelectorMap(root) {
    return {
      root,
      domainInput: root.querySelector('[data-role="domain-input"]'),
      recordType: root.querySelector('[data-role="record-type"]'),
      queryBtn: root.querySelector('[data-role="query-btn"]'),
      serverStatus: root.querySelector('[data-role="server-status"]'),
      loading: root.querySelector('[data-role="loading"]'),
      errorBox: root.querySelector('[data-role="error-box"]'),
      errorMessage: root.querySelector('[data-role="error-message"]'),
      resultSection: root.querySelector('[data-role="result-section"]'),
      resultDomain: root.querySelector('[data-role="result-domain"]'),
      resultType: root.querySelector('[data-role="result-type"]'),
      resultTime: root.querySelector('[data-role="result-time"]'),
      resultCount: root.querySelector('[data-role="result-count"]'),
      resultStatus: root.querySelector('[data-role="result-status"]'),
      resultBody: root.querySelector('[data-role="result-body"]'),
      rawResponse: root.querySelector('[data-role="raw-response"]'),
      copyBtn: root.querySelector('[data-role="copy-btn"]'),
      infoSection: root.querySelector('[data-role="info-section"]'),
      recordTypeCards: root.querySelector('[data-role="record-type-cards"]'),
      endpointsList: root.querySelector('[data-role="endpoints-list"]'),
      toast: root.querySelector('[data-role="toast"]')
    };
  }

  function renderRecordTypeCards(view) {
    view.recordTypeCards.innerHTML = RECORD_TYPE_INFO.map((item) => {
      return '<button type="button" class="kagura-dns__type-card" data-type="' + item.type + '">' +
        '<span class="kagura-dns__type-tag">' + item.type + '</span>' +
        '<strong>' + item.name + '</strong>' +
        '<p>' + item.desc + '</p>' +
      '</button>';
    }).join('');
  }

  function renderEndpoints(view) {
    if (!view.endpointsList) {
      return;
    }

    view.endpointsList.innerHTML = DOH_SERVERS.map((server) => {
      const bare = server.url;
      const full = server.url + '/dns-query';
      const desc = SERVER_DESCRIPTIONS[server.name] || '';

      return '<div class="kagura-dns__endpoint-row">' +
        '<div class="kagura-dns__endpoint-meta">' +
          '<strong class="kagura-dns__endpoint-name">' + escapeHtml(server.name) + '</strong>' +
          (desc ? '<span class="kagura-dns__endpoint-desc">' + escapeHtml(desc) + '</span>' : '') +
        '</div>' +
        '<div class="kagura-dns__endpoint-links">' +
          '<div class="kagura-dns__endpoint-item">' +
            '<code class="kagura-dns__endpoint-url" title="' + escapeHtml(full) + '">' + escapeHtml(full) + '</code>' +
            '<button type="button" class="kagura-dns__ghost-button kagura-dns__copy-url-btn" data-url="' + escapeHtml(full) + '" aria-label="复制带路径地址">' +
              '<i class="fa-regular fa-copy" aria-hidden="true"></i>' +
              '<span>复制</span>' +
            '</button>' +
          '</div>' +
          '<div class="kagura-dns__endpoint-item">' +
            '<code class="kagura-dns__endpoint-url" title="' + escapeHtml(bare) + '">' + escapeHtml(bare) + '</code>' +
            '<button type="button" class="kagura-dns__ghost-button kagura-dns__copy-url-btn" data-url="' + escapeHtml(bare) + '" aria-label="复制不带路径地址">' +
              '<i class="fa-regular fa-copy" aria-hidden="true"></i>' +
              '<span>复制</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function bindEvents(state) {
    const view = state.view;

    view.queryBtn.addEventListener('click', () => {
      performQuery(state);
    });

    view.domainInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        performQuery(state);
      }
    });

    view.copyBtn.addEventListener('click', () => {
      copyResults(state);
    });

    view.domainInput.addEventListener('focus', () => {
      view.domainInput.select();
    });

    view.recordTypeCards.addEventListener('click', (event) => {
      const card = event.target.closest('[data-type]');
      if (!card) {
        return;
      }

      view.recordType.value = card.getAttribute('data-type');
      view.domainInput.focus();
      showToast(state, '已选择 ' + view.recordType.value + ' 类型');
    });

    if (view.endpointsList) {
      view.endpointsList.addEventListener('click', (event) => {
        const btn = event.target.closest('.kagura-dns__copy-url-btn');
        if (!btn) {
          return;
        }

        const url = btn.getAttribute('data-url');
        copyUrl(state, btn, url);
      });
    }
  }

  function updateQueryString(domain, type) {
    const url = new URL(window.location.href);
    url.searchParams.set('domain', domain);
    url.searchParams.set('type', type);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  async function performQuery(state) {
    const view = state.view;
    const domain = view.domainInput.value.trim();
    const type = view.recordType.value;

    if (!domain) {
      showError(state, '请输入要查询的域名');
      view.domainInput.focus();
      return;
    }

    showLoading(state, true);
    hideError(state);
    hideResults(state);
    view.queryBtn.disabled = true;
    view.queryBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><span>查询中...</span>';

    try {
      const result = await queryDns(domain, type);
      state.currentResult = result;
      updateQueryString(result.domain, result.type);
      renderResults(state, result);
    } catch (error) {
      showError(state, error.message || '查询过程中发生未知错误');
    } finally {
      showLoading(state, false);
      view.queryBtn.disabled = false;
      view.queryBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><span>查询</span>';
    }
  }

  function renderResults(state, result) {
    const view = state.view;
    const allRecords = result.records.concat(result.authority);

    view.resultDomain.textContent = result.domain;
    view.resultType.textContent = result.type;
    view.resultTime.textContent = result.queryTime + ' ms';
    view.resultCount.textContent = allRecords.length + ' 条记录';

    if (result.status === 0) {
      view.resultStatus.className = 'kagura-dns__status-pill is-success';
      view.resultStatus.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>成功</span>';
    } else if (result.status === 3) {
      view.resultStatus.className = 'kagura-dns__status-pill is-warning';
      view.resultStatus.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><span>域名不存在</span>';
    } else {
      view.resultStatus.className = 'kagura-dns__status-pill is-error';
      view.resultStatus.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i><span>查询失败</span>';
    }

    if (allRecords.length === 0) {
      view.resultBody.innerHTML = '<tr><td colspan="4" class="kagura-dns__empty">未找到 ' + escapeHtml(result.type) + ' 类型的记录<small>' + escapeHtml(result.statusText) + '</small></td></tr>';
    } else {
      view.resultBody.innerHTML = allRecords.map((record) => {
        return '<tr>' +
          '<td>' + escapeHtml(record.name) + '</td>' +
          '<td><span class="kagura-dns__type-badge">' + escapeHtml(record.type) + '</span></td>' +
          '<td title="' + escapeHtml(String(record.ttl)) + ' 秒">' + escapeHtml(formatTtl(record.ttl)) + '</td>' +
          '<td class="kagura-dns__value">' + escapeHtml(record.data) + '</td>' +
        '</tr>';
      }).join('');
    }

    view.rawResponse.textContent = JSON.stringify(result.rawResponse, null, 2);
    view.resultSection.classList.remove('is-hidden');
  }

  function showLoading(state, visible) {
    state.view.loading.classList.toggle('is-hidden', !visible);
  }

  function showError(state, message) {
    state.view.errorMessage.textContent = message;
    state.view.errorBox.classList.remove('is-hidden');
  }

  function hideError(state) {
    state.view.errorBox.classList.add('is-hidden');
  }

  function hideResults(state) {
    state.view.resultSection.classList.add('is-hidden');
  }

  function showToast(state, message) {
    if (!state.view.toast) {
      return;
    }

    state.view.toast.textContent = message;
    state.view.toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      state.view.toast.classList.remove('is-visible');
    }, 2000);
  }

  function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } catch (error) {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function copyUrl(state, btn, url) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else if (!fallbackCopy(url)) {
        throw new Error('复制失败');
      }

      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>已复制</span>';
      window.setTimeout(() => {
        btn.innerHTML = original;
      }, 1800);
      showToast(state, '地址已复制');
    } catch (error) {
      showToast(state, '复制失败，请手动复制');
    }
  }

  async function copyResults(state) {
    if (!state.currentResult) {
      return;
    }

    const allRecords = state.currentResult.records.concat(state.currentResult.authority);
    const server = getActiveServer();
    const header = '; DNS 查询: ' + state.currentResult.domain + ' (' + state.currentResult.type + ')\n' +
      '; 服务器: ' + server.name + '\n' +
      '; 查询时间: ' + state.currentResult.queryTime + ' ms\n\n';
    const text = header + allRecords.map((record) => {
      return [record.name, record.type, record.ttl, record.data].join('\t');
    }).join('\n');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackCopy(text)) {
        throw new Error('复制失败');
      }

      state.view.copyBtn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i><span>已复制</span>';
      window.setTimeout(() => {
        state.view.copyBtn.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i><span>复制</span>';
      }, 1800);
      showToast(state, '查询结果已复制');
    } catch (error) {
      showToast(state, '复制失败，请手动复制');
    }
  }

  async function performSpeedTest(state) {
    updateServerStatus(state, 'testing');

    try {
      const result = await runSpeedTest();
      updateServerStatus(state, 'done', result);
    } catch (error) {
      updateServerStatus(state, 'error');
    }
  }

  function updateServerStatus(state, mode, result) {
    const target = state.view.serverStatus;

    if (mode === 'testing') {
      target.className = 'kagura-dns__status is-testing';
      target.innerHTML = '<span><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>正在测速选择最优服务器...</span>';
      return;
    }

    if (mode === 'error') {
      target.className = 'kagura-dns__status is-error';
      target.innerHTML = '<span><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>测速失败，查询时仍会自动尝试备用服务器</span>';
      return;
    }

    const hasAvailableServer = result.results.some((item) => item.selected);
    const detailHtml = result.results.map((item) => {
      let icon = 'fa-regular fa-circle';
      let status = '不可用';

      if (item.selected) {
        icon = 'fa-solid fa-circle-check';
        status = item.latency + ' ms';
      } else if (item.latency !== null && !item.issueType) {
        icon = 'fa-regular fa-circle-dot';
        status = item.latency + ' ms · 备用';
      } else if (item.issueType === 'cors') {
        icon = 'fa-solid fa-ban';
        status = '疑似 CORS';
      } else if (item.issueType === 'timeout') {
        icon = 'fa-regular fa-clock';
        status = '超时';
      } else if (item.issueType === 'network') {
        icon = 'fa-solid fa-circle-xmark';
        status = '网络失败';
      } else if (item.issueType === 'http') {
        icon = 'fa-solid fa-circle-exclamation';
        status = item.error || 'HTTP 错误';
      }

      return '<span class="kagura-dns__server-item" title="' + escapeHtml(SERVER_DESCRIPTIONS[item.name] || '') + '">' +
        '<i class="' + icon + '" aria-hidden="true"></i>' +
        '<strong>' + escapeHtml(item.name) + '</strong>' +
        '<span class="kagura-dns__server-desc">' + escapeHtml(SERVER_DESCRIPTIONS[item.name] || '') + '</span>' +
        '<span>' + escapeHtml(status) + '</span>' +
      '</span>';
    }).join('');

    target.className = 'kagura-dns__status is-done';
    target.innerHTML =
      '<div class="kagura-dns__status-header"><i class="fa-solid ' + (hasAvailableServer ? 'fa-shield-halved' : 'fa-triangle-exclamation') + '" aria-hidden="true"></i><span>' +
      (hasAvailableServer ? '已选择最优节点' : '当前未测速出可用节点，查询时会自动尝试备用节点') +
      '</span></div>' +
      '<div class="kagura-dns__server-list">' + detailHtml + '</div>' +
      '<div class="kagura-dns__server-note">所有节点均支持 A / AAAA / DN42 解析</div>';
  }

  function hydrateFromQuery(state) {
    const params = new URLSearchParams(window.location.search);
    const domain = params.get('domain');
    const type = params.get('type');

    if (!domain) {
      return;
    }

    state.view.domainInput.value = domain;

    if (type && Object.prototype.hasOwnProperty.call(RECORD_TYPE_MAP, type)) {
      state.view.recordType.value = type;
    }

    performQuery(state);
  }

  function initPage(root) {
    if (!root || root.dataset.kaguraDnsMounted === 'true') {
      return;
    }

    root.dataset.kaguraDnsMounted = 'true';

    const state = {
      currentResult: null,
      toastTimer: null,
      view: buildSelectorMap(root)
    };

    renderRecordTypeCards(state.view);
    renderEndpoints(state.view);
    bindEvents(state);
    performSpeedTest(state);
    hydrateFromQuery(state);
  }

  function boot() {
    initPage(document.querySelector(PAGE_SELECTOR));
  }

  if (!window.__kaguraDnsPjaxHooked) {
    document.addEventListener('pjax:complete', boot);
    window.__kaguraDnsPjaxHooked = true;
  }

  boot();
})();
