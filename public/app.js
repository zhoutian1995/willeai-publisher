const preferredPlatforms = ['douyin', 'KWAI', 'bilibili', 'wxSph', 'xhs'];
const platformNames = new Map([
  ['douyin', '抖音'],
  ['KWAI', '快手'],
  ['bilibili', 'Bilibili'],
  ['wxSph', '微信视频号'],
  ['xhs', '小红书'],
  ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'],
  ['wxGzh', '微信公众号'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['threads', 'Threads'],
  ['pinterest', 'Pinterest'],
  ['linkedin', 'LinkedIn'],
  ['twitter', 'X'],
]);

const state = {
  health: null,
  platforms: [],
  accounts: [],
  selectedAccountIds: new Set(),
  authSessions: new Map(),
  mediaMode: 'video',
  activeFlowId: '',
  flowTimer: null,
  accountRefreshTimer: null,
};

const els = {
  environmentStatus: document.querySelector('#environmentStatus'),
  refreshButton: document.querySelector('#refreshButton'),
  platformGrid: document.querySelector('#platformGrid'),
  accountCount: document.querySelector('#accountCount'),
  publishForm: document.querySelector('#publishForm'),
  publishButton: document.querySelector('#publishButton'),
  clearButton: document.querySelector('#clearButton'),
  titleInput: document.querySelector('#titleInput'),
  bodyInput: document.querySelector('#bodyInput'),
  mediaInput: document.querySelector('#mediaInput'),
  mediaLabel: document.querySelector('#mediaLabel'),
  coverInput: document.querySelector('#coverInput'),
  publishAtInput: document.querySelector('#publishAtInput'),
  preflightList: document.querySelector('#preflightList'),
  flowBox: document.querySelector('#flowBox'),
  flowMeta: document.querySelector('#flowMeta'),
  toastRegion: document.querySelector('#toastRegion'),
  connectedMetric: document.querySelector('#connectedMetric'),
  selectedMetric: document.querySelector('#selectedMetric'),
  mediaMetric: document.querySelector('#mediaMetric'),
  preflightMetric: document.querySelector('#preflightMetric'),
  pipelineStepAccounts: document.querySelector('#pipelineStepAccounts'),
  pipelineStepContent: document.querySelector('#pipelineStepContent'),
  pipelineStepPreflight: document.querySelector('#pipelineStepPreflight'),
  pipelineStepSubmit: document.querySelector('#pipelineStepSubmit'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpsUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:';
  }
  catch {
    return false;
  }
}

function formatDateTimeLocal(date) {
  const pad = value => String(value).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function setDefaultPublishTime() {
  const date = new Date(Date.now() + 10 * 60 * 1000);
  els.publishAtInput.value = formatDateTimeLocal(date);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    const error = new Error(payload.message || `请求失败：${response.status}`);
    error.details = payload.details;
    throw error;
  }
  return payload.data;
}

function showToast(message, tone = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast${tone === 'danger' ? ' is-danger' : tone === 'warn' ? ' is-warn' : ''}`;
  toast.textContent = message;
  els.toastRegion.appendChild(toast);
  setTimeout(() => toast.remove(), 4600);
}

function setStatus(text, tone = 'warn') {
  els.environmentStatus.className = `status-pill is-${tone}`;
  els.environmentStatus.innerHTML = `<span class="status-dot"></span>${escapeHtml(text)}`;
}

function getPlatformName(platform) {
  const displayName = platform.displayName || {};
  return displayName['zh-CN'] || displayName['en-US'] || platformNames.get(platform.platform) || platform.platform;
}

function accountName(account) {
  return account.nickname || account.displayName || account.uid || account.id;
}

function initials(value) {
  const text = String(value || '?').trim();
  return escapeHtml(text.slice(0, 2).toUpperCase());
}

function getAccountStatus(account) {
  return Number(account.status) === 1 ? 'normal' : 'abnormal';
}

function getAccountsByPlatform(platformId) {
  return state.accounts
    .filter(account => account.type === platformId)
    .sort((a, b) => Number(a.rank || 0) - Number(b.rank || 0));
}

function sortPlatforms(platforms) {
  const order = new Map(preferredPlatforms.map((platform, index) => [platform, index]));
  return [...platforms]
    .filter(platform => preferredPlatforms.includes(platform.platform) || platform.status === 'available')
    .sort((a, b) => {
      const ao = order.has(a.platform) ? order.get(a.platform) : 100;
      const bo = order.has(b.platform) ? order.get(b.platform) : 100;
      if (ao !== bo) {
        return ao - bo;
      }
      return getPlatformName(a).localeCompare(getPlatformName(b), 'zh-CN');
    });
}

function renderLogo(platform) {
  if (platform.logoUrl) {
    return `<img src="${escapeHtml(platform.logoUrl)}" alt="" />`;
  }
  return initials(getPlatformName(platform));
}

function renderAvatar(account) {
  if (account.avatar) {
    return `<img src="${escapeHtml(account.avatar)}" alt="" />`;
  }
  if (account.avatarUrl) {
    return `<img src="${escapeHtml(account.avatarUrl)}" alt="" />`;
  }
  return initials(accountName(account));
}

function renderPlatformGrid() {
  const platforms = sortPlatforms(state.platforms);
  const normalCount = state.accounts.filter(account => getAccountStatus(account) === 'normal').length;
  els.accountCount.textContent = `${normalCount} 个可用账号`;

  if (platforms.length === 0) {
    els.platformGrid.innerHTML = '<p class="empty-state">暂无平台元数据，请检查 API Key 和上游服务。</p>';
    return;
  }

  els.platformGrid.innerHTML = platforms.map((platform) => {
    const accounts = getAccountsByPlatform(platform.platform);
    const connected = accounts.filter(account => getAccountStatus(account) === 'normal');
    const abnormal = accounts.length - connected.length;
    const isSelected = connected.some(account => state.selectedAccountIds.has(account.id));
    const isRednote = platform.platform === 'xhs';
    const statusTone = connected.length > 0 ? 'ok' : abnormal > 0 ? 'warn' : 'danger';
    const statusText = connected.length > 0
      ? `${connected.length} 个已连接`
      : abnormal > 0
        ? '需重新授权'
        : '未连接';
    const canPublish = platform.capabilities?.publish && Object.values(platform.capabilities.publish).some(Boolean);
    const actionText = accounts.length > 0 ? '重新连接' : '连接账号';

    return `
      <article class="platform-row${isSelected ? ' is-selected' : ''}" data-platform="${escapeHtml(platform.platform)}">
        <div class="platform-logo">${renderLogo(platform)}</div>
        <div class="platform-main">
          <div class="platform-title">
            <span class="platform-name">${escapeHtml(getPlatformName(platform))}</span>
            <span class="mini-pill is-${statusTone}">${escapeHtml(statusText)}</span>
          </div>
          <div class="platform-actions">
            <button class="connect-button" type="button" data-action="connect" data-platform="${escapeHtml(platform.platform)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>
              ${escapeHtml(actionText)}
            </button>
            ${canPublish ? '<span class="mini-pill is-ok">支持发布</span>' : '<span class="mini-pill is-warn">发布能力待确认</span>'}
            ${isRednote ? '<span class="mini-pill is-warn">需单独验证</span>' : ''}
          </div>
          ${renderAccountList(platform.platform, connected, abnormal)}
          ${renderAuthSession(platform.platform)}
        </div>
      </article>
    `;
  }).join('');
}

function renderAccountList(platformId, connected, abnormalCount) {
  if (connected.length === 0) {
    return `<p class="account-note">${abnormalCount > 0 ? '账号状态异常，请重新连接。' : '连接账号后即可在这里选择发布目标。'}</p>`;
  }

  return `
    <div class="account-list">
      ${connected.map(account => `
        <label class="account-option">
          <input type="checkbox" data-action="select-account" value="${escapeHtml(account.id)}" ${state.selectedAccountIds.has(account.id) ? 'checked' : ''} />
          <span class="avatar">${renderAvatar(account)}</span>
          <span>
            <span class="account-name">${escapeHtml(accountName(account))}</span>
            <span class="account-id">${escapeHtml(platformNames.get(platformId) || platformId)} · ${escapeHtml(account.uid || account.id)}</span>
          </span>
        </label>
      `).join('')}
    </div>
  `;
}

function renderAuthSession(platformId) {
  const session = state.authSessions.get(platformId);
  if (!session) {
    return '';
  }
  if (session.status === 'completed') {
    return '<p class="account-note">授权完成，正在刷新账号列表。</p>';
  }
  if (session.status === 'failed') {
    return '<p class="account-note">授权失败，请重新发起连接。</p>';
  }
  if (session.requiresSelection && Array.isArray(session.selectableAccounts) && session.selectableAccounts.length > 0) {
    return `
      <div class="account-list" data-selectable-platform="${escapeHtml(platformId)}">
        ${session.selectableAccounts.map(account => `
          <label class="account-option">
            <input type="checkbox" data-action="select-auth-account" data-platform="${escapeHtml(platformId)}" data-platform-uid="${escapeHtml(account.platformUid)}" data-account="${escapeHtml(account.account || '')}" checked />
            <span class="avatar">${account.avatarUrl ? `<img src="${escapeHtml(account.avatarUrl)}" alt="" />` : initials(account.displayName)}</span>
            <span>
              <span class="account-name">${escapeHtml(account.displayName || account.platformUid)}</span>
              <span class="account-id">${escapeHtml(account.platformUid)}${account.account ? ` · ${escapeHtml(account.account)}` : ''}</span>
            </span>
          </label>
        `).join('')}
        <button class="small-button" type="button" data-action="submit-auth-selection" data-platform="${escapeHtml(platformId)}">
          确认连接所选账号
        </button>
      </div>
    `;
  }
  return '<p class="account-note">授权窗口已打开，完成后这里会自动更新。</p>';
}

function getMediaUrls() {
  return els.mediaInput.value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);
}

function buildPreflight() {
  const selectedAccounts = state.accounts.filter(account => state.selectedAccountIds.has(account.id));
  const mediaUrls = getMediaUrls();
  const title = els.titleInput.value.trim();
  const body = els.bodyInput.value.trim();
  const cover = els.coverInput.value.trim();
  const issues = [];

  const checks = [
    {
      ok: selectedAccounts.length > 0,
      text: selectedAccounts.length > 0 ? `已选择 ${selectedAccounts.length} 个发布账号` : '至少选择一个已连接账号',
    },
    {
      ok: title.length > 0 || body.length > 0,
      text: title.length > 0 || body.length > 0 ? '标题或正文已填写' : '标题和正文至少填写一项',
    },
    {
      ok: mediaUrls.length > 0,
      text: mediaUrls.length > 0 ? `已填写 ${mediaUrls.length} 个素材 URL` : '至少填写一个公开视频或图片 URL',
    },
    {
      ok: mediaUrls.every(isHttpsUrl) && (!cover || isHttpsUrl(cover)),
      text: '素材和封面必须使用 HTTPS URL',
    },
  ];

  for (const check of checks) {
    if (!check.ok) {
      issues.push(check.text);
    }
  }

  const xhsSelected = selectedAccounts.some(account => account.type === 'xhs');
  if (xhsSelected) {
    checks.push({
      ok: false,
      warn: true,
      text: '小红书账号已选择，首版标记为需单独验证',
    });
  }

  els.preflightList.innerHTML = checks.map(check => `
    <div class="check-row ${check.ok ? 'is-ok' : check.warn ? 'is-warn' : ''}">
      <span class="check-icon">${check.ok ? '✓' : check.warn ? '!' : '×'}</span>
      <span>${escapeHtml(check.text)}</span>
    </div>
  `).join('');

  updateOverview({ issues, selectedAccounts, mediaUrls });
  return { issues, selectedAccounts, mediaUrls };
}

function updateOverview(preflight) {
  const selectedAccounts = preflight?.selectedAccounts
    || state.accounts.filter(account => state.selectedAccountIds.has(account.id));
  const mediaUrls = preflight?.mediaUrls || getMediaUrls();
  const normalCount = state.accounts.filter(account => getAccountStatus(account) === 'normal').length;
  const hasContent = els.titleInput.value.trim().length > 0 || els.bodyInput.value.trim().length > 0;
  const hasAccounts = selectedAccounts.length > 0;
  const hasMedia = mediaUrls.length > 0;
  const issues = Array.isArray(preflight?.issues) ? preflight.issues : [];
  const isReady = issues.length === 0 && hasAccounts && hasContent && hasMedia;

  if (els.connectedMetric) {
    els.connectedMetric.textContent = String(normalCount);
  }
  if (els.selectedMetric) {
    els.selectedMetric.textContent = String(selectedAccounts.length);
  }
  if (els.mediaMetric) {
    els.mediaMetric.textContent = String(mediaUrls.length);
  }
  if (els.preflightMetric) {
    els.preflightMetric.textContent = isReady ? '可发布' : issues.length > 0 ? '待修正' : '待填写';
    els.preflightMetric.closest('.metric-tile')?.classList.toggle('is-ok', isReady);
    els.preflightMetric.closest('.metric-tile')?.classList.toggle('is-warn', !isReady && issues.length > 0);
    els.preflightMetric.closest('.metric-tile')?.classList.toggle('is-danger', false);
  }

  const steps = [
    [els.pipelineStepAccounts, hasAccounts],
    [els.pipelineStepContent, hasContent],
    [els.pipelineStepPreflight, isReady],
    [els.pipelineStepSubmit, Boolean(state.activeFlowId)],
  ];
  const activeIndex = steps.findIndex(([, complete]) => !complete);
  for (const [element, complete] of steps) {
    if (!element) {
      continue;
    }
    const index = steps.findIndex(([stepElement]) => stepElement === element);
    element.classList.toggle('is-complete', complete);
    element.classList.toggle('is-active', index === activeIndex);
  }
}

function renderFlow(flow) {
  if (!flow || !flow.flowId) {
    state.activeFlowId = '';
    els.flowMeta.textContent = '未提交';
    els.flowBox.innerHTML = '<p class="empty-state">选择账号并填写 HTTPS 素材 URL 后，预检和发布结果会显示在这里。</p>';
    updateOverview();
    return;
  }

  state.activeFlowId = flow.flowId;
  els.flowMeta.textContent = '已提交';
  const tasks = Array.isArray(flow.tasks) ? flow.tasks : [];
  els.flowBox.innerHTML = `
    <div class="flow-summary">
      <strong>Flow 已创建</strong>
      <div class="flow-id">${escapeHtml(flow.flowId)}</div>
    </div>
    <div class="task-list">
      ${tasks.length > 0 ? tasks.map(renderTask).join('') : '<p class="empty-state">上游暂未返回任务列表。</p>'}
    </div>
  `;
  updateOverview();
}

function renderTask(task) {
  const account = state.accounts.find(item => item.id === task.accountId);
  const platformName = platformNames.get(task.platform) || task.platform || account?.type || '未知平台';
  const status = normalizeTaskStatus(task.status);
  const tone = status.tone;
  const detail = task.errorMsg
    ? `错误：${task.errorMsg}`
    : task.workLink
      ? `作品链接：<a href="${escapeHtml(task.workLink)}" target="_blank" rel="noreferrer">${escapeHtml(task.workLink)}</a>`
      : task.platformWorkId
        ? `平台作品 ID：${escapeHtml(task.platformWorkId)}`
        : task.publishTime
          ? `计划时间：${escapeHtml(task.publishTime)}`
          : '等待平台返回结果';

  return `
    <article class="task-row">
      <div class="task-top">
        <span class="task-title">${escapeHtml(platformName)} · ${escapeHtml(account ? accountName(account) : task.accountId)}</span>
        <span class="mini-pill is-${tone}">${escapeHtml(status.label)}</span>
      </div>
      <p class="task-detail">${detail}</p>
    </article>
  `;
}

function normalizeTaskStatus(status) {
  const value = String(status ?? '').toLowerCase();
  if (['1', 'published', 'success', 'completed', 'done'].includes(value)) {
    return { label: '已发布', tone: 'ok' };
  }
  if (['-1', 'failed', 'error'].includes(value)) {
    return { label: '失败', tone: 'danger' };
  }
  if (['8', 'waiting_user_action', 'waitingforuseraction'].includes(value)) {
    return { label: '待人工操作', tone: 'warn' };
  }
  if (['6', '7', 'queued', 'platformscheduled', 'scheduled'].includes(value)) {
    return { label: '已排队', tone: 'warn' };
  }
  if (['2', 'publishing', 'processing', 'pending', '0', ''].includes(value)) {
    return { label: '处理中', tone: 'warn' };
  }
  return { label: `状态 ${status}`, tone: 'warn' };
}

async function loadAll() {
  setLoading(true);
  try {
    const health = await api('/api/health');
    state.health = health;
    if (!health.apiKeyConfigured) {
      state.platforms = [];
      state.accounts = [];
      state.selectedAccountIds.clear();
      setStatus('缺少 API Key', 'danger');
      renderPlatformGrid();
      buildPreflight();
      return;
    }

    const [platforms, accounts] = await Promise.all([
      api('/api/platforms'),
      api('/api/accounts'),
    ]);
    state.platforms = Array.isArray(platforms) ? platforms : [];
    state.accounts = Array.isArray(accounts.list) ? accounts.list : [];
    pruneSelectedAccounts();
    setStatus('API 已连接', 'ok');
    renderPlatformGrid();
    buildPreflight();
  }
  catch (error) {
    setStatus('API 连接异常', 'danger');
    showToast(error.message, 'danger');
    renderPlatformGrid();
  }
  finally {
    setLoading(false);
  }
}

function pruneSelectedAccounts() {
  const validIds = new Set(state.accounts.filter(account => getAccountStatus(account) === 'normal').map(account => account.id));
  for (const id of [...state.selectedAccountIds]) {
    if (!validIds.has(id)) {
      state.selectedAccountIds.delete(id);
    }
  }
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading;
}

async function startAuth(platform) {
  const popup = window.open('about:blank', `willeai-auth-${platform}`, 'width=760,height=820');
  try {
    const result = await api(`/api/auth/${encodeURIComponent(platform)}`, { method: 'POST' });
    state.authSessions.set(platform, {
      sessionId: result.sessionId,
      status: 'pending',
      requiresSelection: false,
      selectableAccounts: [],
    });
    renderPlatformGrid();
    if (result.url) {
      if (popup) {
        popup.location.href = result.url;
      }
      else {
        showToast('浏览器拦截了授权窗口，请允许弹窗后重试。', 'warn');
      }
    }
    pollAuth(platform, result.sessionId);
    showToast('授权窗口已打开，请完成平台授权。');
  }
  catch (error) {
    if (popup) {
      popup.close();
    }
    showToast(error.message, 'danger');
  }
}

async function pollAuth(platform, sessionId) {
  let attempts = 0;
  const run = async () => {
    attempts += 1;
    try {
      const result = await api(`/api/auth/${encodeURIComponent(platform)}/status/${encodeURIComponent(sessionId)}`);
      state.authSessions.set(platform, {
        ...result,
        sessionId,
      });
      renderPlatformGrid();
      if (result.status === 'completed') {
        showToast('账号授权已完成。');
        await refreshAccountsSoon();
        return;
      }
      if (result.status === 'failed') {
        showToast('账号授权失败，请重新连接。', 'danger');
        return;
      }
      if (result.requiresSelection) {
        showToast('请选择需要连接的账号。', 'warn');
        return;
      }
      if (attempts < 90) {
        setTimeout(run, 2500);
      }
    }
    catch (error) {
      if (attempts < 4) {
        setTimeout(run, 3000);
        return;
      }
      showToast(error.message, 'danger');
    }
  };
  setTimeout(run, 1500);
}

async function submitAuthSelection(platform) {
  const session = state.authSessions.get(platform);
  if (!session?.sessionId) {
    showToast('授权会话不存在，请重新连接。', 'danger');
    return;
  }

  const inputs = [...document.querySelectorAll('[data-action="select-auth-account"]')]
    .filter(input => input.dataset.platform === platform);
  const accounts = inputs
    .filter(input => input.checked)
    .map(input => ({
      platformUid: input.dataset.platformUid,
      ...(input.dataset.account ? { account: input.dataset.account } : {}),
    }));

  try {
    const result = await api(`/api/auth/${encodeURIComponent(platform)}/select/${encodeURIComponent(session.sessionId)}`, {
      method: 'POST',
      body: JSON.stringify({ accounts }),
    });
    state.authSessions.set(platform, { ...result, sessionId: session.sessionId });
    showToast('所选账号已连接。');
    await refreshAccountsSoon();
  }
  catch (error) {
    showToast(error.message, 'danger');
  }
}

async function refreshAccountsSoon() {
  clearTimeout(state.accountRefreshTimer);
  state.accountRefreshTimer = setTimeout(async () => {
    try {
      const accounts = await api('/api/accounts');
      state.accounts = Array.isArray(accounts.list) ? accounts.list : [];
      pruneSelectedAccounts();
      renderPlatformGrid();
      buildPreflight();
    }
    catch (error) {
      showToast(error.message, 'danger');
    }
  }, 900);
}

async function submitPublish(event) {
  event.preventDefault();
  const preflight = buildPreflight();
  if (preflight.issues.length > 0) {
    showToast(preflight.issues[0], 'warn');
    return;
  }

  els.publishButton.disabled = true;
  try {
    const payload = {
      title: els.titleInput.value,
      body: els.bodyInput.value,
      mediaUrls: preflight.mediaUrls,
      mediaMode: state.mediaMode,
      coverUrl: els.coverInput.value,
      publishAt: els.publishAtInput.value ? new Date(els.publishAtInput.value).toISOString() : new Date().toISOString(),
      accountIds: [...state.selectedAccountIds],
      accounts: state.accounts,
    };
    const flow = await api('/api/publish', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.activeFlowId = flow.flowId;
    renderFlow(flow);
    showToast('发布 Flow 已提交。');
    startFlowPolling(flow.flowId);
  }
  catch (error) {
    const details = Array.isArray(error.details) ? `：${error.details[0]}` : '';
    showToast(`${error.message}${details}`, 'danger');
  }
  finally {
    els.publishButton.disabled = false;
  }
}

function startFlowPolling(flowId) {
  clearInterval(state.flowTimer);
  let attempts = 0;
  state.flowTimer = setInterval(async () => {
    attempts += 1;
    try {
      const flow = await api(`/api/flows/${encodeURIComponent(flowId)}`);
      renderFlow(flow);
      const tasks = Array.isArray(flow.tasks) ? flow.tasks : [];
      const allFinal = tasks.length > 0 && tasks.every(task => {
        const value = String(task.status ?? '').toLowerCase();
        return ['1', '-1', 'published', 'success', 'completed', 'failed', 'error', 'canceled', '9'].includes(value);
      });
      if (allFinal || attempts >= 120) {
        clearInterval(state.flowTimer);
      }
    }
    catch (error) {
      showToast(error.message, 'danger');
      if (attempts >= 3) {
        clearInterval(state.flowTimer);
      }
    }
  }, 5000);
}

function clearForm() {
  els.titleInput.value = '';
  els.bodyInput.value = '';
  els.mediaInput.value = '';
  els.coverInput.value = '';
  state.selectedAccountIds.clear();
  setDefaultPublishTime();
  renderPlatformGrid();
  buildPreflight();
  renderFlow(null);
}

function bindEvents() {
  els.refreshButton.addEventListener('click', loadAll);
  els.publishForm.addEventListener('submit', submitPublish);
  els.clearButton.addEventListener('click', clearForm);

  for (const input of [els.titleInput, els.bodyInput, els.mediaInput, els.coverInput, els.publishAtInput]) {
    input.addEventListener('input', buildPreflight);
  }

  document.querySelectorAll('[data-media-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mediaMode = button.dataset.mediaMode;
      document.querySelectorAll('[data-media-mode]').forEach(item => item.classList.toggle('is-active', item === button));
      els.mediaLabel.textContent = state.mediaMode === 'video' ? '视频 URL' : '图片 URL';
      els.mediaInput.placeholder = state.mediaMode === 'video'
        ? '每行一个公开视频 HTTPS URL。通常首版每次提交 1 个视频。'
        : '每行一个公开图片 HTTPS URL。';
      buildPreflight();
    });
  });

  els.platformGrid.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    if (action === 'connect') {
      startAuth(target.dataset.platform);
    }
    if (action === 'submit-auth-selection') {
      submitAuthSelection(target.dataset.platform);
    }
  });

  els.platformGrid.addEventListener('change', (event) => {
    const target = event.target;
    if (target.dataset.action === 'select-account') {
      if (target.checked) {
        state.selectedAccountIds.add(target.value);
      }
      else {
        state.selectedAccountIds.delete(target.value);
      }
      renderPlatformGrid();
      buildPreflight();
    }
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== 'willeai-auth-returned') {
      return;
    }
    for (const [platform, session] of state.authSessions.entries()) {
      if (session.status === 'pending' && session.sessionId) {
        pollAuth(platform, session.sessionId);
      }
    }
  });
}

setDefaultPublishTime();
bindEvents();
buildPreflight();
loadAll();
