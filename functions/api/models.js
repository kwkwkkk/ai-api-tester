import { readBody, jsonResponse, normalizeBaseUrl, joinUrl, truncate, fetchWithTimeout } from '../_shared.js';

export async function onRequestPost({ request }) {
  try {
    const body = await readBody(request);
    if (!body) return jsonResponse({ ok: false, error: '请求体无效' }, 400);

    const { baseUrl, apiKey, apiType } = body;
    if (!apiKey) return jsonResponse({ ok: false, error: 'API Key 不能为空' }, 400);

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
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

    const response = await fetchWithTimeout(url, { method: 'GET', headers });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      return jsonResponse({ ok: false, status: response.status, error: truncate(json || text, 2000) });
    }

    let models = [];
    if (Array.isArray(json?.data)) {
      models = json.data.map(m => m.id).filter(Boolean).sort();
    }

    return jsonResponse({ ok: true, models });
  } catch (error) {
    const msg = error.name === 'AbortError' ? '请求超时（30s）' : (error.message || '获取模型列表失败');
    return jsonResponse({ ok: false, error: msg }, 500);
  }
}
