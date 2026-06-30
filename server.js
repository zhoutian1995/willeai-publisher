import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
loadEnvFile(join(__dirname, '.env'));

const publicDir = join(__dirname, 'public');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3200);
const baseUrl = normalizeBaseUrl(process.env.AITOEARN_BASE_URL || 'https://aitoearn.cn');
const apiKey = process.env.AITOEARN_API_KEY || '';
const publicOrigin = normalizeBaseUrl(process.env.PUBLIC_ORIGIN || 'https://publish.willeai.cn');
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 25000);
const assetIdPattern = /^[A-Za-z0-9_-]{8,128}$/;
const avatarHostSuffixes = [
  '.hdslb.com',
  '.qlogo.cn',
  '.douyinpic.com',
  '.douyinstatic.com',
  '.byteimg.com',
];

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function loadEnvFile(pathname) {
  if (!existsSync(pathname)) {
    return;
  }

  const raw = readFileSync(pathname, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function normalizeBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

function apiBaseUrl() {
  return baseUrl.endsWith('/api') ? baseUrl : `${baseUrl}/api`;
}

function isHttpsUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return false;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:';
  }
  catch {
    return false;
  }
}

function isAllowedAvatarUrl(value) {
  if (!isHttpsUrl(value)) {
    return false;
  }
  const url = new URL(value.trim());
  return avatarHostSuffixes.some(suffix => url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix));
}

async function proxyAvatar(res, sourceUrl) {
  if (!isAllowedAvatarUrl(sourceUrl)) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Avatar URL is not allowed');
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 WilleAI-Publisher/0.1',
        'Referer': new URL(sourceUrl).origin,
      },
      signal: controller.signal,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) {
      res.writeHead(response.ok ? 415 : response.status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end('Avatar image unavailable');
      return;
    }
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 5 * 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Avatar image is too large');
      return;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) {
      res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('Avatar image is too large');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buffer);
  }
  catch (error) {
    const statusCode = error.name === 'AbortError' ? 504 : 502;
    res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Avatar image unavailable');
  }
  finally {
    clearTimeout(timer);
  }
}

function json(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, { ...jsonHeaders, ...extraHeaders });
  res.end(JSON.stringify(payload));
}

function ok(res, data, extraHeaders) {
  json(res, 200, { ok: true, data }, extraHeaders);
}

function fail(res, statusCode, message, details) {
  json(res, statusCode, { ok: false, message, details });
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1024 * 1024) {
      throw Object.assign(new Error('请求体过大'), { statusCode: 413 });
    }
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  }
  catch {
    throw Object.assign(new Error('请求体不是有效 JSON'), { statusCode: 400 });
  }
}

function ensureApiKey() {
  if (!apiKey) {
    throw Object.assign(new Error('服务端缺少 AITOEARN_API_KEY，无法请求 AiToEarn OpenAPI'), { statusCode: 500 });
  }
}

function getForwardedCookie(req) {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return '';
  }
  return cookie
    .split(';')
    .map(item => item.trim())
    .filter(item => item.startsWith('_cas='))
    .join('; ');
}

function buildUrl(pathname, searchParams) {
  const url = new URL(`${apiBaseUrl()}${pathname}`);
  if (searchParams) {
    for (const [key, value] of searchParams.entries()) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function upstream(req, pathname, options = {}) {
  ensureApiKey();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = {
    'Accept': 'application/json',
    'Accept-Language': 'zh-CN',
    'X-Api-Key': apiKey,
    ...options.headers,
  };
  const cookie = options.forwardCookie ? getForwardedCookie(req) : '';
  if (cookie) {
    headers.Cookie = cookie;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(buildUrl(pathname, options.searchParams), {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      redirect: 'manual',
    });
    const contentType = response.headers.get('content-type') || '';
    const setCookie = response.headers.getSetCookie?.()
      || (response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : []);
    const text = await response.text();
    let payload = text;

    if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        payload = JSON.parse(text);
      }
      catch {
        payload = text;
      }
    }

    if (!response.ok) {
      throw Object.assign(new Error(getUpstreamMessage(payload) || `AiToEarn 请求失败：${response.status}`), {
        statusCode: response.status,
        upstream: summarizeUpstreamPayload(payload),
      });
    }

    return { data: unwrapOpenApi(payload), setCookie };
  }
  catch (error) {
    if (error.name === 'AbortError') {
      throw Object.assign(new Error('AiToEarn 请求超时'), { statusCode: 504 });
    }
    throw error;
  }
  finally {
    clearTimeout(timer);
  }
}

function unwrapOpenApi(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload) && 'code' in payload) {
    if (payload.code !== 0) {
      throw Object.assign(new Error(payload.message || payload.msg || 'AiToEarn 返回业务错误'), {
        statusCode: 502,
        upstream: payload,
      });
    }
    return payload.data;
  }
  return payload;
}

function getUpstreamMessage(payload) {
  if (payload && typeof payload === 'object') {
    return payload.message || payload.msg || payload.error;
  }
  if (typeof payload === 'string') {
    if (isHtmlPayload(payload)) {
      return /502 Bad Gateway/i.test(payload)
        ? 'AiToEarn 授权服务暂时不可用，请稍后重试'
        : 'AiToEarn 返回了非 JSON 响应，请稍后重试';
    }
    return payload.slice(0, 300);
  }
  return '';
}

function isHtmlPayload(payload) {
  return typeof payload === 'string' && /<!doctype html|<html[\s>]|<title>/i.test(payload);
}

function summarizeUpstreamPayload(payload) {
  if (typeof payload !== 'string') {
    return payload;
  }
  if (!isHtmlPayload(payload)) {
    return payload.slice(0, 500);
  }
  const title = payload.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  return {
    type: 'html',
    title: title || 'HTML response',
  };
}

function normalizeAccounts(data) {
  if (Array.isArray(data)) {
    return { total: data.length, list: data };
  }
  if (data && typeof data === 'object') {
    const list = Array.isArray(data.list) ? data.list : [];
    return { total: Number(data.total ?? list.length), list };
  }
  return { total: 0, list: [] };
}

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parsePositiveInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
  }
  return 0;
}

function parseEnumNumber(value, allowed, fallback) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value.trim())
      : fallback;
  return allowed.includes(parsed) ? parsed : fallback;
}

function cleanOptionText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function buildPlatformOption(platform, rawOption, errors) {
  const raw = asPlainObject(rawOption);
  if (platform === 'bilibili') {
    const tid = parsePositiveInteger(raw.tid) || 21;
    const copyright = parseEnumNumber(raw.copyright, [1, 2], 1);
    const source = cleanOptionText(raw.source, 200);
    const option = {
      tid,
      copyright,
      no_reprint: parseEnumNumber(raw.no_reprint, [0, 1], 1),
    };
    if (copyright === 2) {
      if (!source) {
        errors.push('Bilibili 转载发布需要填写转载来源');
      }
      else {
        option.source = source;
      }
    }
    return option;
  }

  if (platform === 'douyin') {
    const option = {
      private_status: parseEnumNumber(raw.private_status, [0, 1, 2], 0),
      download_type: parseEnumNumber(raw.download_type, [1, 2], 1),
    };
    const shortTitle = cleanOptionText(raw.short_title, 12);
    if (shortTitle) {
      option.short_title = shortTitle;
    }
    return option;
  }

  if (platform === 'wxSph') {
    const workId = cleanOptionText(raw.workId, 200);
    const workLink = cleanOptionText(raw.workLink, 500);
    if (!workId && !workLink) {
      errors.push('微信视频号需要先通过插件生成作品 ID 或填写作品链接');
      return undefined;
    }
    return {
      ...(workId ? { workId } : {}),
      ...(workLink ? { workLink } : {}),
      ...(raw.linkStatus === 'pending' || raw.linkStatus === 'ready' || raw.linkStatus === 'failed'
        ? { linkStatus: raw.linkStatus }
        : workId && !workLink
          ? { linkStatus: 'pending' }
          : {}),
    };
  }

  if (platform === 'xhs') {
    const workLink = cleanOptionText(raw.workLink, 500);
    if (!workLink) {
      errors.push('小红书当前需要填写已发布作品链接');
      return undefined;
    }
    return { workLink };
  }

  if (platform === 'KWAI') {
    const option = {};
    const stereoType = cleanOptionText(raw.stereo_type, 100);
    const merchantProductId = cleanOptionText(raw.merchant_product_id, 100);
    if (stereoType) {
      option.stereo_type = stereoType;
    }
    if (merchantProductId) {
      option.merchant_product_id = merchantProductId;
    }
    return Object.keys(option).length > 0 ? option : undefined;
  }

  return undefined;
}

function validatePublishPayload(body) {
  const errors = [];
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim() : '';
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  const coverUrl = typeof body.coverUrl === 'string' ? body.coverUrl.trim() : '';
  const mediaMode = body.mediaMode === 'images' ? 'images' : 'video';
  const accountIds = Array.isArray(body.accountIds)
    ? body.accountIds.map(value => String(value || '').trim()).filter(Boolean)
    : [];
  const accounts = Array.isArray(body.accounts) ? body.accounts : [];
  const platformOptions = asPlainObject(body.platformOptions);

  if (!title && !bodyText) {
    errors.push('标题和正文至少填写一项');
  }
  if (accountIds.length === 0) {
    errors.push('至少选择一个已授权账号');
  }
  if (mediaUrls.length === 0) {
    errors.push('请至少上传一个素材或填写一个备用素材链接');
  }
  if (mediaMode === 'video' && mediaUrls.length > 1) {
    errors.push('视频模式一次只提交一个素材');
  }
  for (const url of mediaUrls) {
    if (!isHttpsUrl(url)) {
      errors.push(`素材链接必须以 https:// 开头：${url}`);
    }
  }
  if (coverUrl && !isHttpsUrl(coverUrl)) {
    errors.push(`封面链接必须以 https:// 开头：${coverUrl}`);
  }

  const accountMap = new Map();
  for (const account of accounts) {
    if (account && typeof account === 'object' && account.id && account.type) {
      accountMap.set(String(account.id), String(account.type));
    }
  }

  const items = accountIds.map((accountId) => {
    const platform = accountMap.get(accountId);
    if (!platform) {
      errors.push(`找不到账号对应平台：${accountId}`);
      return null;
    }
    const option = buildPlatformOption(platform, platformOptions[platform], errors);
    return option ? { accountId, platform, option } : { accountId, platform };
  }).filter(Boolean);

  const publishAt = body.publishAt ? new Date(body.publishAt) : new Date();
  if (Number.isNaN(publishAt.getTime())) {
    errors.push('发布时间不是有效日期');
  }

  if (errors.length > 0) {
    throw Object.assign(new Error('发布预检未通过'), { statusCode: 400, details: errors });
  }

  const flowId = `willeai-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const type = mediaMode === 'video'
    ? 'video'
    : mediaUrls.length === 1 && looksLikeVideoUrl(mediaUrls[0])
      ? 'video'
      : 'article';

  return {
    flowId,
    content: {
      title,
      body: bodyText,
      media: mediaUrls.map(url => ({ url })),
      ...(coverUrl ? { cover: { url: coverUrl } } : {}),
    },
    publishAt: publishAt.toISOString(),
    context: {
      source: 'api',
      type,
      ...(type === 'video' ? { videoUrl: mediaUrls[0] } : { imgUrlList: mediaUrls }),
    },
    items,
  };
}

function looksLikeVideoUrl(value) {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(value);
}

function validateUploadSignPayload(body) {
  const filename = typeof body.filename === 'string' ? body.filename.trim() : '';
  const size = Number(body.size || 0);
  const mediaKind = body.mediaKind === 'image' ? 'image' : body.mediaKind === 'video' ? 'video' : '';

  if (!filename || filename.length > 240 || filename.includes('/') || filename.includes('\\')) {
    throw Object.assign(new Error('文件名无效'), { statusCode: 400 });
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw Object.assign(new Error('文件大小无效'), { statusCode: 400 });
  }
  if (size > 1024 * 1024 * 1024) {
    throw Object.assign(new Error('单个文件不能超过 1GB'), { statusCode: 400 });
  }
  if (!mediaKind) {
    throw Object.assign(new Error('素材类型无效'), { statusCode: 400 });
  }

  return {
    filename,
    size,
    type: 'userMedia',
  };
}

function getAuthRedirectUri() {
  return `${publicOrigin}/auth/callback`;
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname === '/api/health' && req.method === 'GET') {
      ok(res, {
        service: 'willeai-publisher',
        upstream: baseUrl,
        apiKeyConfigured: Boolean(apiKey),
        publicOrigin,
      });
      return;
    }

    if (url.pathname === '/api/platforms' && req.method === 'GET') {
      const result = await upstream(req, '/v2/channels/platforms');
      ok(res, result.data);
      return;
    }

    if (url.pathname === '/api/accounts' && req.method === 'GET') {
      const result = await upstream(req, '/v2/channels/accounts');
      ok(res, normalizeAccounts(result.data));
      return;
    }

    const publishOptionValuesMatch = url.pathname.match(/^\/api\/accounts\/([^/]+)\/publish-options\/([^/]+)\/values$/);
    if (publishOptionValuesMatch && req.method === 'GET') {
      const accountId = decodeURIComponent(publishOptionValuesMatch[1]);
      const field = decodeURIComponent(publishOptionValuesMatch[2]);
      if (!accountId || !/^[A-Za-z0-9_-]+$/.test(field)) {
        fail(res, 400, '发布选项参数无效');
        return;
      }
      const result = await upstream(req, `/v2/channels/accounts/${encodeURIComponent(accountId)}/publish-options/${encodeURIComponent(field)}/values`);
      ok(res, result.data);
      return;
    }

    if (url.pathname === '/api/avatar' && req.method === 'GET') {
      await proxyAvatar(res, url.searchParams.get('url') || '');
      return;
    }

    if (url.pathname === '/api/assets/upload-sign' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const payload = validateUploadSignPayload(body);
      const result = await upstream(req, '/assets/uploadSign', {
        method: 'POST',
        body: payload,
      });
      ok(res, result.data);
      return;
    }

    const assetConfirmMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/confirm$/);
    if (assetConfirmMatch && req.method === 'POST') {
      const assetId = decodeURIComponent(assetConfirmMatch[1]);
      if (!assetIdPattern.test(assetId)) {
        fail(res, 400, '资产 ID 无效');
        return;
      }
      const result = await upstream(req, `/assets/${encodeURIComponent(assetId)}/confirm`, {
        method: 'POST',
        body: { id: assetId },
      });
      ok(res, result.data);
      return;
    }

    const authStartMatch = url.pathname.match(/^\/api\/auth\/([^/]+)$/);
    if (authStartMatch && req.method === 'POST') {
      const platform = decodeURIComponent(authStartMatch[1]);
      const searchParams = new URLSearchParams({
        redirectUri: getAuthRedirectUri(),
      });
      const result = await upstream(req, `/v2/channels/accounts/auth/${encodeURIComponent(platform)}`, {
        searchParams,
      });
      ok(res, result.data, result.setCookie.length > 0 ? { 'Set-Cookie': result.setCookie } : {});
      return;
    }

    const authStatusMatch = url.pathname.match(/^\/api\/auth\/([^/]+)\/status\/([^/]+)$/);
    if (authStatusMatch && req.method === 'GET') {
      const platform = decodeURIComponent(authStatusMatch[1]);
      const sessionId = decodeURIComponent(authStatusMatch[2]);
      const result = await upstream(req, `/v2/channels/accounts/auth/${encodeURIComponent(platform)}/status/${encodeURIComponent(sessionId)}`);
      ok(res, result.data);
      return;
    }

    const authSelectMatch = url.pathname.match(/^\/api\/auth\/([^/]+)\/select\/([^/]+)$/);
    if (authSelectMatch && req.method === 'POST') {
      ensureApiKey();
      const platform = decodeURIComponent(authSelectMatch[1]);
      const sessionId = decodeURIComponent(authSelectMatch[2]);
      const body = await readJsonBody(req);
      const accounts = Array.isArray(body.accounts) ? body.accounts : [];
      if (accounts.length === 0) {
        fail(res, 400, '请至少选择一个账号');
        return;
      }
      const cookie = `_cas=${encodeURIComponent(sessionId)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response;
      try {
        response = await fetch(buildUrl('/v2/channels/accounts/auth/selections'), {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Api-Key': apiKey,
            'Cookie': cookie,
          },
          body: JSON.stringify({ accounts }),
          redirect: 'manual',
          signal: controller.signal,
        });
      }
      catch (error) {
        if (error.name === 'AbortError') {
          fail(res, 504, '账号选择提交超时');
          return;
        }
        throw error;
      }
      finally {
        clearTimeout(timer);
      }
      const text = await response.text();
      if (!response.ok) {
        fail(res, response.status, `账号选择提交失败：${platform}`, text.slice(0, 500));
        return;
      }
      const status = await upstream(req, `/v2/channels/accounts/auth/${encodeURIComponent(platform)}/status/${encodeURIComponent(sessionId)}`);
      ok(res, status.data);
      return;
    }

    if (url.pathname === '/api/publish' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const payload = validatePublishPayload(body);
      const result = await upstream(req, '/v2/channels/publish/flows', {
        method: 'POST',
        body: payload,
      });
      ok(res, result.data);
      return;
    }

    const flowMatch = url.pathname.match(/^\/api\/flows\/([^/]+)$/);
    if (flowMatch && req.method === 'GET') {
      const flowId = decodeURIComponent(flowMatch[1]);
      const result = await upstream(req, `/v2/channels/publish/flows/${encodeURIComponent(flowId)}`);
      ok(res, result.data);
      return;
    }

    const userActionMatch = url.pathname.match(/^\/api\/publish-records\/([^/]+)\/user-action$/);
    if (userActionMatch && req.method === 'GET') {
      const recordId = decodeURIComponent(userActionMatch[1]);
      const result = await upstream(req, `/v2/channels/publish/records/${encodeURIComponent(recordId)}/user-action`);
      ok(res, result.data);
      return;
    }

    fail(res, 404, '未找到 API 路由');
  }
  catch (error) {
    const statusCode = Number(error.statusCode || 500);
    fail(res, statusCode, error.message || '服务端错误', error.details || error.upstream);
  }
}

async function serveStatic(req, res, url) {
  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const fullPath = join(publicDir, safePath);

  if (!fullPath.startsWith(publicDir) || !existsSync(fullPath)) {
    if (extname(pathname)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const fallback = join(publicDir, 'index.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    createReadStream(fallback).pipe(res);
    return;
  }

  const ext = extname(fullPath);
  res.writeHead(200, {
    'Content-Type': mimeTypes.get(ext) || 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
  });
  createReadStream(fullPath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname.startsWith('/api/')) {
    await handleApi(req, res, url);
    return;
  }

  if (url.pathname === '/auth/callback') {
    const html = await readFile(join(publicDir, 'auth-callback.html'), 'utf8');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(html);
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(port, host, () => {
  console.log(`WilleAI Publisher listening on http://${host}:${port}`);
});
