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
  ['zhihu', '知乎'],
  ['weibo', '微博'],
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['threads', 'Threads'],
  ['pinterest', 'Pinterest'],
  ['linkedin', 'LinkedIn'],
  ['twitter', 'X'],
]);

const selectedAccountsStorageKey = 'willeai.publisher.selectedAccounts.v1';
const contentKindLabels = new Map([
  ['video', '视频'],
  ['article', '长文章'],
  ['dynamic', '短动态'],
]);
const serverContentModes = {
  text: 'article2',
  imageText: 'article',
  video: 'video',
};
const browserTargetDefinitions = [
  {
    id: 'ARTICLE_WEIXIN',
    kind: 'article',
    platform: 'wxGzh',
    label: '微信公众号',
    mode: '浏览器辅助发布',
    help: '创建图文草稿并打开公众号编辑页，首版不默认群发。',
    requireCover: true,
  },
  {
    id: 'ARTICLE_ZHIHU',
    kind: 'article',
    platform: 'zhihu',
    label: '知乎专栏',
    mode: '浏览器辅助发布',
    help: '打开知乎专栏编辑器并填入标题、正文和图片。',
  },
  {
    id: 'DYNAMIC_ZHIHU',
    kind: 'dynamic',
    platform: 'zhihu',
    label: '知乎想法',
    mode: '浏览器辅助发布',
    help: '打开知乎并填入想法正文和素材，最终发布由用户确认。',
  },
  {
    id: 'DYNAMIC_WEIXIN',
    kind: 'dynamic',
    platform: 'wxGzh',
    label: '微信公众号动态',
    mode: '浏览器辅助发布',
    help: '打开公众号后台并填入动态内容，最终发布由用户确认。',
  },
  {
    id: 'DYNAMIC_REDNOTE',
    kind: 'dynamic',
    platform: 'xhs',
    label: '小红书图文',
    mode: '浏览器辅助发布',
    help: '打开小红书创作者发布页并填入图文内容。',
  },
  {
    id: 'DYNAMIC_WEIBO',
    kind: 'dynamic',
    platform: 'weibo',
    label: '微博',
    mode: '浏览器辅助发布',
    help: '打开微博编辑器并填入正文和媒体。',
  },
  {
    id: 'DYNAMIC_X',
    kind: 'dynamic',
    platform: 'twitter',
    label: 'X',
    mode: '浏览器辅助发布',
    help: '打开 X 编辑器并填入正文和媒体。',
  },
  {
    id: 'DYNAMIC_THREADS',
    kind: 'dynamic',
    platform: 'threads',
    label: 'Threads',
    mode: '浏览器辅助发布',
    help: '打开 Threads 编辑器并填入正文和媒体。',
  },
];
const browserTargetNameMap = new Map(browserTargetDefinitions.map(target => [target.id, target.label]));

const state = {
  health: null,
  platforms: [],
  accounts: [],
  selectedAccountIds: new Set(),
  selectionHistoryExists: false,
  selectionNotice: '',
  authSessions: new Map(),
  platformOptions: {
    bilibili: {
      tid: '21',
      copyright: '1',
      no_reprint: '1',
      source: '',
    },
    douyin: {
      private_status: '0',
      download_type: '1',
      short_title: '',
    },
    wxSph: {
      workId: '',
      workLink: '',
    },
    xhs: {
      workLink: '',
    },
    KWAI: {
      stereo_type: '',
      merchant_product_id: '',
    },
  },
  optionValues: {
    bilibiliTid: null,
  },
  userActions: new Map(),
  userActionLoading: new Set(),
  mediaItems: [],
  contentKind: 'video',
  mediaMode: 'video',
  browserTargetIds: new Set(),
  nextMediaId: 1,
  activeFlowId: '',
  activeHandoff: null,
  activeHandoffDelivery: null,
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
  reloadOptionsButton: document.querySelector('#reloadOptionsButton'),
  titleInput: document.querySelector('#titleInput'),
  bodyInput: document.querySelector('#bodyInput'),
  digestInput: document.querySelector('#digestInput'),
  htmlContentInput: document.querySelector('#htmlContentInput'),
  markdownContentInput: document.querySelector('#markdownContentInput'),
  articleExtraFields: document.querySelector('#articleExtraFields'),
  mediaInput: document.querySelector('#mediaInput'),
  mediaLabel: document.querySelector('#mediaLabel'),
  mediaHelp: document.querySelector('#mediaHelp'),
  fileInput: document.querySelector('#fileInput'),
  dropZone: document.querySelector('#dropZone'),
  dropZoneHint: document.querySelector('#dropZoneHint'),
  chooseFileButton: document.querySelector('#chooseFileButton'),
  clearMediaButton: document.querySelector('#clearMediaButton'),
  mediaQueue: document.querySelector('#mediaQueue'),
  coverInput: document.querySelector('#coverInput'),
  tagsInput: document.querySelector('#tagsInput'),
  publishModeInput: document.querySelector('#publishModeInput'),
  publishAtInput: document.querySelector('#publishAtInput'),
  preflightList: document.querySelector('#preflightList'),
  publishTargetPanel: document.querySelector('#publishTargetPanel'),
  platformOptionsList: document.querySelector('#platformOptionsList'),
  browserTargetList: document.querySelector('#browserTargetList'),
  browserTargetCount: document.querySelector('#browserTargetCount'),
  selectedTargetsSummary: document.querySelector('#selectedTargetsSummary'),
  flowBox: document.querySelector('#flowBox'),
  flowMeta: document.querySelector('#flowMeta'),
  toastRegion: document.querySelector('#toastRegion'),
  connectedMetric: document.querySelector('#connectedMetric'),
  selectedMetric: document.querySelector('#selectedMetric'),
  mediaMetric: document.querySelector('#mediaMetric'),
  preflightMetric: document.querySelector('#preflightMetric'),
  nextActionTitle: document.querySelector('#nextActionTitle'),
  nextActionText: document.querySelector('#nextActionText'),
  nextActionButton: document.querySelector('#nextActionButton'),
  accountSignal: document.querySelector('#accountSignal'),
  contentSignal: document.querySelector('#contentSignal'),
  mediaSignal: document.querySelector('#mediaSignal'),
  submitSignal: document.querySelector('#submitSignal'),
  viewPanels: document.querySelectorAll('[data-view]'),
  viewTriggers: document.querySelectorAll('[data-view-target]'),
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

function looksLikeVideoUrl(value) {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(String(value || '').trim());
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
    error.requestId = payload.requestId || '';
    error.statusCode = response.status;
    error.transient = [502, 503, 504].includes(response.status);
    throw error;
  }
  return payload.data;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiWithRetry(path, options = {}, retryOptions = {}) {
  const retries = Number(retryOptions.retries ?? 2);
  const delayMs = Number(retryOptions.delayMs ?? 1200);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await api(path, options);
    }
    catch (error) {
      if (!error.transient || attempt >= retries) {
        throw error;
      }
      await sleep(delayMs * (attempt + 1));
    }
  }
  return null;
}

function requestMultiPostExtension(action, data, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const traceId = `willeai-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    let timer = 0;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timer);
    };
    const onMessage = (event) => {
      if (event.source !== window || event.data?.type !== 'response' || event.data?.traceId !== traceId) {
        return;
      }
      cleanup();
      const response = event.data;
      if (response.code === 0) {
        resolve(response.data);
        return;
      }
      const error = new Error(response.message || 'MultiPost 扩展请求失败');
      error.code = response.code;
      error.data = response.data;
      reject(error);
    };
    window.addEventListener('message', onMessage);
    timer = window.setTimeout(() => {
      cleanup();
      const error = new Error('未检测到 MultiPost 浏览器扩展，请确认扩展已安装并启用。');
      error.code = 'timeout';
      reject(error);
    }, timeoutMs);
    window.postMessage({
      type: 'request',
      traceId,
      action,
      data,
    }, window.location.origin);
  });
}

async function ensureMultiPostTrusted() {
  try {
    await requestMultiPostExtension('MULTIPOST_EXTENSION_CHECK_SERVICE_STATUS', null, 2500);
    return { ok: true };
  }
  catch (error) {
    if (error.code !== 403) {
      return { ok: false, message: error.message };
    }
  }

  try {
    const result = await requestMultiPostExtension('MULTIPOST_EXTENSION_REQUEST_TRUST_DOMAIN', null, 120000);
    if (result?.trusted) {
      return { ok: true };
    }
    return { ok: false, message: 'MultiPost 扩展尚未信任当前发布站。' };
  }
  catch (error) {
    return { ok: false, message: error.message };
  }
}

async function sendHandoffToMultiPost(syncData) {
  const trusted = await ensureMultiPostTrusted();
  if (!trusted.ok) {
    return {
      status: 'browser_failed',
      message: trusted.message,
    };
  }

  try {
    const result = await requestMultiPostExtension('MULTIPOST_EXTENSION_PUBLISH', syncData, 8000);
    return {
      status: 'browser_waiting_confirm',
      extensionId: result?.extensionId || '',
      message: 'MultiPost 扩展已接收内容包，将打开浏览器辅助发布窗口。',
    };
  }
  catch (error) {
    return {
      status: 'browser_failed',
      message: error.message,
    };
  }
}

function authErrorMessage(error) {
  if (error?.transient) {
    return '平台授权服务暂时不可用，已自动重试；请稍后再试。';
  }
  return error?.message || '授权请求失败，请稍后重试。';
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
  if (typeof platform === 'string') {
    return platformNames.get(platform) || platform;
  }
  const displayName = platform.displayName || {};
  return displayName['zh-CN'] || displayName['en-US'] || platformNames.get(platform.platform) || platform.platform;
}

function getPlatformDefinition(platformId) {
  return state.platforms.find(platform => platform.platform === platformId) || { platform: platformId };
}

function localizedText(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return value['zh-CN'] || value['en-US'] || '';
}

function accountId(account) {
  return String(account?.id || '');
}

function getSelectedAccounts() {
  return state.accounts.filter(account =>
    getAccountStatus(account) === 'normal'
    && state.selectedAccountIds.has(accountId(account))
    && accountSupportsCurrentContentKind(account),
  );
}

function getSelectedPlatformIds() {
  return [...new Set(getSelectedAccounts().map(account => account.type))];
}

function getAvailableAccounts() {
  const order = new Map(preferredPlatforms.map((platform, index) => [platform, index]));
  return state.accounts
    .filter(account => getAccountStatus(account) === 'normal' && accountId(account) && accountSupportsCurrentContentKind(account))
    .sort((a, b) => {
      const ao = order.has(a.type) ? order.get(a.type) : 100;
      const bo = order.has(b.type) ? order.get(b.type) : 100;
      if (ao !== bo) {
        return ao - bo;
      }
      const rankDiff = Number(a.rank || 0) - Number(b.rank || 0);
      if (rankDiff !== 0) {
        return rankDiff;
      }
      return accountName(a).localeCompare(accountName(b), 'zh-CN');
    });
}

function getContentKindLabel(kind = state.contentKind) {
  return contentKindLabels.get(kind) || kind;
}

function getServerModeForCurrentContent() {
  if (state.contentKind === 'video') {
    return serverContentModes.video;
  }
  return getMediaUrls().length > 0 ? serverContentModes.imageText : serverContentModes.text;
}

function platformSupportsMode(platform, mode) {
  const modes = Array.isArray(platform?.contentLimits?.modes) ? platform.contentLimits.modes : [];
  return modes.includes(mode);
}

function platformSupportsCurrentContentKind(platform) {
  if (platform?.platform === 'wxGzh') {
    return false;
  }
  if (platform?.platform === 'xhs' && state.contentKind !== 'video') {
    return false;
  }
  if (!platformCanPublish(platform)) {
    return false;
  }
  if (state.contentKind === 'video') {
    return platformSupportsMode(platform, serverContentModes.video);
  }
  if (state.contentKind === 'article') {
    return platformSupportsMode(platform, serverContentModes.text) || platformSupportsMode(platform, serverContentModes.imageText);
  }
  return platformSupportsMode(platform, serverContentModes.text) || platformSupportsMode(platform, serverContentModes.imageText);
}

function accountSupportsCurrentContentKind(account) {
  return platformSupportsCurrentContentKind(getPlatformDefinition(account.type));
}

function getSelectedBrowserTargets() {
  return browserTargetDefinitions.filter(target => target.kind === state.contentKind && state.browserTargetIds.has(target.id));
}

function parseTagsInput() {
  return [...new Set(els.tagsInput.value
    .split(/[\s,，、#]+/)
    .map(item => item.trim())
    .filter(Boolean))]
    .slice(0, 30);
}

function pruneSelectionsForContentKind() {
  let changed = false;
  for (const id of [...state.selectedAccountIds]) {
    const account = state.accounts.find(item => accountId(item) === id);
    if (!account || !accountSupportsCurrentContentKind(account)) {
      state.selectedAccountIds.delete(id);
      changed = true;
    }
  }
  for (const id of [...state.browserTargetIds]) {
    const target = browserTargetDefinitions.find(item => item.id === id);
    if (!target || target.kind !== state.contentKind) {
      state.browserTargetIds.delete(id);
    }
  }
  if (changed && state.selectionHistoryExists) {
    persistSelectedAccountIds();
    state.selectionNotice = '部分已选账号不支持当前内容类型，已自动忽略。';
  }
}

function getSelectedPlatformNames() {
  return getSelectedPlatformIds().map((platformId) => {
    const platform = getPlatformDefinition(platformId);
    return platform.platform ? getPlatformName(platform) : platformNames.get(platformId) || platformId;
  });
}

function readStoredSelectedAccountIds() {
  try {
    const raw = window.localStorage.getItem(selectedAccountsStorageKey);
    state.selectionHistoryExists = raw !== null;
    if (raw === null || raw.trim() === '') {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      state.selectionHistoryExists = false;
      return [];
    }
    return [...new Set(parsed.map(value => String(value || '').trim()).filter(Boolean))];
  }
  catch {
    state.selectionHistoryExists = false;
    return [];
  }
}

function persistSelectedAccountIds() {
  try {
    window.localStorage.setItem(selectedAccountsStorageKey, JSON.stringify([...state.selectedAccountIds]));
    state.selectionHistoryExists = true;
  }
  catch {
    state.selectionNotice = '浏览器无法保存发布目标选择，刷新后可能需要重新选择。';
  }
}

function restoreSelectedAccountsFromStorage() {
  const storedIds = readStoredSelectedAccountIds();
  const validIds = new Set(getAvailableAccounts().map(accountId));

  if (!state.selectionHistoryExists) {
    pruneSelectedAccounts(false);
    state.selectionNotice = '';
    return;
  }

  const restoredIds = storedIds.filter(id => validIds.has(id));
  state.selectedAccountIds = new Set(restoredIds);

  if (restoredIds.length !== storedIds.length) {
    persistSelectedAccountIds();
    state.selectionNotice = restoredIds.length > 0
      ? '上次选择中有账号已失效或被移除，已自动忽略。'
      : '上次选择的账号已失效或被移除，请重新选择发布目标。';
    showToast(state.selectionNotice, 'warn');
    return;
  }

  state.selectionNotice = '';
}

function setSelectedAccount(targetAccountId, isSelected) {
  const normalizedAccountId = String(targetAccountId || '');
  const account = state.accounts.find(item => accountId(item) === normalizedAccountId);
  if (!account || getAccountStatus(account) !== 'normal') {
    showToast('该账号当前不可用，请重新连接后再选择。', 'warn');
    return;
  }
  if (!accountSupportsCurrentContentKind(account)) {
    showToast(`该账号不支持${getContentKindLabel()}直接发布。`, 'warn');
    return;
  }
  if (isSelected) {
    state.selectedAccountIds.add(normalizedAccountId);
  }
  else {
    state.selectedAccountIds.delete(normalizedAccountId);
  }
  state.selectionNotice = '';
  persistSelectedAccountIds();
  renderSelectionSurfaces();
}

function renderSelectionSurfaces() {
  pruneSelectionsForContentKind();
  renderPlatformGrid();
  renderPublishTargetPanel();
  renderBrowserTargetList();
  renderSelectedTargetsSummary();
  renderPlatformOptions();
  maybeLoadSelectedPlatformOptions();
  buildPreflight();
}

function isDataImageUrl(value) {
  return /^data:image\//i.test(String(value || '').trim());
}

function platformCanAuth(platform) {
  return platform?.capabilities?.auth?.supported === true;
}

function platformCanPublish(platform) {
  return platform?.capabilities?.publish?.supported === true;
}

function authUnavailableText(platform) {
  if (platform.platform === 'xhs') {
    return '小红书当前支持作品发布链路，但上游暂未开放账号连接授权。';
  }
  if (platform.authType === 'plugin') {
    return '该平台账号由插件或后台接入，当前不在这里发起授权。';
  }
  if (platform.status !== 'available') {
    return '该平台当前未开放连接。';
  }
  return '该平台暂未开放账号连接。';
}

function renderConnectAction(platform, accounts) {
  const actionText = accounts.length > 0 ? '重新连接' : '连接账号';
  const canAuth = platformCanAuth(platform);
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/></svg>';
  if (canAuth) {
    return `
      <button class="connect-button" type="button" data-action="connect" data-platform="${escapeHtml(platform.platform)}">
        ${icon}
        ${escapeHtml(actionText)}
      </button>
    `;
  }
  return `
    <button class="connect-button is-disabled" type="button" disabled title="${escapeHtml(authUnavailableText(platform))}">
      ${icon}
      暂未开放连接
    </button>
  `;
}

function formatAuthExpiry(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
  const avatarUrl = account.avatar || account.avatarUrl;
  if (avatarUrl) {
    return `
      <span class="avatar-fallback" aria-hidden="true">${initials(accountName(account))}</span>
      <img src="/api/avatar?url=${encodeURIComponent(avatarUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
    `;
  }
  return initials(accountName(account));
}

function renderPlatformGrid() {
  const platforms = sortPlatforms(state.platforms);
  const normalCount = state.accounts.filter(account => getAccountStatus(account) === 'normal' && accountSupportsCurrentContentKind(account)).length;
  els.accountCount.textContent = `${normalCount} 个可用账号`;

  if (platforms.length === 0) {
    els.platformGrid.innerHTML = '<p class="empty-state">暂无平台元数据，请检查 API Key 和上游服务。</p>';
    return;
  }

  els.platformGrid.innerHTML = platforms.map((platform) => {
    const accounts = getAccountsByPlatform(platform.platform);
    const connected = accounts.filter(account => getAccountStatus(account) === 'normal');
    const abnormal = accounts.length - connected.length;
    const isSelected = connected.some(account => state.selectedAccountIds.has(accountId(account)));
    const statusTone = connected.length > 0 ? 'ok' : abnormal > 0 ? 'warn' : 'danger';
    const statusText = connected.length > 0
      ? `${connected.length} 个已连接`
      : abnormal > 0
        ? '需重新授权'
        : '未连接';
    const canAuth = platformCanAuth(platform);
    const canPublish = platformCanPublish(platform);
    const supportsCurrentKind = platformSupportsCurrentContentKind(platform);

    return `
      <article class="platform-row${isSelected ? ' is-selected' : ''}" data-platform="${escapeHtml(platform.platform)}">
        <div class="platform-logo">${renderLogo(platform)}</div>
        <div class="platform-main">
          <div class="platform-title">
            <span class="platform-name">${escapeHtml(getPlatformName(platform))}</span>
            <span class="mini-pill is-${statusTone}">${escapeHtml(statusText)}</span>
          </div>
          <div class="platform-actions">
            ${renderConnectAction(platform, accounts)}
            ${canPublish ? '<span class="mini-pill is-ok">支持发布</span>' : '<span class="mini-pill is-warn">发布能力待确认</span>'}
            ${supportsCurrentKind ? `<span class="mini-pill is-ok">支持${escapeHtml(getContentKindLabel())}</span>` : `<span class="mini-pill is-warn">不支持${escapeHtml(getContentKindLabel())}</span>`}
            ${canAuth ? '<span class="mini-pill is-ok">支持连接</span>' : '<span class="mini-pill is-warn">不可在此连接</span>'}
          </div>
          ${renderAccountList(platform, connected, abnormal)}
          ${renderAuthSession(platform.platform)}
        </div>
      </article>
    `;
  }).join('');
}

function renderAccountList(platform, connected, abnormalCount) {
  const platformId = platform.platform;
  const publishableConnected = connected.filter(accountSupportsCurrentContentKind);
  if (publishableConnected.length === 0) {
    if (connected.length > 0 && !platformSupportsCurrentContentKind(platform)) {
      return `<p class="account-note">已连接账号暂不支持${escapeHtml(getContentKindLabel())}直接发布，可在内容页选择浏览器辅助发布。</p>`;
    }
    if (!platformCanAuth(platform)) {
      return `<p class="account-note">${escapeHtml(authUnavailableText(platform))}</p>`;
    }
    return `<p class="account-note">${abnormalCount > 0 ? '账号状态异常，请重新连接。' : '连接账号后即可在这里选择发布目标。'}</p>`;
  }

  return `
    <div class="account-list">
      ${publishableConnected.map(account => renderAccountChoice(account, { platformId, compact: true })).join('')}
    </div>
  `;
}

function renderAccountChoice(account, options = {}) {
  const platformId = options.platformId || account.type;
  const platformLabel = platformNames.get(platformId) || platformId;
  const id = accountId(account);
  const checked = state.selectedAccountIds.has(id);
  return `
    <label class="account-option${checked ? ' is-selected' : ''}">
      <input type="checkbox" data-action="select-account" value="${escapeHtml(id)}" ${checked ? 'checked' : ''} />
      <span class="avatar">${renderAvatar(account)}</span>
      <span class="account-copy">
        <span class="account-name">${escapeHtml(accountName(account))}</span>
        <span class="account-id">${escapeHtml(platformLabel)} / ${escapeHtml(account.uid || id)}</span>
      </span>
      ${options.compact ? '' : '<span class="mini-pill is-ok">可发布</span>'}
    </label>
  `;
}

function renderPublishTargetPanel() {
  if (!els.publishTargetPanel) {
    return;
  }

  const availableAccounts = getAvailableAccounts();
  const selectedAccounts = getSelectedAccounts();
  const selectedPlatforms = getSelectedPlatformNames();
  const onlyAccount = availableAccounts.length === 1 ? availableAccounts[0] : null;
  const summaryText = selectedAccounts.length > 0
    ? `已选择 ${selectedAccounts.length} 个账号：${selectedPlatforms.join(' / ')}`
    : availableAccounts.length > 0
      ? `请选择本次要直接发布${getContentKindLabel()}的账号。系统会记住这次选择。`
      : state.contentKind === 'video'
        ? '还没有可用视频发布账号，请先连接或重新授权。'
        : '当前没有支持该文字类型的 OpenAPI 账号，可选择浏览器辅助发布。';

  if (availableAccounts.length === 0) {
    els.publishTargetPanel.innerHTML = `
      <section class="publish-target-panel" tabindex="-1" aria-labelledby="publishTargetTitle">
        <div class="publish-target-head">
          <div>
            <span id="publishTargetTitle" class="field-title">直接发布目标</span>
            <p>${escapeHtml(summaryText)}</p>
          </div>
          ${state.contentKind === 'video' ? '<button class="small-button" type="button" data-view-target="accounts">去连接账号</button>' : '<span class="mini-pill is-warn">无直接目标</span>'}
        </div>
      </section>
    `;
    return;
  }

  els.publishTargetPanel.innerHTML = `
    <section class="publish-target-panel" tabindex="-1" aria-labelledby="publishTargetTitle">
      <div class="publish-target-head">
        <div>
          <span id="publishTargetTitle" class="field-title">直接发布目标</span>
          <p>${escapeHtml(summaryText)}</p>
          ${state.selectionNotice ? `<p class="target-warning">${escapeHtml(state.selectionNotice)}</p>` : ''}
        </div>
        <span class="mini-pill ${selectedAccounts.length > 0 ? 'is-ok' : 'is-warn'}">${escapeHtml(selectedAccounts.length > 0 ? `已选 ${selectedAccounts.length}` : '未选择')}</span>
      </div>
      <div class="publish-target-list">
        ${availableAccounts.map(account => renderPublishTargetOption(account)).join('')}
      </div>
      ${onlyAccount && selectedAccounts.length === 0 && !state.selectionHistoryExists ? `
        <button class="small-button target-quick-button" type="button" data-action="select-only-account" data-account-id="${escapeHtml(accountId(onlyAccount))}">
          选择此账号
        </button>
      ` : ''}
    </section>
  `;
}

function renderBrowserTargetList() {
  if (!els.browserTargetList) {
    return;
  }

  const targets = browserTargetDefinitions.filter(target => target.kind === state.contentKind);
  const selectedTargets = getSelectedBrowserTargets();
  if (els.browserTargetCount) {
    els.browserTargetCount.textContent = selectedTargets.length > 0 ? `已选 ${selectedTargets.length}` : '未选择';
    els.browserTargetCount.className = `mini-pill ${selectedTargets.length > 0 ? 'is-ok' : 'is-warn'}`;
  }

  if (state.contentKind === 'video') {
    els.browserTargetList.innerHTML = '<p class="option-empty">视频发布继续使用 OpenAPI 任务流。</p>';
    return;
  }

  if (targets.length === 0) {
    els.browserTargetList.innerHTML = '<p class="option-empty">当前内容类型没有浏览器辅助平台。</p>';
    return;
  }

  els.browserTargetList.innerHTML = targets.map((target) => {
    const checked = state.browserTargetIds.has(target.id);
    return `
      <label class="browser-target-option${checked ? ' is-selected' : ''}">
        <input type="checkbox" data-action="select-browser-target" value="${escapeHtml(target.id)}" ${checked ? 'checked' : ''} />
        <span class="browser-target-copy">
          <span class="target-account-top">
            <strong>${escapeHtml(target.label)}</strong>
            <span class="mini-pill is-warn">${escapeHtml(target.mode)}</span>
          </span>
          <span>${escapeHtml(target.help)}</span>
        </span>
      </label>
    `;
  }).join('');
}

function setBrowserTarget(targetId, isSelected) {
  const target = browserTargetDefinitions.find(item => item.id === targetId);
  if (!target || target.kind !== state.contentKind) {
    showToast('该浏览器辅助目标不适用于当前内容类型。', 'warn');
    return;
  }
  if (isSelected) {
    state.browserTargetIds.add(targetId);
  }
  else {
    state.browserTargetIds.delete(targetId);
  }
  renderSelectionSurfaces();
}

function renderPublishTargetOption(account) {
  const platformId = account.type;
  const platformLabel = platformNames.get(platformId) || platformId;
  const id = accountId(account);
  const checked = state.selectedAccountIds.has(id);
  return `
    <label class="publish-target-option${checked ? ' is-selected' : ''}">
      <input type="checkbox" data-action="select-account" value="${escapeHtml(id)}" ${checked ? 'checked' : ''} />
      <span class="avatar">${renderAvatar(account)}</span>
      <span class="target-account-copy">
        <span class="target-account-top">
          <strong>${escapeHtml(accountName(account))}</strong>
          <span class="mini-pill is-ok">正常</span>
        </span>
        <span>${escapeHtml(platformLabel)} / ${escapeHtml(account.uid || id)}</span>
      </span>
    </label>
  `;
}

function renderSelectedTargetsSummary() {
  if (!els.selectedTargetsSummary) {
    return;
  }
  const names = getSelectedPlatformNames();
  const browserNames = getSelectedBrowserTargets().map(target => target.label);
  const parts = [
    ...(names.length > 0 ? [`直接发布：${names.join(' / ')}`] : []),
    ...(browserNames.length > 0 ? [`浏览器辅助：${browserNames.join(' / ')}`] : []),
  ];
  els.selectedTargetsSummary.textContent = parts.length > 0
    ? parts.join('；')
    : '请选择发布目标';
  els.selectedTargetsSummary.classList.toggle('is-ready', parts.length > 0);
}

function renderAuthSession(platformId) {
  const session = state.authSessions.get(platformId);
  if (!session) {
    return '';
  }
  if (session.status === 'completed') {
    return '<p class="account-note">授权完成，正在刷新账号列表。</p>';
  }
  if (session.status === 'failed' || session.status === 'expired') {
    return `<p class="account-note">${escapeHtml(session.message || '授权未完成，请重新发起连接。')}</p>`;
  }
  if (session.requiresSelection && Array.isArray(session.selectableAccounts) && session.selectableAccounts.length > 0) {
    return `
      <div class="account-list" data-selectable-platform="${escapeHtml(platformId)}">
        ${session.selectableAccounts.map(account => `
          <label class="account-option">
            <input type="checkbox" data-action="select-auth-account" data-platform="${escapeHtml(platformId)}" data-platform-uid="${escapeHtml(account.platformUid)}" data-account="${escapeHtml(account.account || '')}" checked />
            <span class="avatar">${account.avatarUrl ? `<img src="${escapeHtml(account.avatarUrl)}" alt="" />` : initials(account.displayName)}</span>
            <span class="account-copy">
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
  if (session.qrCodeUrl) {
    const platform = getPlatformDefinition(platformId);
    const instruction = localizedText(session.authInstructions) || localizedText(platform.authInstructions) || '请扫码并按平台提示完成授权。';
    const expiresAt = formatAuthExpiry(session.expiresAt);
    return `
      <div class="auth-qr-panel">
        <img class="auth-qr-image" src="${escapeHtml(session.qrCodeUrl)}" alt="${escapeHtml(getPlatformName(platform))} 授权二维码" />
        <div class="auth-qr-copy">
          <span class="auth-qr-title">${escapeHtml(getPlatformName(platform))}扫码连接</span>
          <span>${escapeHtml(instruction)}</span>
          ${session.message ? `<span class="auth-qr-meta">${escapeHtml(session.message)}</span>` : ''}
          ${expiresAt ? `<span class="auth-qr-meta">有效期至 ${escapeHtml(expiresAt)}</span>` : ''}
        </div>
      </div>
    `;
  }
  return `<p class="account-note">${escapeHtml(session.message || '授权窗口已打开，完成后这里会自动更新。')}</p>`;
}

function flattenOptionItems(items, level = 0) {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.flatMap((item) => {
    const current = item.disabled
      ? []
      : [{
          value: String(item.value ?? ''),
          label: `${'　'.repeat(level)}${item.label || item.value}`,
          description: item.description || '',
        }];
    return [...current, ...flattenOptionItems(item.children, level + 1)];
  });
}

function renderSelectOptions(items, selectedValue) {
  return items.map(item => `
    <option value="${escapeHtml(item.value)}" ${String(selectedValue) === String(item.value) ? 'selected' : ''}>
      ${escapeHtml(item.label)}
    </option>
  `).join('');
}

function updatePlatformOption(platform, field, value, rerender = true) {
  if (!state.platformOptions[platform]) {
    state.platformOptions[platform] = {};
  }
  state.platformOptions[platform][field] = value;
  if (rerender) {
    renderPlatformOptions();
  }
  buildPreflight();
}

function renderPlatformOptions() {
  const selectedPlatformIds = getSelectedPlatformIds();
  if (selectedPlatformIds.length === 0) {
    els.platformOptionsList.innerHTML = '<p class="option-empty">选择账号后显示对应平台配置。</p>';
    return;
  }

  els.platformOptionsList.innerHTML = selectedPlatformIds.map((platformId) => {
    if (platformId === 'bilibili') {
      return renderBilibiliOptions();
    }
    if (platformId === 'douyin') {
      return renderDouyinOptions();
    }
    if (platformId === 'KWAI') {
      return renderKwaiOptions();
    }
    if (platformId === 'wxSph') {
      return renderWorkLinkOptions('wxSph', '微信视频号', '视频号当前不是 OpenAPI 一键上传：请先通过视频号网页/插件生成作品 ID，或粘贴已发布作品链接。');
    }
    if (platformId === 'xhs') {
      return renderWorkLinkOptions('xhs', '小红书', '上游当前要求提供已完成的小红书作品链接，暂不支持从这里直接上传发布。');
    }
    return `
      <article class="platform-option-card">
        <div class="option-title">
          <strong>${escapeHtml(platformNames.get(platformId) || platformId)}</strong>
          <span class="mini-pill is-warn">使用默认配置</span>
        </div>
      </article>
    `;
  }).join('');
}

function renderBilibiliOptions() {
  const option = state.platformOptions.bilibili;
  const tidItems = flattenOptionItems(state.optionValues.bilibiliTid?.items);
  const tidOptions = tidItems.length > 0
    ? renderSelectOptions(tidItems, option.tid)
    : '<option value="21">日常</option>';
  return `
    <article class="platform-option-card">
      <div class="option-title">
        <strong>Bilibili</strong>
        <span class="mini-pill is-ok">可自动提交</span>
      </div>
      <div class="option-grid">
        <label class="field">
          <span>分区</span>
          <select data-option-platform="bilibili" data-option-field="tid">${tidOptions}</select>
        </label>
        <label class="field">
          <span>类型</span>
          <select data-option-platform="bilibili" data-option-field="copyright">
            <option value="1" ${option.copyright === '1' ? 'selected' : ''}>原创</option>
            <option value="2" ${option.copyright === '2' ? 'selected' : ''}>转载</option>
          </select>
        </label>
        <label class="field">
          <span>转载设置</span>
          <select data-option-platform="bilibili" data-option-field="no_reprint">
            <option value="1" ${option.no_reprint === '1' ? 'selected' : ''}>禁止转载</option>
            <option value="0" ${option.no_reprint === '0' ? 'selected' : ''}>允许转载</option>
          </select>
        </label>
      </div>
      ${option.copyright === '2' ? `
        <label class="field">
          <span>转载来源</span>
          <input type="text" value="${escapeHtml(option.source)}" data-option-platform="bilibili" data-option-field="source" placeholder="填写原视频来源" />
        </label>
      ` : ''}
    </article>
  `;
}

function renderDouyinOptions() {
  const option = state.platformOptions.douyin;
  return `
    <article class="platform-option-card">
      <div class="option-title">
        <strong>抖音</strong>
        <span class="mini-pill is-warn">需手机确认</span>
      </div>
      <div class="option-grid">
        <label class="field">
          <span>可见范围</span>
          <select data-option-platform="douyin" data-option-field="private_status">
            <option value="0" ${option.private_status === '0' ? 'selected' : ''}>公开</option>
            <option value="1" ${option.private_status === '1' ? 'selected' : ''}>私密</option>
            <option value="2" ${option.private_status === '2' ? 'selected' : ''}>好友可见</option>
          </select>
        </label>
        <label class="field">
          <span>下载权限</span>
          <select data-option-platform="douyin" data-option-field="download_type">
            <option value="1" ${option.download_type === '1' ? 'selected' : ''}>允许下载</option>
            <option value="2" ${option.download_type === '2' ? 'selected' : ''}>不允许下载</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>短标题</span>
        <input type="text" maxlength="12" value="${escapeHtml(option.short_title)}" data-option-platform="douyin" data-option-field="short_title" placeholder="选填，最多 12 字" />
      </label>
      <p class="option-note">提交后会生成抖音发布入口，扫码或打开短链后在抖音完成最后确认。</p>
    </article>
  `;
}

function renderKwaiOptions() {
  const option = state.platformOptions.KWAI;
  return `
    <article class="platform-option-card">
      <div class="option-title">
        <strong>快手</strong>
        <span class="mini-pill is-ok">可自动轮询</span>
      </div>
      <div class="option-grid">
        <label class="field">
          <span>视频类型</span>
          <input type="text" value="${escapeHtml(option.stereo_type)}" data-option-platform="KWAI" data-option-field="stereo_type" placeholder="选填" />
        </label>
        <label class="field">
          <span>商品 ID</span>
          <input type="text" value="${escapeHtml(option.merchant_product_id)}" data-option-platform="KWAI" data-option-field="merchant_product_id" placeholder="选填" />
        </label>
      </div>
    </article>
  `;
}

function renderWorkLinkOptions(platformId, title, note) {
  const option = state.platformOptions[platformId] || {};
  return `
    <article class="platform-option-card">
      <div class="option-title">
        <strong>${escapeHtml(title)}</strong>
        <span class="mini-pill is-warn">需外部作品</span>
      </div>
      ${platformId === 'wxSph' ? `
        <label class="field">
          <span>作品 ID</span>
          <input type="text" value="${escapeHtml(option.workId || '')}" data-option-platform="${escapeHtml(platformId)}" data-option-field="workId" placeholder="插件返回的作品锚点 ID" />
        </label>
      ` : ''}
      <label class="field">
        <span>作品链接</span>
        <input type="url" value="${escapeHtml(option.workLink || '')}" data-option-platform="${escapeHtml(platformId)}" data-option-field="workLink" placeholder="粘贴平台作品链接" />
      </label>
      <p class="option-note">${escapeHtml(note)}</p>
    </article>
  `;
}

async function loadBilibiliOptions(force = false) {
  if (state.optionValues.bilibiliTid && !force) {
    return;
  }
  const account = getSelectedAccounts().find(item => item.type === 'bilibili');
  if (!account) {
    return;
  }
  try {
    const result = await api(`/api/accounts/${encodeURIComponent(accountId(account))}/publish-options/tid/values`);
    state.optionValues.bilibiliTid = result;
    const items = flattenOptionItems(result?.items);
    if (items.length > 0 && !items.some(item => item.value === state.platformOptions.bilibili.tid)) {
      state.platformOptions.bilibili.tid = items[0].value;
    }
    renderPlatformOptions();
  }
  catch (error) {
    showToast(`Bilibili 分区加载失败：${error.message}`, 'warn');
  }
}

function maybeLoadSelectedPlatformOptions(force = false) {
  if (getSelectedPlatformIds().includes('bilibili')) {
    loadBilibiliOptions(force);
  }
}

function getMediaUrls() {
  const uploadedUrls = state.mediaItems
    .filter(item => item.status === 'success' && item.url)
    .map(item => item.url);
  const manualUrls = els.mediaInput.value
    .split(/\r?\n/)
    .map(item => item.trim())
    .filter(Boolean);

  return [...new Set([...uploadedUrls, ...manualUrls])];
}

function getContentPackage(preflight) {
  return {
    kind: state.contentKind,
    title: els.titleInput.value.trim(),
    body: els.bodyInput.value.trim(),
    htmlContent: els.htmlContentInput?.value.trim() || '',
    markdownContent: els.markdownContentInput?.value.trim() || '',
    digest: els.digestInput?.value.trim() || '',
    coverUrl: els.coverInput.value.trim(),
    mediaUrls: preflight?.mediaUrls || getMediaUrls(),
    tags: parseTagsInput(),
    publishMode: els.publishModeInput.value === 'auto' ? 'auto' : 'draft',
  };
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function getMediaKind(file) {
  if (file.type.startsWith('video/')) {
    return 'video';
  }
  if (file.type.startsWith('image/')) {
    return 'image';
  }
  const name = file.name.toLowerCase();
  if (/\.(mp4|mov|m4v|webm)$/.test(name)) {
    return 'video';
  }
  if (/\.(jpg|jpeg|png|webp|gif|avif)$/.test(name)) {
    return 'image';
  }
  return '';
}

function validateFilesForMode(files) {
  const list = [...files];
  if (list.length === 0) {
    return [];
  }
  if (state.mediaMode === 'video') {
    if (list.length > 1 || state.mediaItems.some(item => item.status !== 'removed') || getMediaUrls().length > 0) {
      showToast('视频模式一次只允许 1 个视频素材，请先删除已有素材。', 'warn');
      return [];
    }
    const file = list[0];
    if (getMediaKind(file) !== 'video') {
      showToast('视频模式只接受视频文件。', 'warn');
      return [];
    }
    return [file];
  }

  const allowedFiles = list.filter((file) => {
    const kind = getMediaKind(file);
    return state.contentKind === 'dynamic' ? ['image', 'video'].includes(kind) : kind === 'image';
  });
  if (allowedFiles.length !== list.length) {
    showToast(state.contentKind === 'dynamic' ? '短动态只接受图片或视频文件，已忽略其它文件。' : '当前模式只接受图片文件，已忽略其它文件。', 'warn');
  }
  return allowedFiles;
}

function renderMediaQueue() {
  if (state.mediaItems.length === 0) {
    els.mediaQueue.innerHTML = '<p class="media-empty">队列为空。上传文件或粘贴备用链接后会显示在这里。</p>';
    return;
  }

  els.mediaQueue.innerHTML = state.mediaItems.map((item) => {
    const statusTone = item.status === 'success' ? 'ok' : item.status === 'error' ? 'danger' : 'warn';
    const statusText = item.status === 'success'
      ? '已上传'
      : item.status === 'error'
        ? '失败'
        : item.status === 'confirming'
          ? '确认中'
          : '上传中';
    const canRetry = item.status === 'error' && item.file;
    const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
    return `
      <article class="media-item${item.status === 'success' ? ' is-success' : item.status === 'error' ? ' is-error' : ''}" data-media-id="${escapeHtml(item.id)}">
        <div class="media-item-main">
          <div class="media-title-row">
            <span class="media-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="mini-pill is-${statusTone}">${escapeHtml(statusText)}</span>
          </div>
          <p class="media-meta">${escapeHtml(formatFileSize(item.size))} · ${escapeHtml(item.type || item.kind || '未知类型')}</p>
          ${item.status !== 'success' && item.status !== 'error' ? `
            <div class="progress-track" aria-label="上传进度">
              <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
          ` : ''}
          ${item.url ? `<p class="media-url">${escapeHtml(item.url)}</p>` : ''}
          ${item.error ? `<p class="media-error">${escapeHtml(item.error)}</p>` : ''}
        </div>
        <div class="media-actions">
          ${canRetry ? `<button class="media-action" type="button" data-action="retry-media" data-media-id="${escapeHtml(item.id)}">重试</button>` : ''}
          <button class="media-action" type="button" data-action="remove-media" data-media-id="${escapeHtml(item.id)}">删除</button>
        </div>
      </article>
    `;
  }).join('');
}

function updateMediaModeUi() {
  const isVideo = state.contentKind === 'video';
  const isDynamic = state.contentKind === 'dynamic';
  state.mediaMode = isVideo ? 'video' : 'images';
  els.mediaLabel.textContent = isVideo ? '视频素材' : isDynamic ? '动态素材' : '正文图片';
  els.mediaHelp.textContent = isVideo
    ? '拖入本地视频或选择文件，上传成功后自动加入队列。'
    : isDynamic
      ? '短动态可上传图片或视频，浏览器辅助平台会尽量填入。'
      : '可上传正文图片。公众号长文章封面请填写封面链接。';
  els.dropZoneHint.textContent = isVideo
    ? '视频模式一次只接受 1 个视频文件。'
    : isDynamic
      ? '短动态支持图片或视频素材。'
      : '长文章支持一次选择多张正文图片。';
  els.fileInput.accept = isVideo ? 'video/*' : isDynamic ? 'image/*,video/*' : 'image/*';
  els.fileInput.multiple = !isVideo;
  els.mediaInput.placeholder = isVideo
    ? '每行粘贴一个公开视频链接，必须以 https:// 开头'
    : isDynamic
      ? '每行粘贴一个公开图片或视频链接，必须以 https:// 开头'
      : '每行粘贴一个公开图片链接，必须以 https:// 开头';
  if (els.articleExtraFields) {
    els.articleExtraFields.hidden = state.contentKind !== 'article';
  }
}

function addMediaFiles(fileList) {
  const files = validateFilesForMode(fileList);
  if (files.length === 0) {
    return;
  }

  for (const file of files) {
    const kind = getMediaKind(file);
    const item = {
      id: `media-${state.nextMediaId++}`,
      file,
      name: file.name || `media-${Date.now()}`,
      size: file.size,
      type: file.type || 'application/octet-stream',
      kind,
      status: 'uploading',
      progress: 0,
      url: '',
      error: '',
      assetId: '',
    };
    state.mediaItems.push(item);
    uploadMediaItem(item);
  }

  renderMediaQueue();
  buildPreflight();
}

function setMediaItem(id, patch) {
  const item = state.mediaItems.find(candidate => candidate.id === id);
  if (!item) {
    return null;
  }
  Object.assign(item, patch);
  renderMediaQueue();
  buildPreflight();
  return item;
}

function uploadWithProgress(uploadUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(`对象存储上传失败：${xhr.status || '未知状态'}`));
    });
    xhr.addEventListener('error', () => reject(new Error('对象存储上传失败：网络错误')));
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

async function uploadMediaItem(item) {
  try {
    setMediaItem(item.id, { status: 'uploading', progress: 3, error: '', url: '' });
    const sign = await api('/api/assets/upload-sign', {
      method: 'POST',
      body: JSON.stringify({
        filename: item.name,
        size: item.size,
        mediaKind: item.kind,
      }),
    });
    if (!sign?.id || !sign?.uploadUrl) {
      throw new Error('上传签名缺少 uploadUrl');
    }

    setMediaItem(item.id, { assetId: sign.id, progress: 8 });
    await uploadWithProgress(sign.uploadUrl, item.file, (progress) => {
      setMediaItem(item.id, { progress: Math.max(8, Math.min(96, progress)) });
    });

    setMediaItem(item.id, { status: 'confirming', progress: 98 });
    const confirmed = await api(`/api/assets/${encodeURIComponent(sign.id)}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ id: sign.id }),
    });
    const finalUrl = confirmed?.url || sign.url;
    if (!isHttpsUrl(finalUrl)) {
      throw new Error('上传完成但未返回可用链接');
    }
    if (setMediaItem(item.id, { status: 'success', progress: 100, url: finalUrl, error: '' })) {
      showToast('素材上传完成。');
    }
  }
  catch (error) {
    if (setMediaItem(item.id, { status: 'error', error: error.message || '上传失败' })) {
      showToast(error.message || '素材上传失败', 'danger');
    }
  }
}

function retryMediaItem(id) {
  const item = state.mediaItems.find(candidate => candidate.id === id);
  if (!item?.file) {
    showToast('找不到可重试的本地文件。', 'danger');
    return;
  }
  uploadMediaItem(item);
}

function removeMediaItem(id) {
  state.mediaItems = state.mediaItems.filter(item => item.id !== id);
  renderMediaQueue();
  buildPreflight();
}

function clearMediaItems() {
  state.mediaItems = [];
  els.mediaInput.value = '';
  renderMediaQueue();
  buildPreflight();
}

function buildPreflight() {
  const selectedAccounts = getSelectedAccounts();
  const selectedPlatforms = new Set(selectedAccounts.map(account => account.type));
  const selectedBrowserTargets = getSelectedBrowserTargets();
  const mediaUrls = getMediaUrls();
  const title = els.titleInput.value.trim();
  const body = els.bodyInput.value.trim();
  const cover = els.coverInput.value.trim();
  const uploadingCount = state.mediaItems.filter(item => ['uploading', 'confirming'].includes(item.status)).length;
  const failedCount = state.mediaItems.filter(item => item.status === 'error').length;
  const uploadedItems = state.mediaItems.filter(item => item.status === 'success');
  const issues = [];
  const hasDirectTargets = selectedAccounts.length > 0;
  const hasBrowserTargets = selectedBrowserTargets.length > 0;
  const hasTargets = hasDirectTargets || hasBrowserTargets;
  const hasTextContent = title.length > 0 || body.length > 0;
  const articleBodyReady = body.length > 0 || (els.htmlContentInput?.value.trim() || '').length > 0 || (els.markdownContentInput?.value.trim() || '').length > 0;
  const uploadedTypesOk = uploadedItems.every((item) => {
    if (state.contentKind === 'video') {
      return item.kind === 'video';
    }
    if (state.contentKind === 'article') {
      return item.kind === 'image';
    }
    return ['image', 'video'].includes(item.kind);
  });
  const articleMediaUrlsOk = state.contentKind !== 'article' || mediaUrls.every(url => !looksLikeVideoUrl(url));

  const checks = [
    {
      ok: hasTargets,
      text: hasTargets
        ? `已选择 ${selectedAccounts.length} 个直接目标、${selectedBrowserTargets.length} 个浏览器辅助目标`
        : '请选择发布目标',
      action: hasTargets ? '' : 'target',
    },
    {
      ok: state.contentKind === 'article' ? title.length > 0 && articleBodyReady : state.contentKind === 'dynamic' ? body.length > 0 : hasTextContent,
      text: state.contentKind === 'article'
        ? title.length > 0 && articleBodyReady ? '长文章标题和正文已填写' : '长文章需要标题和正文'
        : state.contentKind === 'dynamic'
          ? body.length > 0 ? '短动态正文已填写' : '短动态需要正文'
          : hasTextContent ? '标题或正文已填写' : '标题和正文至少填写一项',
    },
    {
      ok: uploadingCount === 0,
      text: uploadingCount === 0 ? '没有等待上传的文件' : `等待 ${uploadingCount} 个素材上传完成`,
    },
    {
      ok: state.contentKind !== 'video' || mediaUrls.length > 0,
      text: state.contentKind !== 'video' || mediaUrls.length > 0 ? `已有 ${mediaUrls.length} 个可用素材链接` : '视频发布需要 1 个视频素材',
    },
    {
      ok: state.contentKind !== 'video' || mediaUrls.length <= 1,
      text: state.contentKind !== 'video' || mediaUrls.length <= 1 ? '素材数量符合当前模式' : '视频模式只保留 1 个素材',
    },
    {
      ok: uploadedTypesOk,
      text: uploadedTypesOk
        ? '上传素材类型符合当前模式'
        : state.contentKind === 'video'
          ? '视频模式只允许视频文件'
          : state.contentKind === 'article'
            ? '长文章正文素材只允许图片文件'
            : '短动态只允许图片或视频文件',
    },
    {
      ok: articleMediaUrlsOk,
      text: articleMediaUrlsOk ? '正文素材链接符合当前内容类型' : '长文章正文素材只允许图片链接',
    },
    {
      ok: mediaUrls.every(isHttpsUrl) && (!cover || isHttpsUrl(cover)),
      text: '素材和封面链接必须以 https:// 开头',
    },
    {
      ok: hasDirectTargets || state.contentKind !== 'video',
      text: hasDirectTargets || state.contentKind !== 'video' ? '直接发布目标已就绪' : '视频发布需要选择 OpenAPI 账号',
      action: hasDirectTargets || state.contentKind !== 'video' ? '' : 'target',
    },
  ];

  if (failedCount > 0) {
    checks.push({
      ok: false,
      warn: true,
      text: `${failedCount} 个素材上传失败，可删除或重试`,
    });
  }

  for (const check of checks) {
    if (!check.ok) {
      issues.push(check.text);
    }
  }

  if (selectedPlatforms.has('bilibili') && !state.platformOptions.bilibili.tid) {
    checks.push({
      ok: false,
      text: 'Bilibili 需要选择发布分区',
    });
    issues.push('Bilibili 需要选择发布分区');
  }

  if (selectedPlatforms.has('bilibili') && state.platformOptions.bilibili.copyright === '2' && !state.platformOptions.bilibili.source.trim()) {
    checks.push({
      ok: false,
      text: 'Bilibili 转载发布需要填写来源',
    });
    issues.push('Bilibili 转载发布需要填写来源');
  }

  if (selectedPlatforms.has('wxSph')) {
    const wxOption = state.platformOptions.wxSph;
    if (!wxOption.workId.trim() && !wxOption.workLink.trim()) {
      const message = '微信视频号当前不是 OpenAPI 一键上传，需要先填写插件作品 ID 或已发布作品链接';
      checks.push({
        ok: false,
        text: message,
      });
      issues.push(message);
    }
  }

  if (state.contentKind === 'video' && selectedPlatforms.has('xhs') && !state.platformOptions.xhs.workLink.trim()) {
    checks.push({
      ok: false,
      text: '小红书当前需要填写已完成作品链接',
    });
    issues.push('小红书当前需要填写已完成作品链接');
  }

  if (selectedPlatforms.has('douyin')) {
    checks.push({
      ok: true,
      warn: true,
      text: '抖音会生成确认入口，需在手机上完成最后一步',
    });
  }

  const needsWechatCover = selectedBrowserTargets.some(target => target.id === 'ARTICLE_WEIXIN');
  if (needsWechatCover && !cover) {
    checks.push({
      ok: false,
      text: '微信公众号长文章需要填写封面链接',
    });
    issues.push('微信公众号长文章需要填写封面链接');
  }

  if (hasDirectTargets) {
    checks.push({
      ok: true,
      text: 'OpenAPI 可发布平台将创建直接发布任务',
    });
  }

  if (hasBrowserTargets) {
    checks.push({
      ok: true,
      warn: true,
      text: `浏览器辅助将打开 ${selectedBrowserTargets.length} 个平台，默认需要人工确认`,
    });
  }

  els.preflightList.innerHTML = checks.map(check => `
    <div class="check-row ${check.ok ? 'is-ok' : check.warn ? 'is-warn' : ''}">
      <span class="check-icon">${check.ok ? '✓' : check.warn ? '!' : '×'}</span>
      <span>${escapeHtml(check.text)}</span>
      ${check.action === 'target' ? '<button class="check-action" type="button" data-action="go-publish-target">选择目标</button>' : ''}
    </div>
  `).join('');

  renderSelectedTargetsSummary();
  updateOverview({ issues, selectedAccounts, selectedBrowserTargets, mediaUrls });
  return { issues, selectedAccounts, selectedBrowserTargets, mediaUrls };
}

function updateOverview(preflight) {
  const selectedAccounts = preflight?.selectedAccounts
    || getSelectedAccounts();
  const selectedBrowserTargets = preflight?.selectedBrowserTargets || getSelectedBrowserTargets();
  const mediaUrls = preflight?.mediaUrls || getMediaUrls();
  const normalCount = state.accounts.filter(account => getAccountStatus(account) === 'normal' && accountSupportsCurrentContentKind(account)).length;
  const title = els.titleInput.value.trim();
  const body = els.bodyInput.value.trim();
  const hasContent = state.contentKind === 'article'
    ? title.length > 0 && (body.length > 0 || (els.htmlContentInput?.value.trim() || '').length > 0 || (els.markdownContentInput?.value.trim() || '').length > 0)
    : state.contentKind === 'dynamic'
      ? body.length > 0
      : title.length > 0 || body.length > 0;
  const hasTargets = selectedAccounts.length > 0 || selectedBrowserTargets.length > 0;
  const hasMedia = state.contentKind === 'video' ? mediaUrls.length > 0 : true;
  const issues = Array.isArray(preflight?.issues) ? preflight.issues : [];
  const isReady = issues.length === 0 && hasTargets && hasContent && hasMedia;

  if (els.connectedMetric) {
    els.connectedMetric.textContent = String(normalCount);
  }
  if (els.selectedMetric) {
    els.selectedMetric.textContent = String(selectedAccounts.length + selectedBrowserTargets.length);
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

  updateOverviewSignals({
    hasAccounts: hasTargets,
    hasDirectTargets: selectedAccounts.length > 0,
    hasBrowserTargets: selectedBrowserTargets.length > 0,
    hasContent,
    hasMedia,
    isReady,
    normalCount,
    selectedCount: selectedAccounts.length + selectedBrowserTargets.length,
    mediaCount: mediaUrls.length,
  });
}

function updateOverviewSignals(summary) {
  const activeFlow = Boolean(state.activeFlowId);
  const activeHandoff = Boolean(state.activeHandoff);
  const next = !summary.hasAccounts
    ? {
      title: summary.normalCount > 0 || state.contentKind !== 'video' ? '选择发布目标' : '先连接目标',
      text: summary.normalCount > 0 || state.contentKind !== 'video' ? '在内容页勾选本次要发布的平台目标。' : '先连接至少一个可用平台账号。',
      view: summary.normalCount > 0 || state.contentKind !== 'video' ? 'compose' : 'accounts',
      focusTarget: summary.normalCount > 0 || state.contentKind !== 'video' ? 'publish-target' : '',
    }
    : !summary.hasContent
      ? {
        title: '补齐正文',
        text: '填写标题或正文，让各平台有可同步的内容。',
        view: 'compose',
      }
      : !summary.hasMedia
        ? {
          title: '加入素材',
          text: '上传文件，或粘贴符合要求的备用素材链接。',
          view: 'compose',
        }
        : !summary.isReady
          ? {
            title: '处理阻塞项',
            text: '打开检查页，按提示修正提交前问题。',
            view: 'publish',
          }
          : activeFlow || activeHandoff
            ? {
              title: '查看任务结果',
              text: '任务已经提交，继续观察各平台返回状态。',
              view: 'publish',
            }
            : {
              title: '可以提交',
              text: '目标、正文和素材已就绪，可以进入最终检查。',
              view: 'publish',
            };

  if (els.nextActionTitle) {
    els.nextActionTitle.textContent = next.title;
  }
  if (els.nextActionText) {
    els.nextActionText.textContent = next.text;
  }
  if (els.nextActionButton) {
    els.nextActionButton.dataset.viewTarget = next.view;
    if (next.focusTarget) {
      els.nextActionButton.dataset.focusTarget = next.focusTarget;
    }
    else {
      delete els.nextActionButton.dataset.focusTarget;
    }
  }
  if (els.accountSignal) {
    els.accountSignal.textContent = summary.hasAccounts ? `已选 ${summary.selectedCount} 个目标` : '等待选择目标';
    els.accountSignal.classList.toggle('is-ok', summary.hasAccounts);
  }
  if (els.contentSignal) {
    els.contentSignal.textContent = summary.hasContent ? '正文已准备' : '正文未填写';
    els.contentSignal.classList.toggle('is-ok', summary.hasContent);
  }
  if (els.mediaSignal) {
    els.mediaSignal.textContent = summary.hasMedia ? `素材 ${summary.mediaCount} 个` : '素材未就绪';
    els.mediaSignal.classList.toggle('is-ok', summary.hasMedia);
  }
  if (els.submitSignal) {
    els.submitSignal.textContent = activeFlow || activeHandoff ? '任务已提交' : summary.isReady ? '等待提交' : '尚未提交任务';
    els.submitSignal.classList.toggle('is-ok', activeFlow || activeHandoff);
  }
}

function setActiveView(viewName) {
  const nextView = [...els.viewPanels].some(panel => panel.dataset.view === viewName)
    ? viewName
    : 'overview';

  els.viewPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.view === nextView);
  });
  els.viewTriggers.forEach((trigger) => {
    const isActive = trigger.dataset.viewTarget === nextView;
    trigger.classList.toggle('is-active', isActive);
    if (trigger.classList.contains('top-nav-link')) {
      trigger.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
  });
}

function focusPublishTargetPanel() {
  const panel = els.publishTargetPanel?.querySelector('.publish-target-panel');
  if (!panel) {
    return;
  }
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.focus({ preventScroll: true });
}

function goToPublishTarget() {
  setActiveView('compose');
  window.setTimeout(focusPublishTargetPanel, 60);
}

function renderFlow(flow) {
  if (!flow || !flow.flowId) {
    state.activeFlowId = '';
    if (!state.activeHandoff) {
      els.flowMeta.textContent = '未提交';
    }
    renderResultBlocks(null, state.activeHandoff, state.activeHandoffDelivery);
    updateOverview();
    return;
  }

  state.activeFlowId = flow.flowId;
  renderResultBlocks(flow, state.activeHandoff, state.activeHandoffDelivery);
  loadUserActionsForTasks(Array.isArray(flow.tasks) ? flow.tasks : []);
  updateOverview();
}

function renderResultBlocks(flow, handoff, handoffDelivery) {
  const hasFlow = Boolean(flow?.flowId);
  const hasHandoff = Boolean(handoff?.handoffId);
  if (!hasFlow && !hasHandoff) {
    els.flowMeta.textContent = '未提交';
    els.flowBox.innerHTML = '<p class="empty-state">选择目标并准备内容后，任务结果会显示在这里。</p>';
    return;
  }

  els.flowMeta.textContent = hasFlow && hasHandoff
    ? '直接发布 + 浏览器辅助'
    : hasFlow
      ? '直接发布已提交'
      : '浏览器辅助待确认';
  els.flowBox.innerHTML = [
    hasFlow ? renderFlowBlock(flow) : '',
    hasHandoff ? renderHandoffBlock(handoff, handoffDelivery) : '',
  ].filter(Boolean).join('');
}

function renderFlowBlock(flow) {
  const tasks = Array.isArray(flow.tasks) ? flow.tasks : [];
  return `
    <div class="flow-summary">
      <strong>直接发布任务已创建</strong>
      <span class="mini-pill is-ok">server_published</span>
      <div class="flow-id">${escapeHtml(flow.flowId)}</div>
    </div>
    <div class="task-list">
      ${tasks.length > 0 ? tasks.map(renderTask).join('') : '<p class="empty-state">上游暂未返回任务列表。</p>'}
    </div>
  `;
}

function renderHandoffBlock(handoff, handoffDelivery) {
  const deliveryStatus = handoffDelivery?.status || handoff.status || 'browser_waiting_confirm';
  const isFailed = deliveryStatus === 'browser_failed';
  const targetRows = Array.isArray(handoff.targets) ? handoff.targets : [];
  const payloadText = JSON.stringify(handoff.syncData || {}, null, 2);
  return `
    <div class="flow-summary handoff-summary">
      <strong>浏览器辅助发布</strong>
      <span class="mini-pill is-${isFailed ? 'danger' : 'warn'}">${escapeHtml(deliveryStatus)}</span>
      <div class="flow-id">${escapeHtml(handoff.handoffId)}</div>
      <p class="handoff-note">${escapeHtml(handoffDelivery?.message || '已生成 MultiPost 内容包，扩展会打开目标平台并填入内容。')}</p>
      <div class="handoff-actions">
        <button class="handoff-button" type="button" data-action="copy-handoff">复制 handoff 数据</button>
      </div>
      <textarea class="handoff-payload" readonly aria-label="MultiPost handoff JSON">${escapeHtml(payloadText)}</textarea>
    </div>
    <div class="task-list">
      ${targetRows.map(target => `
        <article class="task-row">
          <div class="task-top">
            <span class="task-title">${escapeHtml(browserTargetNameMap.get(target.platform) || platformNames.get(target.platform) || target.platform)}</span>
            <span class="mini-pill is-${isFailed ? 'danger' : 'warn'}">${escapeHtml(isFailed ? '浏览器辅助失败' : '等待用户确认')}</span>
          </div>
          <p class="task-detail">${escapeHtml(isFailed ? '请确认 MultiPost 扩展已安装、启用并信任当前域名。' : '扩展将打开平台编辑页，默认不会点击最终发布按钮。')}</p>
        </article>
      `).join('')}
    </div>
  `;
}

function renderTask(task) {
  const account = state.accounts.find(item => item.id === task.accountId);
  const platformName = platformNames.get(task.platform) || task.platform || account?.type || '未知平台';
  const status = normalizeTaskStatus(task.status);
  const tone = status.tone;
  const detail = renderTaskDetail(task);

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

function isWaitingUserAction(task) {
  const value = String(task?.status ?? '').toLowerCase();
  return ['8', 'waiting_user_action', 'waitingforuseraction'].includes(value);
}

function renderTaskDetail(task) {
  if (task.errorMsg) {
    return `错误：${escapeHtml(task.errorMsg)}`;
  }
  if (task.workLink) {
    return `作品链接：<a href="${escapeHtml(task.workLink)}" target="_blank" rel="noreferrer">${escapeHtml(task.workLink)}</a>`;
  }
  if (isWaitingUserAction(task) && task.platform === 'douyin') {
    const action = state.userActions.get(task.id);
    if (action?.shortLink) {
      return `
        <span class="handoff-text">内容已准备好，请在抖音完成最后确认。</span>
        <span class="handoff-actions">
          <a class="handoff-button" href="${escapeHtml(action.shortLink)}" target="_blank" rel="noreferrer">打开发布入口</a>
          <span class="handoff-link">${escapeHtml(action.shortLink)}</span>
        </span>
      `;
    }
    if (action?.error) {
      return `抖音确认入口获取失败：${escapeHtml(action.error)}`;
    }
    if (state.userActionLoading.has(task.id)) {
      return '正在获取抖音确认入口...';
    }
    return '等待获取抖音确认入口';
  }
  if (task.platformWorkId) {
    return `平台作品 ID：${escapeHtml(task.platformWorkId)}`;
  }
  if (task.publishTime) {
    return `计划时间：${escapeHtml(task.publishTime)}`;
  }
  return '等待平台返回结果';
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

function loadUserActionsForTasks(tasks) {
  for (const task of tasks) {
    if (task.platform !== 'douyin' || !isWaitingUserAction(task) || !task.id) {
      continue;
    }
    if (state.userActions.has(task.id) || state.userActionLoading.has(task.id)) {
      continue;
    }
    loadUserAction(task.id);
  }
}

async function loadUserAction(recordId) {
  state.userActionLoading.add(recordId);
  try {
    const result = await api(`/api/publish-records/${encodeURIComponent(recordId)}/user-action`);
    state.userActions.set(recordId, result);
  }
  catch (error) {
    state.userActions.set(recordId, { error: error.message });
  }
  finally {
    state.userActionLoading.delete(recordId);
    if (state.activeFlowId) {
      try {
        const flow = await api(`/api/flows/${encodeURIComponent(state.activeFlowId)}`);
        renderFlow(flow);
      }
      catch {
        renderFlow({ flowId: state.activeFlowId, tasks: [] });
      }
    }
  }
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
      state.selectionNotice = '';
      setStatus('缺少 API Key', 'danger');
      renderPlatformGrid();
      renderPublishTargetPanel();
      renderSelectedTargetsSummary();
      buildPreflight();
      return;
    }

    const [platforms, accounts] = await Promise.all([
      api('/api/platforms'),
      api('/api/accounts'),
    ]);
    state.platforms = Array.isArray(platforms) ? platforms : [];
    state.accounts = Array.isArray(accounts.list) ? accounts.list : [];
    restoreSelectedAccountsFromStorage();
    setStatus('API 已连接', 'ok');
    renderPlatformGrid();
    renderPublishTargetPanel();
    renderSelectedTargetsSummary();
    renderPlatformOptions();
    maybeLoadSelectedPlatformOptions();
    buildPreflight();
  }
  catch (error) {
    setStatus('API 连接异常', 'danger');
    showToast(error.message, 'danger');
    renderPlatformGrid();
    renderPublishTargetPanel();
    renderSelectedTargetsSummary();
    buildPreflight();
  }
  finally {
    setLoading(false);
  }
}

function pruneSelectedAccounts() {
  const validIds = new Set(state.accounts.filter(account => getAccountStatus(account) === 'normal').map(accountId));
  let changed = false;
  for (const id of [...state.selectedAccountIds]) {
    if (!validIds.has(id)) {
      state.selectedAccountIds.delete(id);
      changed = true;
    }
  }
  if (changed && state.selectionHistoryExists) {
    persistSelectedAccountIds();
    state.selectionNotice = state.selectedAccountIds.size > 0
      ? '部分已选账号已失效或被移除，已自动忽略。'
      : '已选账号已失效或被移除，请重新选择发布目标。';
  }
}

function setLoading(isLoading) {
  els.refreshButton.disabled = isLoading;
}

async function startAuth(platform) {
  const platformDefinition = getPlatformDefinition(platform);
  if (!platformCanAuth(platformDefinition)) {
    state.authSessions.set(platform, {
      status: 'failed',
      message: authUnavailableText(platformDefinition),
    });
    renderPlatformGrid();
    showToast(authUnavailableText(platformDefinition), 'warn');
    return;
  }

  const popup = platformDefinition.authType === 'qrcode'
    ? null
    : window.open('about:blank', `willeai-auth-${platform}`, 'width=760,height=820');
  try {
    const result = await apiWithRetry(`/api/auth/${encodeURIComponent(platform)}`, { method: 'POST' }, {
      retries: 2,
      delayMs: 1400,
    });
    const qrCodeUrl = isDataImageUrl(result.url) ? result.url : '';
    state.authSessions.set(platform, {
      sessionId: result.sessionId,
      status: 'pending',
      requiresSelection: false,
      selectableAccounts: [],
      qrCodeUrl,
      authUrl: qrCodeUrl ? '' : result.url,
      expiresAt: result.expiresAt,
      authInstructions: result.authInstructions || platformDefinition.authInstructions,
    });
    renderPlatformGrid();
    if (qrCodeUrl) {
      if (popup) {
        popup.close();
      }
      showToast('请使用抖音 App 扫码完成账号连接。');
    }
    else if (result.url) {
      if (popup) {
        popup.location.href = result.url;
        showToast('授权窗口已打开，请完成平台授权。');
      }
      else {
        showToast('浏览器拦截了授权窗口，请允许弹窗后重试。', 'warn');
      }
    }
    else {
      showToast('授权已发起，请按平台提示完成连接。');
    }
    pollAuth(platform, result.sessionId);
  }
  catch (error) {
    if (popup) {
      popup.close();
    }
    state.authSessions.set(platform, {
      status: 'failed',
      message: authErrorMessage(error),
    });
    renderPlatformGrid();
    showToast(authErrorMessage(error), 'danger');
  }
}

async function pollAuth(platform, sessionId) {
  let attempts = 0;
  let transientFailures = 0;
  const run = async () => {
    attempts += 1;
    try {
      const result = await api(`/api/auth/${encodeURIComponent(platform)}/status/${encodeURIComponent(sessionId)}`);
      transientFailures = 0;
      const previous = state.authSessions.get(platform) || {};
      state.authSessions.set(platform, {
        ...previous,
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
      if (result.status === 'expired') {
        showToast('授权二维码已过期，请重新连接。', 'warn');
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
      if (error.transient && transientFailures < 8) {
        transientFailures += 1;
        const previous = state.authSessions.get(platform) || {};
        state.authSessions.set(platform, {
          ...previous,
          sessionId,
          status: 'pending',
          message: '平台授权服务暂时不可用，正在自动重试。',
        });
        renderPlatformGrid();
        setTimeout(run, 4000);
        return;
      }
      if (attempts < 4) {
        setTimeout(run, 3000);
        return;
      }
      showToast(authErrorMessage(error), 'danger');
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
      renderPublishTargetPanel();
      renderSelectedTargetsSummary();
      renderPlatformOptions();
      maybeLoadSelectedPlatformOptions();
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
    clearInterval(state.flowTimer);
    state.activeFlowId = '';
    state.activeHandoff = null;
    state.activeHandoffDelivery = null;
    const contentPackage = getContentPackage(preflight);
    const publishAt = els.publishAtInput.value ? new Date(els.publishAtInput.value).toISOString() : new Date().toISOString();
    let flow = null;
    let handoff = null;

    if (preflight.selectedAccounts.length > 0) {
      const payload = {
        ...contentPackage,
        mediaMode: state.mediaMode,
        publishAt,
        accountIds: preflight.selectedAccounts.map(accountId),
        accounts: state.accounts,
        platformOptions: state.platformOptions,
      };
      flow = await api('/api/publish', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      state.activeFlowId = flow.flowId;
      startFlowPolling(flow.flowId);
    }

    if (preflight.selectedBrowserTargets.length > 0) {
      handoff = await api('/api/multipost/handoff', {
        method: 'POST',
        body: JSON.stringify({
          ...contentPackage,
          targets: preflight.selectedBrowserTargets.map(target => target.id),
        }),
      });
      state.activeHandoff = handoff;
      state.activeHandoffDelivery = {
        status: 'browser_waiting_confirm',
        message: '正在发送给 MultiPost 扩展。',
      };
      renderResultBlocks(flow, state.activeHandoff, state.activeHandoffDelivery);
      state.activeHandoffDelivery = await sendHandoffToMultiPost(handoff.syncData);
    }

    renderResultBlocks(flow, state.activeHandoff, state.activeHandoffDelivery);
    setActiveView('publish');
    const message = flow && handoff
      ? '直接发布任务已提交，浏览器辅助内容包已生成。'
      : flow
        ? '直接发布任务已提交。'
        : '浏览器辅助内容包已生成。';
    showToast(message);
  }
  catch (error) {
    const details = formatErrorDetails(error.details);
    const requestId = error.requestId ? `（日志 ID：${error.requestId}）` : '';
    showToast(`${error.message}${details}${requestId}`, 'danger');
  }
  finally {
    els.publishButton.disabled = false;
  }
}

function formatErrorDetails(details) {
  if (!details) {
    return '';
  }
  if (Array.isArray(details)) {
    const first = details.find(Boolean);
    return first ? `：${formatErrorDetailItem(first)}` : '';
  }
  if (typeof details === 'string') {
    return `：${details}`;
  }
  if (typeof details === 'object') {
    if (Array.isArray(details.issues) && details.issues.length > 0) {
      return `：${formatErrorDetailItem(details.issues[0])}`;
    }
    if (Array.isArray(details.errors) && details.errors.length > 0) {
      return `：${formatErrorDetailItem(details.errors[0])}`;
    }
    if (details.message || details.msg || details.error) {
      return `：${details.message || details.msg || details.error}`;
    }
    if (details.code && details.path) {
      return `：${formatErrorDetailItem(details)}`;
    }
  }
  return '';
}

function formatErrorDetailItem(item) {
  if (typeof item === 'string') {
    return item;
  }
  if (!item || typeof item !== 'object') {
    return String(item || '');
  }
  const message = item.message || item.msg || item.error || item.code || '字段校验失败';
  const path = Array.isArray(item.path) ? item.path.join('.') : item.path;
  const params = item.params && typeof item.params === 'object'
    ? Object.entries(item.params).map(([key, value]) => `${key}=${String(value)}`).join(', ')
    : '';
  return [
    message,
    path ? `字段 ${path}` : '',
    params ? `参数 ${params}` : '',
  ].filter(Boolean).join('，');
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
  els.digestInput.value = '';
  els.htmlContentInput.value = '';
  els.markdownContentInput.value = '';
  clearMediaItems();
  els.coverInput.value = '';
  els.tagsInput.value = '';
  els.publishModeInput.value = 'draft';
  state.userActions.clear();
  state.userActionLoading.clear();
  state.activeHandoff = null;
  state.activeHandoffDelivery = null;
  setDefaultPublishTime();
  renderSelectionSurfaces();
  renderFlow(null);
}

function bindEvents() {
  els.refreshButton.addEventListener('click', loadAll);
  els.publishForm.addEventListener('submit', submitPublish);
  els.clearButton.addEventListener('click', clearForm);
  els.clearMediaButton.addEventListener('click', clearMediaItems);
  els.reloadOptionsButton.addEventListener('click', () => {
    maybeLoadSelectedPlatformOptions(true);
    showToast('平台选项已刷新。');
  });
  els.chooseFileButton.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('click', (event) => {
    if (event.target.closest('button')) {
      return;
    }
    els.fileInput.click();
  });
  els.dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      els.fileInput.click();
    }
  });
  els.fileInput.addEventListener('change', () => {
    addMediaFiles(els.fileInput.files || []);
    els.fileInput.value = '';
  });
  for (const eventName of ['dragenter', 'dragover']) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.add('is-dragover');
    });
  }
  for (const eventName of ['dragleave', 'drop']) {
    els.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropZone.classList.remove('is-dragover');
    });
  }
  els.dropZone.addEventListener('drop', (event) => {
    addMediaFiles(event.dataTransfer?.files || []);
  });
  els.mediaQueue.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) {
      return;
    }
    if (target.dataset.action === 'remove-media') {
      removeMediaItem(target.dataset.mediaId);
    }
    if (target.dataset.action === 'retry-media') {
      retryMediaItem(target.dataset.mediaId);
    }
  });

  els.viewTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (trigger.dataset.focusTarget === 'publish-target') {
        goToPublishTarget();
        return;
      }
      setActiveView(trigger.dataset.viewTarget);
    });
  });

  document.addEventListener('click', (event) => {
    const actionTarget = event.target.closest('[data-action]');
    if (actionTarget?.dataset.action === 'go-publish-target') {
      goToPublishTarget();
      return;
    }
    if (actionTarget?.dataset.action === 'select-only-account') {
      setSelectedAccount(actionTarget.dataset.accountId, true);
      return;
    }
    if (actionTarget?.dataset.action === 'copy-handoff') {
      const payload = state.activeHandoff?.syncData ? JSON.stringify(state.activeHandoff.syncData, null, 2) : '';
      if (!payload) {
        showToast('没有可复制的 handoff 数据。', 'warn');
        return;
      }
      window.navigator.clipboard?.writeText(payload)
        .then(() => showToast('已复制 handoff 数据。'))
        .catch(() => showToast('浏览器不允许写入剪贴板，请手动复制文本框内容。', 'warn'));
      return;
    }

    const viewTarget = event.target.closest('[data-view-target]');
    if (!viewTarget || [...els.viewTriggers].includes(viewTarget)) {
      return;
    }
    if (viewTarget.dataset.focusTarget === 'publish-target') {
      goToPublishTarget();
      return;
    }
    setActiveView(viewTarget.dataset.viewTarget);
  });

  for (const input of [
    els.titleInput,
    els.bodyInput,
    els.digestInput,
    els.htmlContentInput,
    els.markdownContentInput,
    els.mediaInput,
    els.coverInput,
    els.tagsInput,
    els.publishModeInput,
    els.publishAtInput,
  ]) {
    input.addEventListener('input', buildPreflight);
    input.addEventListener('change', buildPreflight);
  }

  document.querySelectorAll('[data-content-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      state.contentKind = button.dataset.contentKind;
      document.querySelectorAll('[data-content-kind]').forEach(item => item.classList.toggle('is-active', item === button));
      updateMediaModeUi();
      renderSelectionSurfaces();
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
        setSelectedAccount(target.value, true);
      }
      else {
        setSelectedAccount(target.value, false);
      }
    }
  });

  els.publishTargetPanel?.addEventListener('change', (event) => {
    const target = event.target;
    if (target.dataset.action !== 'select-account') {
      return;
    }
    setSelectedAccount(target.value, target.checked);
  });

  els.browserTargetList?.addEventListener('change', (event) => {
    const target = event.target;
    if (target.dataset.action !== 'select-browser-target') {
      return;
    }
    setBrowserTarget(target.value, target.checked);
  });

  els.platformOptionsList.addEventListener('change', (event) => {
    const target = event.target;
    if (!target.dataset.optionPlatform || !target.dataset.optionField) {
      return;
    }
    updatePlatformOption(target.dataset.optionPlatform, target.dataset.optionField, target.value);
  });

  els.platformOptionsList.addEventListener('input', (event) => {
    const target = event.target;
    if (!target.dataset.optionPlatform || !target.dataset.optionField) {
      return;
    }
    updatePlatformOption(target.dataset.optionPlatform, target.dataset.optionField, target.value, false);
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
updateMediaModeUi();
renderMediaQueue();
renderPlatformOptions();
bindEvents();
setActiveView('overview');
buildPreflight();
loadAll();
