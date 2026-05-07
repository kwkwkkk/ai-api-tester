import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const express = require('express');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('Base URL 不能为空');
  return input.trim().replace(/\/+$/, '');
}

function joinUrl(baseUrl, endpoint) {
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

function truncate(value, max = 4000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n... [truncated]` : text;
}

function buildOpenAIChatRequest(model, prompt, stream = false) {
  return {
    endpoint: '/v1/chat/completions',
    headers: { 'Content-Type': 'application/json' },
    body: {
      model,
      messages: [
        { role: 'system', content: 'You are a connectivity test assistant.' },
        { role: 'user', content: prompt || 'Reply with OK.' }
      ],
      temperature: 0,
      stream
    }
  };
}

function buildOpenAIResponsesRequest(model, prompt, stream = false) {
  return {
    endpoint: '/v1/responses',
    headers: { 'Content-Type': 'application/json' },
    body: {
      model,
      input: prompt || 'Reply with OK.',
      temperature: 0,
      stream
    }
  };
}

function buildAnthropicRequest(model, prompt, maxTokens = 256, anthropicVersion = '2023-06-01', stream = false) {
  return {
    endpoint: '/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': anthropicVersion
    },
    body: {
      model,
      max_tokens: maxTokens,
      temperature: 0,
      stream,
      messages: [
        { role: 'user', content: prompt || 'Reply with OK.' }
      ]
    }
  };
}

function extractAssistantText(apiType, data) {
  try {
    if (apiType === 'openai-chat') {
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === 'string') return content;
      if (Array.isArray(content)) return content.map(item => item?.text || JSON.stringify(item)).join('\n');
      return '';
    }
    if (apiType === 'openai-responses') {
      if (typeof data?.output_text === 'string' && data.output_text) return data.output_text;
      const outputs = data?.output || [];
      const texts = [];
      for (const item of outputs) {
        for (const content of item?.content || []) {
          if (content?.type === 'output_text' && content?.text) texts.push(content.text);
        }
      }
      return texts.join('\n');
    }
    if (apiType === 'anthropic') {
      const texts = [];
      for (const block of data?.content || []) {
        if (block?.type === 'text' && block?.text) texts.push(block.text);
      }
      return texts.join('\n');
    }
    return '';
  } catch {
    return '';
  }
}

function buildCurlCommand({ apiType, baseUrl, apiKey, model, prompt, stream = false, maxTokens = 256, anthropicVersion = '2023-06-01' }) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  let requestConfig;
  let authHeader;

  if (apiType === 'openai-chat') {
    requestConfig = buildOpenAIChatRequest(model, prompt, stream);
    authHeader = `-H 'Authorization: Bearer ${apiKey}'`;
  } else if (apiType === 'openai-responses') {
    requestConfig = buildOpenAIResponsesRequest(model, prompt, stream);
    authHeader = `-H 'Authorization: Bearer ${apiKey}'`;
  } else {
    requestConfig = buildAnthropicRequest(model, prompt, maxTokens, anthropicVersion, stream);
    authHeader = `-H 'x-api-key: ${apiKey}' -H 'anthropic-version: ${anthropicVersion}'`;
  }

  const url = joinUrl(normalizedBaseUrl, requestConfig.endpoint);
  return `curl -X POST '${url}' \\
  -H 'Content-Type: application/json' \\
  ${authHeader} \\
  -d '${JSON.stringify(requestConfig.body)}'`;
}

async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

function parseSSEStream(text, apiType) {
  const lines = text.split('\n');
  const chunks = [];
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') break;
    try {
      const obj = JSON.parse(payload);
      if (apiType === 'openai-chat') {
        const delta = obj?.choices?.[0]?.delta?.content;
        if (delta) chunks.push(delta);
      } else if (apiType === 'openai-responses') {
        if (obj?.type === 'response.output_text.delta' && obj?.delta) chunks.push(obj.delta);
      } else if (apiType === 'anthropic') {
        if (obj?.type === 'content_block_delta' && obj?.delta?.text) chunks.push(obj.delta.text);
      }
    } catch {
      // skip malformed SSE lines
    }
  }
  return chunks.join('');
}

async function fetchJsonWithMeta(url, options, { stream = false, apiType } = {}) {
  const startedAt = Date.now();
  const response = await fetchWithTimeout(url, options);
  const elapsedMs = Date.now() - startedAt;
  const text = await response.text();
  let json = null;
  let assistantText = null;

  if (stream && response.ok) {
    assistantText = parseSSEStream(text, apiType);
  } else {
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
  }
  return { response, elapsedMs, text, json, assistantText };
}

function createRateLimiter(windowMs = RATE_LIMIT_WINDOW_MS, max = RATE_LIMIT_MAX) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = hits.get(key);
    if (!record || now - record.start > windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    record.count += 1;
    if (record.count > max) {
      return res.status(429).json({ ok: false, error: '请求过于频繁，请稍后再试' });
    }
    next();
  };
}

export function createApp(staticRoot = path.join(__dirname, 'public')) {
  const app = express();
  app.use(express.json({ limit: '200kb' }));
  app.use(express.static(staticRoot));

  const apiLimiter = createRateLimiter();
  app.use('/api/test', apiLimiter);
  app.use('/api/test-batch', apiLimiter);
  app.use('/api/models', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'ai-api-tester', version: '1.1.0' });
  });

  app.post('/api/models', async (req, res) => {
    try {
      const { baseUrl, apiKey, apiType } = req.body || {};
      const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
      if (!apiKey) return res.status(400).json({ ok: false, error: 'API Key 不能为空' });

      let url;
      const headers = {};
      if (apiType === 'anthropic') {
        url = joinUrl(normalizedBaseUrl, '/v1/models');
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        url = joinUrl(normalizedBaseUrl, '/v1/models');
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const result = await fetchJsonWithMeta(url, { method: 'GET', headers }, { stream: false });
      const list = Array.isArray(result.json?.data)
        ? result.json.data.map(item => item.id || item.name).filter(Boolean)
        : Array.isArray(result.json?.models)
          ? result.json.models.map(item => item.id || item.name).filter(Boolean)
          : [];

      res.status(result.response.status).json({ ok: result.response.ok, status: result.response.status, elapsedMs: result.elapsedMs, models: list, raw: result.json || result.text });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message || '获取模型失败' });
    }
  });

  app.post('/api/test', async (req, res) => {
    try {
      const { baseUrl, apiKey, apiType, model, prompt, stream = false, maxTokens = 256, anthropicVersion = '2023-06-01' } = req.body || {};
      if (!apiType) return res.status(400).json({ ok: false, error: 'API 类型不能为空' });
      if (!model) return res.status(400).json({ ok: false, error: '模型不能为空' });
      if (!apiKey) return res.status(400).json({ ok: false, error: 'API Key 不能为空' });

      const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
      let requestConfig;
      let headers = {};

      if (apiType === 'openai-chat') {
        requestConfig = buildOpenAIChatRequest(model, prompt, stream);
        headers = { ...requestConfig.headers, Authorization: `Bearer ${apiKey}` };
      } else if (apiType === 'openai-responses') {
        requestConfig = buildOpenAIResponsesRequest(model, prompt, stream);
        headers = { ...requestConfig.headers, Authorization: `Bearer ${apiKey}` };
      } else if (apiType === 'anthropic') {
        requestConfig = buildAnthropicRequest(model, prompt, maxTokens, anthropicVersion, stream);
        headers = { ...requestConfig.headers, 'x-api-key': apiKey };
      } else {
        return res.status(400).json({ ok: false, error: '不支持的 API 类型' });
      }

      const url = joinUrl(normalizedBaseUrl, requestConfig.endpoint);
      const result = await fetchJsonWithMeta(url, { method: 'POST', headers, body: JSON.stringify(requestConfig.body) }, { stream, apiType });
      const assistantText = result.assistantText || extractAssistantText(apiType, result.json);

      res.status(result.response.status).json({
        ok: result.response.ok,
        status: result.response.status,
        elapsedMs: result.elapsedMs,
        endpoint: requestConfig.endpoint,
        requestPreview: requestConfig.body,
        assistantText,
        curl: buildCurlCommand({ apiType, baseUrl: normalizedBaseUrl, apiKey, model, prompt, stream, maxTokens, anthropicVersion }),
        raw: stream ? (assistantText || truncate(result.text)) : (result.json || truncate(result.text))
      });
    } catch (error) {
      const msg = error.name === 'AbortError' ? '请求超时（30s）' : (error.message || '测试失败');
      res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post('/api/test-batch', async (req, res) => {
    try {
      const { baseUrl, apiKey, apiType, models, prompt, stream = false, maxTokens = 256, anthropicVersion = '2023-06-01' } = req.body || {};
      if (!Array.isArray(models) || models.length === 0) return res.status(400).json({ ok: false, error: 'models 不能为空' });
      if (models.length > 20) return res.status(400).json({ ok: false, error: '单次批量测试最多 20 个模型' });

      const results = [];
      for (const model of models) {
        try {
          const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
          let requestConfig;
          let headers = {};

          if (apiType === 'openai-chat') {
            requestConfig = buildOpenAIChatRequest(model, prompt, stream);
            headers = { ...requestConfig.headers, Authorization: `Bearer ${apiKey}` };
          } else if (apiType === 'openai-responses') {
            requestConfig = buildOpenAIResponsesRequest(model, prompt, stream);
            headers = { ...requestConfig.headers, Authorization: `Bearer ${apiKey}` };
          } else if (apiType === 'anthropic') {
            requestConfig = buildAnthropicRequest(model, prompt, maxTokens, anthropicVersion, stream);
            headers = { ...requestConfig.headers, 'x-api-key': apiKey };
          } else {
            results.push({ model, ok: false, error: '不支持的 API 类型' });
            continue;
          }

          const url = joinUrl(normalizedBaseUrl, requestConfig.endpoint);
          const result = await fetchJsonWithMeta(url, { method: 'POST', headers, body: JSON.stringify(requestConfig.body) }, { stream, apiType });
          const assistantText = result.assistantText || extractAssistantText(apiType, result.json);
          results.push({ model, ok: result.response.ok, status: result.response.status, elapsedMs: result.elapsedMs, assistantText, error: result.response.ok ? null : truncate(result.json || result.text, 600) });
        } catch (error) {
          const msg = error.name === 'AbortError' ? '请求超时（30s）' : (error.message || '测试失败');
          results.push({ model, ok: false, error: msg });
        }
      }

      res.json({ ok: true, results });
    } catch (error) {
      res.status(500).json({ ok: false, error: error.message || '批量测试失败' });
    }
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });

  return app;
}

export function startServer({ port = 3210, host = '0.0.0.0', staticRoot } = {}) {
  const app = createApp(staticRoot);
  return new Promise((resolve) => {
    const server = app.listen(port, host, () => {
      resolve(server);
    });
  });
}

export { __dirname };
