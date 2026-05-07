const $ = (id) => document.getElementById(id);

const fields = {
  apiType: $('apiType'),
  baseUrl: $('baseUrl'),
  apiKey: $('apiKey'),
  model: $('model'),
  batchModels: $('batchModels'),
  maxTokens: $('maxTokens'),
  anthropicVersion: $('anthropicVersion'),
  prompt: $('prompt'),
  stream: $('stream'),
  rememberConfig: $('rememberConfig')
};

const summary = $('summary');
const rawOutput = $('rawOutput');
const modelsOutput = $('modelsOutput');
const batchOutput = $('batchOutput');
const curlOutput = $('curlOutput');
const testBtn = $('testBtn');
const fetchModelsBtn = $('fetchModelsBtn');
const batchTestBtn = $('batchTestBtn');
const copyCurlBtn = $('copyCurlBtn');
const profileSelect = $('profileSelect');
const saveProfileBtn = $('saveProfileBtn');
const deleteProfileBtn = $('deleteProfileBtn');

const STORAGE_KEY = 'ai-api-tester-config-v2';
const PROFILES_KEY = 'ai-api-tester-profiles-v1';

function getPayloadBase() {
  return {
    apiType: fields.apiType.value,
    baseUrl: fields.baseUrl.value.trim(),
    apiKey: fields.apiKey.value.trim(),
    model: fields.model.value.trim(),
    prompt: fields.prompt.value.trim(),
    stream: fields.stream.checked,
    maxTokens: Number(fields.maxTokens.value || 256),
    anthropicVersion: fields.anthropicVersion.value.trim() || '2023-06-01'
  };
}

function getAllFormData() {
  return {
    ...getPayloadBase(),
    batchModels: fields.batchModels.value,
    rememberConfig: fields.rememberConfig.checked
  };
}

function fillForm(data) {
  for (const key of Object.keys(fields)) {
    if (!(key in data)) continue;
    if (fields[key].type === 'checkbox') {
      fields[key].checked = !!data[key];
    } else {
      fields[key].value = data[key] ?? '';
    }
  }
  updateFieldVisibility();
}

function updateFieldVisibility() {
  const apiType = fields.apiType.value;
  const anthropicFields = document.getElementById('anthropicVersion').closest('.field');
  const maxTokensField = document.getElementById('maxTokens').closest('div');
  if (apiType === 'anthropic') {
    anthropicFields.style.display = '';
    maxTokensField.style.display = '';
  } else {
    anthropicFields.style.display = 'none';
    maxTokensField.style.display = '';
  }
}

function saveConfig() {
  if (!fields.rememberConfig.checked) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getAllFormData()));
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    fillForm(JSON.parse(raw));
  } catch {
    // ignore
  }
}

function getProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}');
  } catch {
    return {};
  }
}

function setProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

function refreshProfiles() {
  const profiles = getProfiles();
  const names = Object.keys(profiles).sort();
  profileSelect.innerHTML = ['<option value="">选择档案...</option>', ...names.map(name => `<option value="${name}">${name}</option>`)].join('');
}

function pretty(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  return { response, data };
}

function setBusy(button, busyText) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = busyText;
  return () => {
    button.disabled = false;
    button.textContent = oldText;
  };
}

async function onFetchModels() {
  saveConfig();
  const restore = setBusy(fetchModelsBtn, '获取中...');
  modelsOutput.textContent = '请求中...';
  try {
    const payload = getPayloadBase();
    const { data } = await postJson('/api/models', payload);
    if (!data.ok) {
      modelsOutput.textContent = pretty(data);
      return;
    }
    modelsOutput.textContent = data.models?.length
      ? data.models.join('\n')
      : `未解析到模型列表\n\n${pretty(data.raw)}`;
  } catch (error) {
    modelsOutput.textContent = error.message || String(error);
  } finally {
    restore();
  }
}

async function onTest() {
  saveConfig();
  const restore = setBusy(testBtn, '测试中...');
  summary.textContent = '请求中...';
  rawOutput.textContent = '请求中...';
  curlOutput.textContent = '生成中...';
  try {
    const payload = getPayloadBase();
    const { data } = await postJson('/api/test', payload);

    summary.textContent = [
      `ok: ${data.ok}`,
      `status: ${data.status ?? 'N/A'}`,
      `elapsedMs: ${data.elapsedMs ?? 'N/A'}`,
      `endpoint: ${data.endpoint ?? 'N/A'}`,
      '',
      'assistantText:',
      data.assistantText || '(empty)',
      data.error ? `\nerror:\n${data.error}` : ''
    ].join('\n');

    curlOutput.textContent = data.curl || '未生成';
    rawOutput.textContent = pretty(data.raw || data);
  } catch (error) {
    summary.textContent = error.message || String(error);
    rawOutput.textContent = '请求失败';
    curlOutput.textContent = '生成失败';
  } finally {
    restore();
  }
}

async function onBatchTest() {
  saveConfig();
  const restore = setBusy(batchTestBtn, '批量测试中...');
  batchOutput.textContent = '请求中...';
  try {
    const models = fields.batchModels.value
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const payload = {
      ...getPayloadBase(),
      models
    };

    const { data } = await postJson('/api/test-batch', payload);
    if (!data.ok) {
      batchOutput.textContent = pretty(data);
      return;
    }

    batchOutput.textContent = data.results.map(item => {
      return [
        `model: ${item.model}`,
        `ok: ${item.ok}`,
        `status: ${item.status ?? 'N/A'}`,
        `elapsedMs: ${item.elapsedMs ?? 'N/A'}`,
        `assistantText: ${item.assistantText || '(empty)'}`,
        item.error ? `error: ${item.error}` : ''
      ].filter(Boolean).join('\n');
    }).join('\n\n--------------------\n\n');
  } catch (error) {
    batchOutput.textContent = error.message || String(error);
  } finally {
    restore();
  }
}

async function onCopyCurl() {
  const text = curlOutput.textContent || '';
  if (!text || text === '尚未生成' || text === '生成失败') return;
  await navigator.clipboard.writeText(text);
  const old = copyCurlBtn.textContent;
  copyCurlBtn.textContent = '已复制';
  setTimeout(() => { copyCurlBtn.textContent = old; }, 1200);
}

function onSaveProfile() {
  const name = prompt('给这个配置档案起个名字');
  if (!name) return;
  const profiles = getProfiles();
  profiles[name] = getAllFormData();
  setProfiles(profiles);
  refreshProfiles();
  profileSelect.value = name;
}

function onDeleteProfile() {
  const name = profileSelect.value;
  if (!name) return;
  const profiles = getProfiles();
  delete profiles[name];
  setProfiles(profiles);
  refreshProfiles();
}

function onSelectProfile() {
  const name = profileSelect.value;
  if (!name) return;
  const profiles = getProfiles();
  if (profiles[name]) {
    fillForm(profiles[name]);
    saveConfig();
  }
}

fields.apiType.addEventListener('change', () => {
  saveConfig();
  updateFieldVisibility();
});
Object.values(fields).forEach((field) => {
  const eventName = field.tagName === 'SELECT' || field.type === 'checkbox' ? 'change' : 'input';
  field.addEventListener(eventName, saveConfig);
});

testBtn.addEventListener('click', onTest);
fetchModelsBtn.addEventListener('click', onFetchModels);
batchTestBtn.addEventListener('click', onBatchTest);
copyCurlBtn.addEventListener('click', onCopyCurl);
saveProfileBtn.addEventListener('click', onSaveProfile);
deleteProfileBtn.addEventListener('click', onDeleteProfile);
profileSelect.addEventListener('change', onSelectProfile);

refreshProfiles();
loadConfig();
updateFieldVisibility();

if (!fields.baseUrl.value) fields.baseUrl.value = 'https://api.openai.com';
if (!fields.prompt.value) fields.prompt.value = 'Say OK and tell me which model handled this request.';
