const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// Configure marked for safe HTML rendering
if (window.marked) {
  marked.setOptions({
    breaks: true,
    gfm: true,
  });
}

// DOM elements
const ball = document.getElementById('ball');
const panel = document.getElementById('panel');
const messages = document.getElementById('messages');
const input = document.getElementById('input');
const btnSend = document.getElementById('btn-send');
const btnClose = document.getElementById('btn-close');
const btnClear = document.getElementById('btn-clear');
const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const btnSettingsClose = document.getElementById('btn-settings-close');
const btnSaveConfig = document.getElementById('btn-save-config');
const cfgUrl = document.getElementById('cfg-url');
const cfgKey = document.getElementById('cfg-key');
const cfgModel = document.getElementById('cfg-model');

const BALL_SIZE = 200;
const PANEL_WIDTH = 440;
const PANEL_HEIGHT = 620;

let isPanelOpen = false;
let isSettingsOpen = false;
let isLoading = false;

// ===== 点击小球切换面板 =====
ball.addEventListener('click', () => togglePanel());

// ===== 面板切换 =====
async function togglePanel() {
  if (isPanelOpen) {
    await closePanel();
  } else {
    await openPanel();
  }
}

async function openPanel() {
  isPanelOpen = true;
  panel.classList.remove('hidden');
  ball.style.display = 'none';

  await invoke('set_window_size', { width: PANEL_WIDTH, height: PANEL_HEIGHT });

  input.focus();
}

async function closePanel() {
  isPanelOpen = false;
  panel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  isSettingsOpen = false;

  ball.style.display = 'flex';

  await invoke('set_window_size', { width: BALL_SIZE, height: BALL_SIZE });
}

// ===== 关闭按钮 =====
btnClose.addEventListener('click', () => closePanel());

// ===== 清空对话 =====
btnClear.addEventListener('click', async () => {
  await invoke('clear_history');
  messages.innerHTML = '';
});

// ===== 设置面板 =====
btnSettings.addEventListener('click', async () => {
  if (isSettingsOpen) {
    settingsPanel.classList.add('hidden');
    isSettingsOpen = false;
  } else {
    try {
      const config = await invoke('get_config');
      cfgUrl.value = config.api_url;
      cfgKey.value = config.api_key;
      cfgModel.value = config.model;
    } catch (e) {
      console.error('Failed to load config:', e);
    }
    settingsPanel.classList.remove('hidden');
    isSettingsOpen = true;
  }
});

btnSettingsClose.addEventListener('click', () => {
  settingsPanel.classList.add('hidden');
  isSettingsOpen = false;
});

btnSaveConfig.addEventListener('click', async () => {
  const config = {
    api_url: cfgUrl.value || 'https://api.openai.com/v1/chat/completions',
    api_key: cfgKey.value,
    model: cfgModel.value || 'gpt-3.5-turbo',
  };
  await invoke('set_config', { config });
  settingsPanel.classList.add('hidden');
  isSettingsOpen = false;
  addMessage('system', '配置已保存');
});

// ===== 发送消息 =====
btnSend.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 100) + 'px';
});

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isLoading) return;

  input.value = '';
  input.style.height = 'auto';

  addMessage('user', text);
  showLoading();

  try {
    const unlisten = await listen('ai-chunk', (event) => {
      appendToLastMessage(event.payload);
    });

    const unlistenDone = await listen('ai-done', () => {
      unlisten();
      unlistenDone();
      // Render final markdown when done
      renderLastMessageMarkdown();
    });

    await invoke('chat', { message: text });
    hideLoading();
  } catch (e) {
    hideLoading();
    addMessage('error', typeof e === 'string' ? e : e.toString());
  }
}

// ===== 消息管理 =====
function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  if (role === 'loading') {
    div.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
  } else if (role === 'assistant' && window.marked) {
    div.innerHTML = marked.parse(content);
  } else if (role === 'user') {
    div.textContent = content;
  } else {
    div.textContent = content;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

let lastAssistantMsg = null;
let lastAssistantRawText = '';

function showLoading() {
  isLoading = true;
  btnSend.disabled = true;
  lastAssistantMsg = addMessage('loading', '');
  lastAssistantRawText = '';
}

function hideLoading() {
  isLoading = false;
  btnSend.disabled = false;
  const loadingEl = messages.querySelector('.message.loading');
  if (loadingEl) loadingEl.remove();
}

function appendToLastMessage(text) {
  if (!lastAssistantMsg || lastAssistantMsg.classList.contains('loading')) {
    const loadingEl = messages.querySelector('.message.loading');
    if (loadingEl) {
      loadingEl.classList.remove('loading');
      loadingEl.classList.add('assistant');
      lastAssistantMsg = loadingEl;
    } else {
      lastAssistantMsg = addMessage('assistant', '');
    }
  }
  lastAssistantRawText += text;
  // Show raw text during streaming for performance
  lastAssistantMsg.textContent = lastAssistantRawText;
  messages.scrollTop = messages.scrollHeight;
}

function renderLastMessageMarkdown() {
  if (lastAssistantMsg && lastAssistantRawText && window.marked) {
    lastAssistantMsg.innerHTML = marked.parse(lastAssistantRawText);
    messages.scrollTop = messages.scrollHeight;
  }
}

// ===== 初始化 =====
async function init() {
  await invoke('set_window_size', { width: BALL_SIZE, height: BALL_SIZE });

  try {
    const config = await invoke('get_config');
    if (!config.api_key) {
      setTimeout(() => {
        addMessage('system', '点击右上角齿轮图标配置 API Key');
      }, 500);
    }
  } catch (e) {
    console.error('Init error:', e);
  }
}

init();
