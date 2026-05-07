# AI API Tester

一个用于测试 AI API Key / Base URL / Model 的桌面工具。

支持：
- OpenAI Chat API
- OpenAI Responses API
- Anthropic Messages API
- 模型列表获取
- 批量模型测试
- cURL 导出
- 本地配置档案

## 使用方式

### 方式一：直接下载运行（推荐）

从 [Releases](../../releases) 下载 `AI API Tester x.x.x.exe`，双击即可运行，无需安装。

### 方式二：开发运行

```bash
npm install
npm run electron
```

### 方式三：纯 Web 模式

```bash
npm install
npm start
```

然后浏览器打开 http://localhost:3210

### 方式四：Docker

```bash
docker compose up
```

## 打包

生成 Windows 绿色版（portable）：

```bash
npm install
npm run dist:win
```

产物在 `dist/AI API Tester x.x.x.exe`。

## 项目结构

- `electron-main.js` — Electron 主进程
- `electron-dev.js` — 开发启动器（处理环境变量兼容）
- `app-core.mjs` — 服务核心逻辑
- `server.mjs` — 独立 Node.js 服务入口
- `public/` — 前端页面
- `electron-builder.yml` — 打包配置
