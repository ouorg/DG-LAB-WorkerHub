export const consoleClientScript = `
let bearer = localStorage.bearer || '', deviceId = '', state = {};
const el = id => document.getElementById(id);
const out = (id, value) => { el(id).textContent = JSON.stringify(value, null, 2); };
const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function badge(id, text, ok) {
  const node = el(id);
  node.className = 'badge ' + (ok === true ? 'ok' : ok === false ? 'bad' : '');
  node.innerHTML = '<span class="badge-dot"></span>' + safe(text);
}

async function api(path, options = {}) {
  options.headers = { ...(options.headers || {}), Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' };
  const response = await fetch(path, options), result = await response.json();
  if (!response.ok) throw Error(result.error || response.statusText);
  return result;
}

async function login() {
  try {
    const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password: el('password').value }) });
    bearer = result.session.id;
    localStorage.bearer = bearer;
    badge('session', '已登录', true);
    badge('sessionBadge', '会话有效', true);
    selectDevice(result.device.id);
  } catch (error) {
    badge('session', error.message, false);
    badge('sessionBadge', '登录失败', false);
  }
}

async function load(autoSelect = true) {
  try {
    const result = await api('/api/devices');
    el('devices').innerHTML = result.devices.length
      ? result.devices.map(device => '<button class="device ' + (device.id === deviceId ? 'selected' : '') + '" data-device-id="' + safe(device.id) + '"><span class="device-name">' + safe(device.name) + '</span><span class="device-id">' + safe(device.id) + '</span></button>').join('')
      : '<div class="empty">暂无设备，请先创建一个设备</div>';
    if (autoSelect && !deviceId && result.devices[0]) selectDevice(result.devices[0].id);
  } catch (error) { badge('sessionBadge', '需要登录', false); }
}

async function createDevice() {
  try {
    await api('/api/devices', { method: 'POST', body: JSON.stringify({ name: el('newName').value }) });
    el('newName').value = '';
    load();
  } catch (error) { alert(error.message); }
}

async function selectDevice(id) {
  deviceId = id;
  el('selected').textContent = '已选择 ' + id;
  el('sidebarDevice').textContent = id;
  await load(false);
  refresh();
}

function renderState(value) {
  state = value || {};
  const strengths = state.strengths || {};
  for (const name of ['A', 'B']) {
    const strength = Number(strengths[name] || 0);
    el('strength' + name).textContent = strength;
    el('meter' + name).style.width = Math.max(0, Math.min(100, strength / 2)) + '%';
  }
  el('queueDepth').textContent = state.queueDepth ?? '—';
  el('lastHeartbeat').textContent = state.lastHeartbeat || '—';
  el('lastFeedback').textContent = state.lastFeedback || '—';
  badge('onlineBadge', state.online ? '设备在线' : '设备离线', !!state.online);
}

async function refresh() {
  if (!deviceId) return;
  try {
    const status = await api('/api/devices/' + deviceId + '/status');
    out('status', status);
    renderState(status);
    out('logs', await api('/api/devices/' + deviceId + '/logs'));
  } catch (error) { alert(error.message); }
}

async function act(path, body = {}) {
  if (!deviceId) return alert('请先选择设备');
  try {
    const status = await api('/api/devices/' + deviceId + '/' + path, { method: 'POST', body: JSON.stringify(body) });
    out('status', status);
    renderState(status);
    refresh();
  } catch (error) { alert(error.message); }
}

const bind = () => act('bind', { clientId: el('clientId').value, targetId: el('targetId').value });
const unbind = () => act('unbind');
const strength = () => act('strength', { channel: el('channel').value, mode: Number(el('mode').value), value: Number(el('strength').value) });
const changeStrength = (channel, mode, value) => act('strength', { channel, mode, value });
const clearChannel = () => act('clear', { channel: el('channel').value });
const waveform = () => { try { act('waveform', { channel: el('channel').value, pulses: JSON.parse(el('pulses').value) }); } catch { alert('波形 JSON 格式错误'); } };

async function mcpTools() { try { out('mcp', await api('/api/mcp/tools')); } catch (error) { alert(error.message); } }
async function callTool() { try { out('mcp', await api('/api/mcp/tool/' + el('tool').value, { method: 'POST', body: el('args').value })); } catch (error) { alert(error.message); } }
function showPanel(name) { for (const panel of ['status', 'logs']) { el(panel).classList.toggle('active', panel === name); el(panel + 'Tab').classList.toggle('active', panel === name); } }
function focusMcp() { el('mcpSection').scrollIntoView({ behavior: 'smooth' }); }
function toggleTheme() { const root = document.documentElement, mode = root.dataset.mode === 'dark' ? 'light' : 'dark'; root.dataset.mode = mode; localStorage.mode = mode; }

el('devices').addEventListener('click', event => { const button = event.target.closest('[data-device-id]'); if (button) selectDevice(button.dataset.deviceId); });
document.documentElement.dataset.mode = localStorage.mode || 'dark';
if (bearer) { badge('sessionBadge', '恢复会话', true); load(); }
`;
