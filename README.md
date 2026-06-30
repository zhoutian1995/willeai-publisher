# WilleAI Publish Studio

独立部署在 `publish.willeai.cn` 的一键发布工作台。浏览器只访问本服务，`AITOEARN_API_KEY` 只放服务器 `.env`，所有 AiToEarn OpenAPI 请求由 `server.js` 代理。

## 功能范围

- 获取平台能力：`GET v2/channels/platforms`
- 获取账号列表：`GET v2/channels/accounts`
- 发起账号授权：`GET v2/channels/accounts/auth/:platform`
- 查询授权状态：`GET v2/channels/accounts/auth/:platform/status/:sessionId`
- 获取资产上传签名：`POST assets/uploadSign`
- 确认资产上传：`POST assets/:assetId/confirm`
- 创建发布 Flow：`POST v2/channels/publish/flows`
- 查询发布 Flow：`GET v2/channels/publish/flows/:flowId`

内容页支持本地素材上传和手动 HTTPS URL 两种入口。浏览器先通过本服务获取上传签名，再把文件直传到对象存储，确认成功后把最终 HTTPS URL 写入素材队列并参与预检和发布。视频模式一次提交 1 个视频素材；图文模式支持多张图片。发布前必须选择至少一个已连接账号。

## 本地运行

```bash
cp .env.example .env
node server.js
```

访问 `http://127.0.0.1:3200`。

## 自动部署

代码推送到 `main` 后，GitHub Actions 会自动：

1. 运行 `node --check server.js` 和 `node --check public/app.js`
2. 如果配置了 `SSH_PRIVATE_KEY`，通过 SSH 上传代码到 `/home/admin/project/willeai-publisher`
3. 写入服务器 `.env`
4. 用 PM2 启动或重载 `willeai-publisher`
5. 写入 `publish.willeai.cn` 的 Nginx 反代配置并 reload

必需 GitHub Secrets：

```text
SSH_PRIVATE_KEY=<可登录服务器的私钥>
AITOEARN_API_KEY=<匹配 aitoearn.cn 的 OpenAPI Key>
```

服务器地址、用户名、上游地址和公开域名写在 workflow 中。`AITOEARN_API_KEY` 没有配置时，域名仍可打开，但工作台会显示“缺少 API Key”，不能拉取平台、账号或发布。

如果 GitHub token 暂时没有写 Actions Secrets 的权限，服务器上的 `willeai-publisher-deployer` PM2 进程会每 60 秒轮询 GitHub `main`，发现新提交后自动拉取、校验、同步、重启应用并 reload Nginx。

## 手动服务器部署

目标目录：

```bash
/home/admin/project/willeai-publisher
```

`.env` 示例：

```bash
PORT=3200
HOST=127.0.0.1
AITOEARN_BASE_URL=https://aitoearn.cn
AITOEARN_API_KEY=replace-with-cn-api-key
PUBLIC_ORIGIN=https://publish.willeai.cn
```

环境必须匹配：

- 中国版 API Key 搭配 `https://aitoearn.cn`
- 国际版 API Key 搭配 `https://aitoearn.ai`

PM2：

```bash
pm2 start server.js --name willeai-publisher
pm2 save
```

Nginx：

```nginx
server {
  listen 443 ssl http2;
  server_name publish.willeai.cn;

  location / {
    proxy_pass http://127.0.0.1:3200;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## 验证

```bash
node --check server.js
curl http://127.0.0.1:3200/api/health
```

`apiKeyConfigured` 必须为 `true` 后，平台、账号、授权和发布代理才可用。
