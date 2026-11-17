let socket = null;
let activeConversationId = null;
let myUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  myUser = await PatuhiApp.checkAuth();
  if (!myUser) {
    window.location.href = '/login?redirect=/chat';
    return;
  }

  // Khởi tạo Socket.io
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('receive_message', (msg) => {
      if (msg.conversation_id === activeConversationId) {
        appendMessage(msg);
      }
      updateConversationLastMessage(msg.conversation_id, msg.content);
    });
  }

  await loadConversations();

  // Kiểm tra nếu có query conversationId
  const urlParams = new URLSearchParams(window.location.search);
  const convId = urlParams.get('conversationId');
  if (convId) {
    selectConversation(parseInt(convId));
  }
});

async function loadConversations() {
  const container = document.getElementById('conversations-list');
  try {
    const res = await fetch('/api/chat/conversations', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (!res.ok) {
      container.innerHTML = `<div class="p-3 text-danger small">${json.message}</div>`;
      return;
    }

    const { conversations } = json.data;
    if (!conversations || conversations.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted px-3">
          <i class="bi bi-chat-dots fs-2 mb-2"></i>
          <h6>Chưa có tin nhắn nào!</h6>
          <p class="small">Bấm "Chat với người bán" trên trang chi tiết sản phẩm để bắt đầu trò chuyện.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = conversations.map(c => {
      const other = c.otherParty || {};
      const prod = c.product || {};
      const img = prod.images && prod.images[0] ? prod.images[0].image_url : 'https://placehold.co/50x50';

      return `
        <div class="chat-conv-item ${c.id === activeConversationId ? 'active' : ''}" 
             id="conv-item-${c.id}" onclick="selectConversation(${c.id})">
          <div class="d-flex align-items-center gap-3">
            <img src="${other.avatar || '/uploads/avatars/default.png'}" class="rounded-circle" width="45" height="45" style="object-fit:cover;">
            <div class="flex-grow-1 overflow-hidden">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-truncate" style="max-width: 140px;">${other.full_name || other.username}</span>
                <span class="text-muted" style="font-size: 11px;">${PatuhiApp.formatTimeAgo(c.last_message_at)}</span>
              </div>
              <p class="mb-0 text-muted small text-truncate" id="conv-lastmsg-${c.id}">${c.last_message || '...'}</p>
              <span class="badge bg-light text-dark border small mt-1 text-truncate" style="max-width: 180px;">${prod.title || 'Sản phẩm'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div class="p-3 text-danger small">Lỗi kết nối khi tải danh sách hội thoại.</div>';
  }
}

async function selectConversation(conversationId) {
  if (activeConversationId && socket) {
    socket.emit('leave_conversation', activeConversationId);
  }

  activeConversationId = conversationId;
  if (socket) {
    socket.emit('join_conversation', conversationId);
  }

  // Update active styling
  document.querySelectorAll('.chat-conv-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`conv-item-${conversationId}`)?.classList.add('active');

  const messagesContainer = document.getElementById('messages-container');
  messagesContainer.innerHTML = '<div class="text-center py-5 text-muted">Đang tải tin nhắn...</div>';

  try {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (!res.ok) {
      messagesContainer.innerHTML = `<div class="p-3 text-danger">${json.message}</div>`;
      return;
    }

    const { conversation, messages } = json.data;
    const other = conversation.otherParty || {};
    const prod = conversation.product || {};

    // Header info
    document.getElementById('chat-other-avatar').src = other.avatar || '/uploads/avatars/default.png';
    document.getElementById('chat-other-name').innerText = other.full_name || other.username;
    document.getElementById('chat-other-status').innerText = `@${other.username}`;

    // Product info snippet
    const prodImg = prod.images && prod.images[0] ? prod.images[0].image_url : 'https://placehold.co/40x40';
    document.getElementById('chat-product-preview').innerHTML = `
      <img src="${prodImg}" class="rounded" width="35" height="35" style="object-fit:cover;">
      <div class="small">
        <a href="/product/${prod.id}" target="_blank" class="fw-bold text-dark text-decoration-none text-truncate d-block" style="max-width: 140px;">${prod.title}</a>
        <span class="text-danger fw-bold">${PatuhiApp.formatPrice(prod.price)}</span>
      </div>
    `;

    // Enable input
    document.getElementById('message-input').disabled = false;
    document.getElementById('btn-send-msg').disabled = false;
    document.getElementById('message-input').focus();

    // Render messages
    if (!messages || messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="text-center py-5 text-muted">
          <p class="mb-0">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
        </div>
      `;
    } else {
      messagesContainer.innerHTML = '';
      messages.forEach(m => appendMessage(m));
      scrollToBottom();
    }
  } catch (err) {
    messagesContainer.innerHTML = '<div class="p-3 text-danger">Lỗi kết nối tải tin nhắn.</div>';
  }
}

function appendMessage(message) {
  const container = document.getElementById('messages-container');
  const isMine = message.sender_id === myUser.id;

  const div = document.createElement('div');
  div.className = `msg-bubble ${isMine ? 'sent' : 'received'}`;
  div.innerHTML = `
    <div>${escapeHtml(message.content)}</div>
    <div class="text-end" style="font-size: 10px; opacity: 0.8; margin-top: 4px;">
      ${new Date(message.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

async function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if (!content || !activeConversationId) return;

  input.value = '';

  try {
    const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    const json = await res.json();
    if (res.ok) {
      // Nếu socket chưa kết nối, tự thêm thủ công
      if (!socket || !socket.connected) {
        appendMessage(json.data.message);
      }
      updateConversationLastMessage(activeConversationId, content);
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi gửi tin nhắn.', 'danger');
  }
}

function updateConversationLastMessage(convId, content) {
  const el = document.getElementById(`conv-lastmsg-${convId}`);
  if (el) el.innerText = content;
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}
