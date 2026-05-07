# AI API Tester

一个轻量级的 AI API 测试工具 — 验证你的 API Key、Base URL 和模型可用性。

**在线体验：** https://ai-api-tester.pages.dev

[English](./README_EN.md)

## 功能

- OpenAI Chat API (`/v1/chat/completions`)
- OpenAI Responses API (`/v1/responses`)
- Anthropic Messages API (`/v1/messages`)
- 模型列表获取 (`/v1/models`)
- 批量模型测试
- cURL 命令导出
- 浏览器本地配置档案（localStorage）
- Stream 模式支持（SSE 解析）
- 响应时间、状态码、提取文本展示

## 快速开始

### 方式一：在线使用（无需安装）

访问 https://ai-api-tester.pages.dev

### 方式二：桌面应用（Windows）

从 [Releases](../../releases) 下载 `.exe`，双击即可运行，无需安装。

### 方式三：本地服务器

```bash
npm install
npm start
# 打开 http://localhost:3210
```

### 方式四：Docker

```bash
docker build -t ai-api-tester .
docker run -d --name ai-api-tester -p 3210:3210 ai-api-tester
```

或使用 Docker Compose：

```bash
docker compose up --build -d
```

### 方式五：部署到 Cloudflare Pages（免费）

```bash
npm install -g wrangler
wrangler login
wrangler pages project create ai-api-tester --production-branch main
npm run deploy
```

后续更新只需 `npm run deploy`。

### 方式六：Electron 开发模式

```bash
npm install
npm run electron
```

## 安全

- **无服务端存储** — API Key 和 Prompt 仅在请求处理期间存在于内存中。
- 服务端仅作代理，不记录或缓存任何内容。
- 保存的配置存储在浏览器 localStorage，不在服务器上。
- 内置速率限制（30 请求/IP/分钟），适用于自托管部署。
- 公开部署建议添加认证层。

## 项目结构

```
public/            — 前端（HTML/CSS/JS）
functions/         — Cloudflare Pages Functions（无服务器 API）
app-core.mjs       — Express 版 API（Node.js/Docker/Electron）
server.mjs         — 独立 Node.js 服务入口
electron-main.js   — Electron 主进程
wrangler.toml      — Cloudflare Pages 配置
```

## License

MIT
