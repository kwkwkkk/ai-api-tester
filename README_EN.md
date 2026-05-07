# AI API Tester

A lightweight tool for testing AI API endpoints — verify your API Key, Base URL, and Model availability across providers.

**Live Demo:** https://ai-api-tester.pages.dev

[中文](./README.md)

## Features

- OpenAI Chat API (`/v1/chat/completions`)
- OpenAI Responses API (`/v1/responses`)
- Anthropic Messages API (`/v1/messages`)
- Model list fetching (`/v1/models`)
- Batch model testing
- cURL command export
- Browser-local config profiles (localStorage)
- Stream mode support with SSE parsing
- Response time, status code, and extracted text display

## Quick Start

### Option 1: Use Online (No Install)

Visit https://ai-api-tester.pages.dev

### Option 2: Desktop App (Windows)

Download the portable `.exe` from [Releases](../../releases) — double-click to run.

### Option 3: Local Server

```bash
npm install
npm start
# Open http://localhost:3210
```

### Option 4: Docker

```bash
docker build -t ai-api-tester .
docker run -d --name ai-api-tester -p 3210:3210 ai-api-tester
```

Or with Docker Compose:

```bash
docker compose up --build -d
```

### Option 5: Deploy to Cloudflare Pages (Free)

```bash
npm install -g wrangler
wrangler login
wrangler pages project create ai-api-tester --production-branch main
npm run deploy
```

Redeploy after changes: `npm run deploy`

### Option 6: Electron Dev Mode

```bash
npm install
npm run electron
```

## Security

- **No server-side storage** — API keys and prompts exist only in memory during request processing.
- Server acts as a proxy only; nothing is logged or cached.
- Saved configs live in your browser's localStorage, not on the server.
- Built-in rate limiting (30 req/IP/min) for self-hosted deployments.
- For public deployments, consider adding an auth layer.

## Project Structure

```
public/            — Frontend (HTML/CSS/JS)
functions/         — Cloudflare Pages Functions (serverless API)
app-core.mjs       — Express-based API (for Node.js/Docker/Electron)
server.mjs         — Standalone Node.js entry point
electron-main.js   — Electron main process
wrangler.toml      — Cloudflare Pages config
```

## License

MIT
