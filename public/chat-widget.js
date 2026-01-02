/**
 * Mitch Hospitality Chat Widget
 *
 * Embeddable chat widget for restaurant websites.
 * Usage:
 * <script src="https://api.mitch-ai.com/chat-widget.js" data-tenant="YOUR_TENANT_SLUG"></script>
 */

(function() {
  'use strict';

  // Configuration
  const config = {
    apiBaseUrl: window.MITCH_API_URL || 'https://api.mitch-ai.com/api/v1',
    tenantSlug: null,
    position: 'bottom-right',
    primaryColor: '#4F46E5',
    greeting: 'Hi! How can I help you today?',
    placeholder: 'Type your message...',
    title: 'Chat with us'
  };

  // State
  let state = {
    isOpen: false,
    sessionId: null,
    messages: [],
    isTyping: false,
    customerInfo: {}
  };

  // Initialize
  function init() {
    // Get configuration from script tag
    const script = document.currentScript || document.querySelector('script[data-tenant]');
    if (script) {
      config.tenantSlug = script.getAttribute('data-tenant');
      config.position = script.getAttribute('data-position') || config.position;
      config.primaryColor = script.getAttribute('data-color') || config.primaryColor;
      config.greeting = script.getAttribute('data-greeting') || config.greeting;
      config.title = script.getAttribute('data-title') || config.title;
    }

    if (!config.tenantSlug) {
      console.error('Mitch Chat: Missing data-tenant attribute');
      return;
    }

    // Generate session ID
    state.sessionId = localStorage.getItem('mitch_chat_session') || generateUUID();
    localStorage.setItem('mitch_chat_session', state.sessionId);

    // Load previous messages if any
    const savedMessages = localStorage.getItem(`mitch_chat_messages_${config.tenantSlug}`);
    if (savedMessages) {
      try {
        state.messages = JSON.parse(savedMessages);
      } catch (e) {
        state.messages = [];
      }
    }

    // Inject styles
    injectStyles();

    // Create widget
    createWidget();

    // Add greeting if no messages
    if (state.messages.length === 0) {
      addMessage('assistant', config.greeting);
    }
  }

  // Generate UUID
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Inject CSS styles
  function injectStyles() {
    const styles = `
      .mitch-chat-widget {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        position: fixed;
        ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
        ${config.position.includes('bottom') ? 'bottom: 20px;' : 'top: 20px;'}
        z-index: 999999;
      }

      .mitch-chat-button {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .mitch-chat-button:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
      }

      .mitch-chat-button svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      .mitch-chat-window {
        position: absolute;
        ${config.position.includes('right') ? 'right: 0;' : 'left: 0;'}
        ${config.position.includes('bottom') ? 'bottom: 70px;' : 'top: 70px;'}
        width: 380px;
        height: 520px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: scale(0.9) translateY(10px);
        transition: opacity 0.3s, transform 0.3s;
        pointer-events: none;
      }

      .mitch-chat-window.open {
        opacity: 1;
        transform: scale(1) translateY(0);
        pointer-events: auto;
      }

      .mitch-chat-header {
        background: ${config.primaryColor};
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .mitch-chat-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
      }

      .mitch-chat-close {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        opacity: 0.8;
        transition: opacity 0.2s;
      }

      .mitch-chat-close:hover {
        opacity: 1;
      }

      .mitch-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .mitch-chat-message {
        max-width: 80%;
        padding: 12px 16px;
        border-radius: 16px;
        font-size: 14px;
        line-height: 1.4;
        animation: messageIn 0.3s ease;
      }

      @keyframes messageIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .mitch-chat-message.user {
        background: ${config.primaryColor};
        color: white;
        align-self: flex-end;
        border-bottom-right-radius: 4px;
      }

      .mitch-chat-message.assistant {
        background: #f1f1f1;
        color: #333;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }

      .mitch-chat-typing {
        display: flex;
        gap: 4px;
        padding: 12px 16px;
        background: #f1f1f1;
        border-radius: 16px;
        align-self: flex-start;
        border-bottom-left-radius: 4px;
      }

      .mitch-chat-typing span {
        width: 8px;
        height: 8px;
        background: #999;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .mitch-chat-typing span:nth-child(2) {
        animation-delay: 0.2s;
      }

      .mitch-chat-typing span:nth-child(3) {
        animation-delay: 0.4s;
      }

      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-4px); }
      }

      .mitch-chat-input-area {
        padding: 16px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 8px;
      }

      .mitch-chat-input {
        flex: 1;
        padding: 12px 16px;
        border: 1px solid #ddd;
        border-radius: 24px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }

      .mitch-chat-input:focus {
        border-color: ${config.primaryColor};
      }

      .mitch-chat-send {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: ${config.primaryColor};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .mitch-chat-send:hover {
        background: ${adjustColor(config.primaryColor, -20)};
      }

      .mitch-chat-send:disabled {
        background: #ccc;
        cursor: not-allowed;
      }

      .mitch-chat-send svg {
        width: 20px;
        height: 20px;
        fill: white;
      }

      .mitch-chat-powered {
        text-align: center;
        padding: 8px;
        font-size: 11px;
        color: #999;
      }

      .mitch-chat-powered a {
        color: ${config.primaryColor};
        text-decoration: none;
      }

      @media (max-width: 480px) {
        .mitch-chat-window {
          width: calc(100vw - 40px);
          height: calc(100vh - 100px);
          max-height: 600px;
        }
      }
    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  // Adjust color brightness
  function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  // Create widget HTML
  function createWidget() {
    const widget = document.createElement('div');
    widget.className = 'mitch-chat-widget';
    widget.innerHTML = `
      <button class="mitch-chat-button" aria-label="Open chat">
        <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
      </button>
      <div class="mitch-chat-window">
        <div class="mitch-chat-header">
          <h3 class="mitch-chat-title">${config.title}</h3>
          <button class="mitch-chat-close" aria-label="Close chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
        <div class="mitch-chat-messages" id="mitch-messages"></div>
        <div class="mitch-chat-input-area">
          <input type="text" class="mitch-chat-input" placeholder="${config.placeholder}" id="mitch-input">
          <button class="mitch-chat-send" id="mitch-send" aria-label="Send message">
            <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="mitch-chat-powered">
          Powered by <a href="https://mitch-ai.com" target="_blank">Mitch AI</a>
        </div>
      </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const chatButton = widget.querySelector('.mitch-chat-button');
    const closeButton = widget.querySelector('.mitch-chat-close');
    const chatWindow = widget.querySelector('.mitch-chat-window');
    const input = widget.querySelector('#mitch-input');
    const sendButton = widget.querySelector('#mitch-send');

    chatButton.addEventListener('click', () => toggleChat(chatWindow));
    closeButton.addEventListener('click', () => toggleChat(chatWindow, false));

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendButton.addEventListener('click', sendMessage);

    // Render existing messages
    renderMessages();
  }

  // Toggle chat window
  function toggleChat(window, forceState) {
    state.isOpen = forceState !== undefined ? forceState : !state.isOpen;
    window.classList.toggle('open', state.isOpen);

    if (state.isOpen) {
      document.getElementById('mitch-input').focus();
      scrollToBottom();
    }
  }

  // Render messages
  function renderMessages() {
    const container = document.getElementById('mitch-messages');
    container.innerHTML = state.messages.map(msg => `
      <div class="mitch-chat-message ${msg.role}">
        ${escapeHtml(msg.content)}
      </div>
    `).join('');

    if (state.isTyping) {
      container.innerHTML += `
        <div class="mitch-chat-typing">
          <span></span><span></span><span></span>
        </div>
      `;
    }

    scrollToBottom();
  }

  // Add message
  function addMessage(role, content) {
    state.messages.push({ role, content, timestamp: new Date().toISOString() });
    saveMessages();
    renderMessages();
  }

  // Save messages to localStorage
  function saveMessages() {
    localStorage.setItem(
      `mitch_chat_messages_${config.tenantSlug}`,
      JSON.stringify(state.messages.slice(-50)) // Keep last 50 messages
    );
  }

  // Send message
  async function sendMessage() {
    const input = document.getElementById('mitch-input');
    const message = input.value.trim();

    if (!message) return;

    // Add user message
    addMessage('user', message);
    input.value = '';

    // Show typing indicator
    state.isTyping = true;
    renderMessages();

    try {
      const response = await fetch(`${config.apiBaseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': config.tenantSlug
        },
        body: JSON.stringify({
          sessionId: state.sessionId,
          message: message,
          channel: 'web',
          customerName: state.customerInfo.name,
          customerEmail: state.customerInfo.email
        })
      });

      const data = await response.json();

      state.isTyping = false;

      if (response.ok) {
        addMessage('assistant', data.message);
      } else {
        addMessage('assistant', 'Sorry, I encountered an error. Please try again.');
      }
    } catch (error) {
      state.isTyping = false;
      addMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again.');
      console.error('Chat error:', error);
    }
  }

  // Scroll to bottom of messages
  function scrollToBottom() {
    const container = document.getElementById('mitch-messages');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // Escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Public API
  window.MitchChat = {
    open: () => {
      const window = document.querySelector('.mitch-chat-window');
      if (window) toggleChat(window, true);
    },
    close: () => {
      const window = document.querySelector('.mitch-chat-window');
      if (window) toggleChat(window, false);
    },
    setCustomer: (info) => {
      state.customerInfo = info;
    },
    clearHistory: () => {
      state.messages = [];
      localStorage.removeItem(`mitch_chat_messages_${config.tenantSlug}`);
      renderMessages();
      addMessage('assistant', config.greeting);
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
