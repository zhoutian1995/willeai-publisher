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
        upstream: payload,
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
  return typeof payload === 'string' ? payload.slice(0, 300) : '';
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

  if (!title && !bodyText) {
    errors.push('标题和正文至少填写一项');
  }
  if (accountIds.length === 0) {
    errors.push('至少选择一个已授权账号');
  }
  if (mediaUrls.length === 0) {
    errors.push('至少填写一个公开视频或图片 HTTPS URL');
  }
  if (mediaMode === 'video' && mediaUrls.length > 1) {
    errors.push('视频模式一次提交一个视频 URL');
  }
  for (const url of mediaUrls) {
    if (!isHttpsUrl(url)) {
      errors.push(`素材 URL 必须是 HTTPS：${url}`);
    }
  }
  if (coverUrl && !isHttpsUrl(coverUrl)) {
    errors.push(`封面 URL 必须是 HTTPS：${coverUrl}`);
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
    return { accountId, platform };
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
