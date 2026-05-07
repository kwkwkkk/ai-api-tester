import { jsonResponse } from '../_shared.js';

export function onRequestGet() {
  return jsonResponse({ ok: true, service: 'ai-api-tester', version: '1.1.0' });
}
