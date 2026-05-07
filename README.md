# AI API Tester

一个轻量本地 Web 平台，用来测试不同 AI 提供商/中转平台的 API Key、Base URL、模型名是否可用。

## 已支持

- OpenAI Chat API (`/v1/chat/completions`)
- OpenAI Responses API (`/v1/responses`)
- Anthropic Messages API (`/v1/messages`)
- 模型列表获取 (`/v1/models`，取决于服务端是否支持)
- 批量模型测试
- cURL 导出
- 浏览器本地配置档案

## 功能

- 自定义 Base URL
- 自定义 API Key
- 自定义 Model
- 自定义 Prompt
- 可选 `stream` 参数测试
- 展示耗时、状态码、提取后的文本、原始响应
- 保存当前配置到浏览器 localStorage
- 保存多个配置档案
- 复制单次测试对应的 cURL 命令
- 批量测试多个模型

## 启动

### Windows

1. 安装 Node.js 18+（建议直接装最新版 LTS）
2. 双击 `start.bat`
3. 浏览器打开 `http://localhost:3210`

如果要打包 Electron Windows 安装包：

```bash
npm install
npm run dist:win
```

### 本地运行

```bash
cd ai-api-tester
npm install
npm start
```

默认监听：

```bash
http://localhost:3210
```

### Docker

当前这台机器没有安装 Compose 插件/`docker-compose`，所以先用纯 `docker` 命令最稳。

```bash
cd ai-api-tester
docker build -t ai-api-tester .
docker rm -f ai-api-tester 2>/dev/null || true
docker run -d \
  --name ai-api-tester \
  --restart unless-stopped \
  -p 3210:3210 \
  -e HOST=0.0.0.0 \
  -e PORT=3210 \
  ai-api-tester
```

查看状态：

```bash
docker ps | grep ai-api-tester
docker logs -f ai-api-tester
```

停止/重启：

```bash
docker stop ai-api-tester
docker start ai-api-tester
docker restart ai-api-tester
```

项目里也附带了 `docker-compose.yml`，如果后续机器装了 Compose，可以直接用：

```bash
docker compose up --build -d
# 或老版本
docker-compose up --build -d
```

## 安全说明

- **服务端不存储任何数据**：API Key、Base URL、Prompt 等所有参数仅在请求处理期间存在于内存中，用完即丢，不会写入磁盘、日志或数据库。
- 服务端仅做请求转发（proxy），不记录、不缓存任何用户输入或 API 响应内容。
- 如果你勾选”保存当前配置到本地”或保存档案，数据会存到**浏览器 localStorage**，与服务端无关。
- 内置 Rate Limiting（每 IP 每分钟 30 次），防止滥用。
- 建议本地使用或部署在私有网络中；如需公网部署，请自行添加认证层。
- 某些 Anthropic 兼容平台不一定支持 `/v1/models`。
- 部分 OpenAI 兼容平台虽然支持 Chat API，但未必支持 Responses API。
- `stream=true` 会正确解析 SSE 流式响应并拼接完整文本，但前端不做逐字展示。

## 后续还可扩展

- 实时流式响应可视化
- 多提供商预设模板
- 登录鉴权
- 服务端加密保存配置
- 批量导出报告
