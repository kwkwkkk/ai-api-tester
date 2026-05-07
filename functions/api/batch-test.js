import {
  readBody, jsonResponse, normalizeBaseUrl, joinUrl, truncate,
  buildOpenAIChatRequest, buildOpenAIResponsesRequest, buildAnthropicRequest,
  extractAssistantText, fetchJsonWithMeta
} from '../_shared.js';

export async function onRequestPost({ request }) {
  try {
    const body = await readBody(request);
    if (!body) return jsonResponse({ ok: false, error: '请求体无效' }, 400);

    const { baseUrl, apiKey, apiType, models, prompt, stream, maxTokens, anthropicVersion } = body;
    if (!apiKey) return jsonResponse({ ok: false, error: 'API Key 不能为空' }, 400);
    if (!Array.isArray(models) || models.length === 0) {
      return jsonResponse({ ok: false, error: '请提供模型列表' }, 400);
    }

    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    const results = [];

    for (const model of models) {
      try {
        let requestConfig;
        let headers;

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
        const result = await fetchJsonWithMeta(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestConfig.body)
        }, { stream, apiType });

        const assistantText = result.assistantText || extractAssistantText(apiType, result.json);
        results.push({
          model,
          ok: result.response.ok,
          status: result.response.status,
          elapsedMs: result.elapsedMs,
          assistantText,
          error: result.response.ok ? null : truncate(result.json || result.text, 600)
        });
      } catch (error) {
        const msg = error.name === 'AbortError' ? '请求超时（30s）' : (error.message || '测试失败');
        results.push({ model, ok: false, error: msg });
      }
    }

    return jsonResponse({ ok: true, results });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message || '批量测试失败' }, 500);
  }
}
