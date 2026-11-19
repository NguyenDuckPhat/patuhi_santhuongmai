let socket = null;
let activeConversationId = null;
let myUser = null;
let readStatusSyncTimer = null;
let chatAudioContext = null;
let chatSoundEnabled = localStorage.getItem('chatSoundEnabled') === 'true';
let chatSoundReady = false;

// Quản lý phân trang tin nhắn
let currentChatPage = 1;
let hasMoreMessages = false;
let isLoadingMore = false;

document.addEventListener('DOMContentLoaded', async () => {
  updateChatSoundButton();
  const enableSoundAfterGesture = () => {
    unlockChatSound();
    document.removeEventListener('pointerdown', enableSoundAfterGesture);
    document.removeEventListener('keydown', enableSoundAfterGesture);
  };
  document.addEventListener('pointerdown', enableSoundAfterGesture);
  document.addEventListener('keydown', enableSoundAfterGesture);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && chatSoundEnabled && chatSoundReady) {
      getChatAudioContext()?.resume();
    }
  });

  myUser = await PatuhiApp.checkAuth();
  if (!myUser) {
    window.location.href = '/login?redirect=/chat';
    return;
  }

  // Khởi tạo Socket.io
  if (typeof io !== 'undefined') {
    socket = io();
    socket.on('receive_message', (msg) => {
      if (Number(msg.sender_id) !== Number(myUser.id)) playIncomingMessageSound();
      if (Number(msg.conversation_id) === Number(activeConversationId)) {
        appendMessage(msg);
        if (Number(msg.sender_id) !== Number(myUser.id)) {
          markConversationAsRead(activeConversationId);
        }
      }
      updateConversationLastMessage(msg.conversation_id, msg.content);
    });
    socket.on('messages_read', ({ conversationId, readerId }) => {
      if (Number(conversationId) === Number(activeConversationId) && Number(readerId) !== Number(myUser.id)) {
        markMyMessagesAsRead();
      }
    });
    socket.on('message_recalled', ({ conversationId, messageId, content }) => {
      if (Number(conversationId) === Number(activeConversationId)) {
        applyMessageRecalled(messageId, content);
      }
      const lastMsgElem = document.getElementById(`conv-lastmsg-${conversationId}`);
      if (lastMsgElem) lastMsgElem.innerText = content || 'Tin nhắn đã được thu hồi';
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

function getChatAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!chatAudioContext) chatAudioContext = new AudioContextClass();
  return chatAudioContext;
}

function updateChatSoundButton() {
  const button = document.getElementById('toggle-chat-sound');
  if (!button) return;
  const label = chatSoundEnabled ? 'Tắt âm báo tin nhắn' : 'Bật âm báo tin nhắn';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<i class="bi ${chatSoundEnabled ? 'bi-volume-up-fill' : 'bi-volume-mute-fill'}" aria-hidden="true"></i>`;
}

async function unlockChatSound() {
  const audioContext = getChatAudioContext();
  if (!audioContext) return false;
  try {
    if (audioContext.state !== 'running') await audioContext.resume();
    chatSoundReady = audioContext.state === 'running';
    return chatSoundReady;
  } catch (error) {
    chatSoundReady = false;
    return false;
  }
}

async function toggleChatSound() {
  chatSoundEnabled = !chatSoundEnabled;
  localStorage.setItem('chatSoundEnabled', String(chatSoundEnabled));
  updateChatSoundButton();
  if (!chatSoundEnabled) return;

  const unlocked = await unlockChatSound();
  if (unlocked) {
    await playIncomingMessageSound();
    PatuhiApp.showToast('Đã bật âm báo. Đây là tiếng thử.', 'success');
  } else {
    chatSoundEnabled = false;
    localStorage.setItem('chatSoundEnabled', 'false');
    updateChatSoundButton();
    PatuhiApp.showToast('Trình duyệt chưa cho phép phát âm thanh. Hãy bấm nút loa để thử lại.', 'warning');
  }
}

async function playIncomingMessageSound() {
  if (!chatSoundEnabled || !chatSoundReady) return;
  const audioContext = getChatAudioContext();
  if (!audioContext) return;
  if (audioContext.state !== 'running' && !(await unlockChatSound())) return;

  const now = audioContext.currentTime;
  const notes = [
    { frequency: 784, start: 0, duration: 0.22, volume: 0.16 },
    { frequency: 1046.5, start: 0.13, duration: 0.34, volume: 0.12 }
  ];

  notes.forEach(({ frequency, start, duration, volume }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const noteStart = now + start;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(volume, noteStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + duration + 0.02);
  });
}

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
  if (readStatusSyncTimer) {
    clearInterval(readStatusSyncTimer);
    readStatusSyncTimer = null;
  }
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

  currentChatPage = 1;
  hasMoreMessages = false;

  try {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages?page=1&limit=20`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (!res.ok) {
      messagesContainer.innerHTML = `<div class="p-3 text-danger">${json.message}</div>`;
      return;
    }

    const { conversation, messages, pagination } = json.data;
    hasMoreMessages = pagination?.hasMore || false;
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
    const btnAttach = document.getElementById('btn-attach-image');
    if (btnAttach) btnAttach.disabled = false;
    cancelImagePreview();
    document.getElementById('message-input').focus();

    // Render messages
    if (!messages || messages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="text-center py-5 text-muted">
          <p class="mb-0">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
        </div>
      `;
    } else {
      messagesContainer.innerHTML = `
        <div id="load-more-container" class="text-center py-2 ${hasMoreMessages ? '' : 'd-none'}">
          <button type="button" class="btn btn-sm btn-outline-secondary rounded-pill px-3" id="btn-load-more" onclick="loadMoreMessages()">
            <i class="bi bi-arrow-up-circle me-1"></i> Tải tin nhắn cũ hơn
          </button>
        </div>
      `;
      messages.forEach(m => {
        const bubble = createMessageElement(m);
        if (bubble) messagesContainer.appendChild(bubble);
      });
      scrollToBottom();
    }
    refreshReadStatus(conversationId);
    readStatusSyncTimer = setInterval(() => refreshReadStatus(conversationId), 2000);
  } catch (err) {
    messagesContainer.innerHTML = '<div class="p-3 text-danger">Lỗi kết nối tải tin nhắn.</div>';
  }
}

let selectedChatImage = null;

function handleImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    PatuhiApp.showToast('Vui lòng chọn file hình ảnh hợp lệ (JPG, PNG, WebP...)!', 'warning');
    event.target.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    PatuhiApp.showToast('Kích thước ảnh tối đa là 5MB!', 'warning');
    event.target.value = '';
    return;
  }

  selectedChatImage = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('image-preview').src = e.target.result;
    document.getElementById('image-preview-name').textContent = file.name;
    const previewContainer = document.getElementById('image-preview-container');
    previewContainer.classList.remove('d-none');
    previewContainer.classList.add('d-flex');
  };
  reader.readAsDataURL(file);
}

function cancelImagePreview() {
  selectedChatImage = null;
  const input = document.getElementById('chat-image-input');
  if (input) input.value = '';
  const previewContainer = document.getElementById('image-preview-container');
  if (previewContainer) {
    previewContainer.classList.add('d-none');
    previewContainer.classList.remove('d-flex');
  }
  const previewImg = document.getElementById('image-preview');
  if (previewImg) previewImg.src = '';
  const previewName = document.getElementById('image-preview-name');
  if (previewName) previewName.textContent = '';
}

function createMessageElement(message) {
  const isMine = message.sender_id === myUser.id;
  const messageId = Number(message.id);
  if (Number.isFinite(messageId) && document.getElementById(`message-${messageId}`)) return null;

  const createdAt = message.created_at || message.createdAt || message.timestamp;
  const parsedDate = createdAt ? new Date(createdAt) : null;
  const timeLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : 'Vừa xong';
  const isRead = message.is_read === true || message.is_read === 1;

  const imageHtml = message.image_url ? `
    <div class="message-image mb-2">
      <a href="${message.image_url}" target="_blank" rel="noopener noreferrer">
        <img src="${message.image_url}" class="rounded img-fluid border" style="max-height: 220px; max-width: 280px; object-fit: cover; cursor: pointer;" alt="Ảnh tin nhắn" loading="lazy">
      </a>
    </div>
  ` : '';
  const contentHtml = message.content ? `<div>${escapeHtml(message.content)}</div>` : '';

  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${isMine ? 'sent' : 'received'}${message.is_recalled ? ' recalled' : ''}`;
  bubble.id = `message-${messageId}`;
  bubble.innerHTML = `
    ${imageHtml}
    ${contentHtml}
    <div class="msg-meta d-flex align-items-center text-muted small mt-1">
      <span class="msg-time me-2">${timeLabel}</span>
      ${isMine ? `<span class="message-read-status" data-message-id="${messageId}" data-message-read="${isRead}">${isRead ? 'Đã xem' : 'Chưa xem'}</span>` : ''}
    </div>
  `;

  // Thêm nút Thu hồi nếu là tin của mình và chưa được thu hồi
  if (isMine && !message.is_recalled) {
    const recallBtn = document.createElement('button');
    recallBtn.className = 'btn btn-sm btn-link text-decoration-none recall-btn';
    recallBtn.dataset.messageId = messageId;
    recallBtn.textContent = 'Thu hồi';
    recallBtn.title = 'Thu hồi tin nhắn này';
    recallBtn.style.marginLeft = '8px';
    bubble.appendChild(recallBtn);
  }

  return bubble;
}

// Xử lý click vào nút Thu hồi (delegated)
function setupRecallButtonHandler() {
  document.addEventListener('click', async (e) => {
    const target = e.target;
    if (target && target.matches('.recall-btn')) {
      const messageId = target.dataset.messageId;
      if (!messageId) return;
      if (!confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) return;
      try {
        const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages/${messageId}/recall`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const json = await res.json();
        if (res.ok) {
          // UI sẽ được cập nhật qua socket 'message_recalled' hoặc ngay tại đây
          applyMessageRecalled(messageId, json.data.message.content);
        } else {
          PatuhiApp.showToast(json.message || 'Không thể thu hồi tin nhắn.', 'danger');
        }
      } catch (err) {
        PatuhiApp.showToast('Lỗi khi thu hồi tin nhắn.', 'danger');
      }
    }
  });
}

// Cập nhật giao diện khi nhận socket event hoặc khi recall thành công
function applyMessageRecalled(messageId, newContent) {
  const msgElem = document.getElementById(`message-${messageId}`);
  if (!msgElem) return;
  // Đánh dấu đã thu hồi
  msgElem.classList.add('recalled');
  // Xóa nút recall nếu còn
  const recallBtn = msgElem.querySelector('.recall-btn');
  if (recallBtn) recallBtn.remove();
  // Xóa ảnh nếu có
  const imgDiv = msgElem.querySelector('.message-image');
  if (imgDiv) imgDiv.remove();
  // Cập nhật nội dung
  const contentDiv = msgElem.querySelector('div'); // first div is content or image; we replace innerHTML
  if (contentDiv) {
    contentDiv.innerHTML = `<div>${escapeHtml(newContent)}</div>`;
  } else {
    // If no content element, create one
    const newDiv = document.createElement('div');
    newDiv.innerHTML = `<div>${escapeHtml(newContent)}</div>`;
    msgElem.prepend(newDiv);
  }
}


document.addEventListener('DOMContentLoaded', async () => {
  // existing initialization code ... (will be earlier in file)
  if (isMine && !message.is_recalled) {
    const recallBtn = document.createElement('button');
    recallBtn.className = 'btn btn-sm btn-link text-decoration-none recall-btn';
    recallBtn.dataset.messageId = messageId;
    recallBtn.textContent = 'Thu hồi';
    recallBtn.title = 'Thu hồi tin nhắn này';
    recallBtn.style.marginLeft = '8px';
    bubble.appendChild(recallBtn);
  }

  return bubble;
}
  const isMine = message.sender_id === myUser.id;
  const messageId = Number(message.id);
  if (Number.isFinite(messageId) && document.getElementById(`message-${messageId}`)) return null;

  const createdAt = message.created_at || message.createdAt || message.timestamp;
  const parsedDate = createdAt ? new Date(createdAt) : null;
  const timeLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : 'Vừa xong';
  const isRead = message.is_read === true || message.is_read === 1;

  const imageHtml = message.image_url ? `
    <div class="message-image mb-2">
      <a href="${message.image_url}" target="_blank" rel="noopener noreferrer">
        <img src="${message.image_url}" class="rounded img-fluid border" style="max-height: 220px; max-width: 280px; object-fit: cover; cursor: pointer;" alt="Ảnh tin nhắn" loading="lazy">
      </a>
    </div>
  ` : '';

  const contentHtml = message.content ? `<div>${escapeHtml(message.content)}</div>` : '';

  const div = document.createElement('div');
  div.className = `msg-bubble ${isMine ? 'sent' : 'received'}`;
  if (Number.isFinite(messageId)) div.id = `message-${messageId}`;
  div.innerHTML = `
    ${imageHtml}
    ${contentHtml}
    <div class="text-end" style="font-size: 10px; opacity: 0.8; margin-top: 4px;">
      ${timeLabel}
      ${isMine ? `<span class="message-read-status ms-1" data-message-id="${messageId}" data-message-read="${isRead}">${isRead ? 'Đã xem' : 'Chưa xem'}</span>` : ''}
    </div>
  `;
  return div;
}

function appendMessage(message) {
  const container = document.getElementById('messages-container');
  const bubble = createMessageElement(message);
  if (bubble) {
    container.appendChild(bubble);
    scrollToBottom();
  }
}

async function loadMoreMessages() {
  if (isLoadingMore || !hasMoreMessages || !activeConversationId) return;

  const btn = document.getElementById('btn-load-more');
  const originalText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Đang tải...';
  }
  isLoadingMore = true;

  try {
    const nextPage = currentChatPage + 1;
    const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages?page=${nextPage}&limit=20`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (res.ok) {
      currentChatPage = nextPage;
      const { messages, pagination } = json.data;
      hasMoreMessages = pagination?.hasMore || false;

      const container = document.getElementById('messages-container');
      const prevScrollHeight = container.scrollHeight;

      // Chèn các tin nhắn cũ lên đầu danh sách (dưới nút load more)
      const loadMoreContainer = document.getElementById('load-more-container');
      // Duyệt ngược để giữ thứ tự từ cũ đến mới khi chèn sau loadMoreContainer
      for (let i = messages.length - 1; i >= 0; i--) {
        const bubble = createMessageElement(messages[i]);
        if (bubble) {
          if (loadMoreContainer && loadMoreContainer.nextSibling) {
            container.insertBefore(bubble, loadMoreContainer.nextSibling);
          } else {
            container.prepend(bubble);
          }
        }
      }

      // Giữ nguyên vị trí cuộn của người dùng sau khi tải thêm tin cũ
      container.scrollTop = container.scrollHeight - prevScrollHeight;

      if (!hasMoreMessages && loadMoreContainer) {
        loadMoreContainer.classList.add('d-none');
      }
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi khi tải thêm tin nhắn.', 'danger');
  } finally {
    isLoadingMore = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

function markMyMessagesAsRead() {
  document.querySelectorAll('.msg-bubble.sent .message-read-status').forEach((status) => {
    status.dataset.messageRead = 'true';
    status.textContent = 'Đã xem';
  });
}

async function refreshReadStatus(conversationId) {
  try {
    const res = await fetch(`/api/chat/conversations/${conversationId}/read-status`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    if (!res.ok || Number(conversationId) !== Number(activeConversationId)) return;

    const json = await res.json();
    const readIds = new Set(json.data.readMessageIds.map(Number));
    document.querySelectorAll('.msg-bubble.sent .message-read-status').forEach((status) => {
      if (readIds.has(Number(status.dataset.messageId))) {
        status.dataset.messageRead = 'true';
        status.textContent = 'Đã xem';
      }
    });
  } catch (error) {
    console.error('Không thể đồng bộ trạng thái đã xem:', error);
  }
}

async function markConversationAsRead(conversationId) {
  try {
    await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
  } catch (error) {
    console.error('Không thể cập nhật trạng thái đã xem:', error);
  }
}

async function handleSendMessage(e) {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  if ((!content && !selectedChatImage) || !activeConversationId) return;

  const imageToSend = selectedChatImage;
  input.value = '';
  cancelImagePreview();

  try {
    let res;
    if (imageToSend) {
      const formData = new FormData();
      if (content) formData.append('content', content);
      formData.append('image', imageToSend);

      res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });
    } else {
      res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
    }

    const json = await res.json();
    if (res.ok) {
      // Nếu socket chưa kết nối, tự thêm thủ công
      if (!socket || !socket.connected) {
        appendMessage(json.data.message);
      }
      const displayLast = content || '[Hình ảnh]';
      updateConversationLastMessage(activeConversationId, displayLast);
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
