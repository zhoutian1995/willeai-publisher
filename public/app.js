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
  mediaItems: [],
  mediaMode: 'video',
  nextMediaId: 1,
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
  mediaHelp: document.querySelector('#mediaHelp'),
  fileInput: document.querySelector('#fileInput'),
  dropZone: document.querySelector('#dropZone'),
  dropZoneHint: document.querySelector('#dropZoneHint'),
  chooseFileButton: document.querySelector('#chooseFileButton'),
  clearMediaButton: document.querySelector('#clearMediaButton'),
  mediaQueue: document.querySelector('#mediaQueue'),
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
    const statusTone = connected.length > 0 ? 'ok' : abnormal > 0 ? 'warn' : 'danger';
    const statusText = connected.length > 0
      ? `${connected.length} 个已连接`
      : abnormal > 0
        ? '需重新授权'
        : '未连接';
    const canAuth = platformCanAuth(platform);
    const canPublish = platformCanPublish(platform);

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
  if (connected.length === 0) {
    if (!platformCanAuth(platform)) {
      return `<p class="account-note">${escapeHtml(authUnavailableText(platform))}</p>`;
    }
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

  const imageFiles = list.filter(file => getMediaKind(file) === 'image');
  if (imageFiles.length !== list.length) {
    showToast('图文模式只接受图片文件，已忽略其它文件。', 'warn');
  }
  return imageFiles;
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
  const isVideo = state.mediaMode === 'video';
  els.mediaLabel.textContent = isVideo ? '视频素材' : '图文素材';
  els.mediaHelp.textContent = isVideo
    ? '拖入本地视频或选择文件，上传成功后自动加入队列。'
    : '拖入本地图片或选择文件，上传成功后自动加入队列。';
  els.dropZoneHint.textContent = isVideo
    ? '视频模式一次只接受 1 个视频文件。'
    : '图文模式支持一次选择多张图片。';
  els.fileInput.accept = isVideo ? 'video/*' : 'image/*';
  els.fileInput.multiple = !isVideo;
  els.mediaInput.placeholder = isVideo
    ? '每行粘贴一个公开视频链接，必须以 https:// 开头'
    : '每行粘贴一个公开图片链接，必须以 https:// 开头';
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
  const selectedAccounts = state.accounts.filter(account => state.selectedAccountIds.has(account.id));
  const mediaUrls = getMediaUrls();
  const title = els.titleInput.value.trim();
  const body = els.bodyInput.value.trim();
  const cover = els.coverInput.value.trim();
  const uploadingCount = state.mediaItems.filter(item => ['uploading', 'confirming'].includes(item.status)).length;
  const failedCount = state.mediaItems.filter(item => item.status === 'error').length;
  const uploadedItems = state.mediaItems.filter(item => item.status === 'success');
  const issues = [];

  const checks = [
    {
      ok: selectedAccounts.length > 0,
      text: selectedAccounts.length > 0 ? `已选择 ${selectedAccounts.length} 个目标` : '还没有选择发布账号',
    },
    {
      ok: title.length > 0 || body.length > 0,
      text: title.length > 0 || body.length > 0 ? '标题或正文已填写' : '标题和正文至少填写一项',
    },
    {
      ok: mediaUrls.length > 0,
      text: mediaUrls.length > 0 ? `已有 ${mediaUrls.length} 个可用素材链接` : '还没有可用素材',
    },
    {
      ok: uploadingCount === 0,
      text: uploadingCount === 0 ? '没有等待上传的文件' : `等待 ${uploadingCount} 个素材上传完成`,
    },
    {
      ok: state.mediaMode !== 'video' || mediaUrls.length <= 1,
      text: state.mediaMode !== 'video' || mediaUrls.length <= 1 ? '素材数量符合当前模式' : '视频模式只保留 1 个素材',
    },
    {
      ok: uploadedItems.every(item => state.mediaMode === 'video' ? item.kind === 'video' : item.kind === 'image'),
      text: uploadedItems.every(item => state.mediaMode === 'video' ? item.kind === 'video' : item.kind === 'image')
        ? '上传素材类型符合当前模式'
        : state.mediaMode === 'video'
          ? '视频模式只允许视频文件'
          : '图文模式只允许图片文件',
    },
    {
      ok: mediaUrls.every(isHttpsUrl) && (!cover || isHttpsUrl(cover)),
      text: '素材和封面链接必须以 https:// 开头',
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

  const xhsSelected = selectedAccounts.some(account => account.type === 'xhs');
  if (xhsSelected) {
    checks.push({
      ok: false,
      warn: true,
      text: '小红书目标已选择，发布后请单独复核结果',
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

  updateOverviewSignals({ hasAccounts, hasContent, hasMedia, isReady, normalCount, selectedCount: selectedAccounts.length, mediaCount: mediaUrls.length });
}

function updateOverviewSignals(summary) {
  const activeFlow = Boolean(state.activeFlowId);
  const next = !summary.hasAccounts
    ? {
      title: '先选择目标',
      text: summary.normalCount > 0 ? '勾选本次要同步的平台账号。' : '先连接至少一个可用平台账号。',
      view: 'accounts',
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
          : activeFlow
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
    els.submitSignal.textContent = activeFlow ? '任务已提交' : summary.isReady ? '等待提交' : '尚未提交任务';
    els.submitSignal.classList.toggle('is-ok', activeFlow);
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

function renderFlow(flow) {
  if (!flow || !flow.flowId) {
    state.activeFlowId = '';
    els.flowMeta.textContent = '未提交';
    els.flowBox.innerHTML = '<p class="empty-state">选择目标并准备素材后，任务结果会显示在这里。</p>';
    updateOverview();
    return;
  }

  state.activeFlowId = flow.flowId;
  els.flowMeta.textContent = '已提交';
  const tasks = Array.isArray(flow.tasks) ? flow.tasks : [];
  els.flowBox.innerHTML = `
    <div class="flow-summary">
      <strong>任务已创建</strong>
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
    setActiveView('publish');
    showToast('发布任务已提交。');
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
  clearMediaItems();
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
  els.clearMediaButton.addEventListener('click', clearMediaItems);
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
      setActiveView(trigger.dataset.viewTarget);
    });
  });

  for (const input of [els.titleInput, els.bodyInput, els.mediaInput, els.coverInput, els.publishAtInput]) {
    input.addEventListener('input', buildPreflight);
  }

  document.querySelectorAll('[data-media-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.mediaMode = button.dataset.mediaMode;
      document.querySelectorAll('[data-media-mode]').forEach(item => item.classList.toggle('is-active', item === button));
      updateMediaModeUi();
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
updateMediaModeUi();
renderMediaQueue();
bindEvents();
setActiveView('overview');
buildPreflight();
loadAll();
