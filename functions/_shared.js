const FETCH_TIMEOUT_MS = 30_000;

export function normalizeBaseUrl(input) {
  if (!input || typeof input !== 'string') throw new Error('Base URL 不能为空');
  return input.trim().replace(/\/+$/, '');
}

export function joinUrl(baseUrl, endpoint) {
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

export function truncate(value, max = 4000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > max ? `${text.slice(0, max)}\n... [truncated]` : text;
}

export function buildOpenAIChatRequest(model, prompt, stream = false) {
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

export function buildOpenAIResponsesRequest(model, prompt, stream = false) {
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

export function buildAnthropicRequest(model, prompt, maxTokens = 256, anthropicVersion = '2023-06-01', stream = false) {
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

export function extractAssistantText(apiType, data) {
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

export function parseSSEStream(text, apiType) {
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

export async function fetchWithTimeout(url, options, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJsonWithMeta(url, options, { stream = false, apiType } = {}) {
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

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
