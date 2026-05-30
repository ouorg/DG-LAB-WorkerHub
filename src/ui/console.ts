import { consoleClientScript } from "./client";
import { consoleStyles } from "./styles";

export const consoleHtml = `<!doctype html>
<html lang="zh-CN" data-mode="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#111827">
<title>DG-LAB WorkerHub</title>
<style>${consoleStyles}</style>
</head>
<body>
<div class="app-shell">
<aside class="sidebar">
  <div class="brand"><div class="brand-mark">DG</div><div><div class="brand-title">WORKERHUB</div><div class="brand-subtitle">DG-LAB CONTROL PLANE</div></div></div>
  <div class="nav-title">控制台</div><button class="nav-item active"><span class="nav-dot"></span>设备控制</button><button class="nav-item" onclick="focusMcp()"><span class="nav-dot"></span>MCP 工具</button>
  <div class="nav-title">连接状态</div><div class="nav-item"><span class="nav-dot"></span><span id="sidebarDevice">未选择设备</span></div>
  <div class="sidebar-footer"><p class="caption">DG-LAB SOCKET v2<br>Cloudflare Workers Edge</p><button class="button ghost wide" onclick="toggleTheme()">切换显示模式</button></div>
</aside>
<div class="content">
<header class="topbar"><div class="mobile-brand"><div class="brand-mark">DG</div><b>WorkerHub</b></div><div class="topbar-title">设备控制台</div><div class="topbar-actions"><span id="sessionBadge" class="badge"><span class="badge-dot"></span>未登录</span><button class="button icon" aria-label="切换显示模式" onclick="toggleTheme()">◐</button></div></header>
<main class="main">
<section class="hero"><div><p class="eyebrow">DG-LAB SOCKET CONTROL</p><h1>脉冲主机控制台</h1><p class="muted">管理设备连接、双通道强度和波形输出。界面针对桌面、平板和移动端自适应。</p></div><button class="button primary" onclick="refresh()">↻ 刷新设备状态</button></section>
<section class="grid overview-grid">
<div>
  <section class="layer-card login-card"><div class="card-head"><div><h2>访问授权</h2><p class="caption">输入登录密码后自动进入默认设备</p></div><span id="session" class="badge"><span class="badge-dot"></span>尚未登录</span></div><div class="card-body"><div class="form-row"><input id="password" class="input" type="password" autocomplete="current-password" placeholder="输入登录密码"><button class="button primary" onclick="login()">密码登录</button></div></div></section>
  <section class="layer-card"><div class="card-head"><div><h2>实时通道控制</h2><p id="selected" class="caption">请先从设备列表选择设备</p></div><span id="onlineBadge" class="badge"><span class="badge-dot"></span>设备未知</span></div><div class="card-body">
    <div class="info-strip">ⓘ <span>参考官方控制端的 A / B 双通道操作习惯。建议先在 APP 内设置强度上限保护，再发送脉冲。</span></div>
    <div class="grid channel-grid">
      <article class="stat"><div class="channel-title"><span class="channel-letter">A</span><div><h3>A 通道</h3><span class="caption">实时输出强度</span></div></div><div><span id="strengthA" class="strength-value">0</span><span class="strength-unit">/ 200</span></div><div class="meter"><div id="meterA" class="meter-fill"></div></div><div class="button-group"><button class="button" onclick="changeStrength(1,0,1)">− 1</button><button class="button" onclick="changeStrength(1,1,1)">＋ 1</button><button class="button danger" onclick="changeStrength(1,2,0)">归零</button></div></article>
      <article class="stat"><div class="channel-title"><span class="channel-letter">B</span><div><h3>B 通道</h3><span class="caption">实时输出强度</span></div></div><div><span id="strengthB" class="strength-value">0</span><span class="strength-unit">/ 200</span></div><div class="meter"><div id="meterB" class="meter-fill"></div></div><div class="button-group"><button class="button" onclick="changeStrength(2,0,1)">− 1</button><button class="button" onclick="changeStrength(2,1,1)">＋ 1</button><button class="button danger" onclick="changeStrength(2,2,0)">归零</button></div></article>
    </div>
    <div class="grid mini-grid"><div class="stat"><span class="stat-label">队列深度</span><span id="queueDepth" class="stat-value">—</span></div><div class="stat"><span class="stat-label">最后心跳</span><span id="lastHeartbeat" class="stat-value">—</span></div><div class="stat"><span class="stat-label">最后反馈</span><span id="lastFeedback" class="stat-value">—</span></div></div>
  </div></section>
</div>
<div class="stack">
  <section class="layer-card"><div class="card-head"><div><h2>设备列表</h2><p class="caption">选择需要操作的脉冲主机</p></div></div><div class="card-body stack"><div class="form-row"><input id="newName" class="input" placeholder="新设备名称"><button class="button primary" onclick="createDevice()">创建</button></div><div id="devices" class="device-list"><div class="empty">登录后载入设备</div></div></div></section>
  <section class="layer-card"><div class="card-head"><div><h2>SOCKET 绑定</h2><p class="caption">关联控制端与 APP 目标端</p></div></div><div class="card-body stack"><input id="clientId" class="input" placeholder="clientId"><input id="targetId" class="input" placeholder="targetId"><div class="form-row"><button class="button primary" onclick="bind()">建立绑定</button><button class="button" onclick="unbind()">解除绑定</button></div></div></section>
</div>
</section>
<section class="grid overview-grid" style="margin-top:16px">
  <section class="layer-card"><div class="card-head"><div><h2>高级控制</h2><p class="caption">指定强度、清空队列或发送 V3 波形数据</p></div></div><div class="card-body stack"><div class="form-row wrap"><select id="channel" class="select"><option value="1">通道 A</option><option value="2">通道 B</option></select><select id="mode" class="select"><option value="2">设置到指定值</option><option value="1">增加</option><option value="0">减少</option></select><input id="strength" class="input" type="number" min="0" max="200" value="10"><button class="button primary" onclick="strength()">发送强度</button><button class="button" onclick="clearChannel()">清空队列</button></div><label><span class="label">波形 JSON 数组</span><textarea id="pulses" class="textarea" placeholder='例如 ["0A0A0A0A64646464"]'></textarea></label><button class="button primary" onclick="waveform()">发送波形到所选通道</button></div></section>
  <section class="layer-card"><div class="card-head"><div><h2>设备状态</h2><p class="caption">原始数据与操作日志</p></div></div><div class="card-body stack"><div class="tabs"><button id="statusTab" class="tab active" onclick="showPanel('status')">当前状态</button><button id="logsTab" class="tab" onclick="showPanel('logs')">操作日志</button></div><pre id="status" class="code panel active">{}</pre><pre id="logs" class="code panel">[]</pre></div></section>
</section>
<section id="mcpSection" class="layer-card" style="margin-top:16px"><div class="card-head"><div><h2>MCP 风格工具</h2><p class="caption">查看 Worker 暴露的工具并直接测试参数</p></div><button class="button" onclick="mcpTools()">查看工具清单</button></div><div class="card-body stack"><div class="form-row wrap"><select id="tool" class="select"><option>list_devices</option><option>get_device_status</option><option>set_strength</option><option>send_waveform</option><option>clear_channel</option><option>bind_device</option><option>unbind_device</option></select><textarea id="args" class="textarea" placeholder='工具参数 JSON，例如 {"deviceId":"..."}'>{}</textarea><button class="button primary" onclick="callTool()">测试调用</button></div><pre id="mcp" class="code">[]</pre></div></section>
</main>
</div>
</div>
<script>${consoleClientScript}</script>
</body>
</html>`;
