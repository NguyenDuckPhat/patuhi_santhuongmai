let socket = null;
let activeConversationId = null;
let myUser = null;
let readStatusSyncTimer = null;
let chatAudioContext = null;
let chatSoundEnabled = localStorage.getItem('chatSoundEnabled') === 'true';
let chatSoundReady = false;

document.addEventListener('DOMContentLoaded', async () => {
  updateChatSoundButton();
  setupRecallButtonHandler();
  setupChatSearch();
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
    socket = await PatuhiApp.connectNotificationSocket();
    if (!socket) socket = io({ auth: { token: localStorage.getItem('token') || '' } });
    socket.on('connect', () => {
      if (activeConversationId) socket.emit('join_conversation', activeConversationId);
    });
    socket.on('receive_message', async (msg) => {
      if (Number(msg.sender_id) !== Number(myUser.id)) playIncomingMessageSound();
      if (Number(msg.conversation_id) === Number(activeConversationId)) {
        appendMessage(msg);
        if (Number(msg.sender_id) !== Number(myUser.id)) {
          await markConversationAsRead(activeConversationId);
        }
      }
      if (Number(msg.sender_id) === Number(myUser.id) || Number(msg.conversation_id) === Number(activeConversationId)) {
        updateConversationLastMessage(msg.conversation_id, msg.content, 0);
      }
      await loadConversations();
      PatuhiApp.updateNotificationCount();
    });
    socket.on('messages_read', ({ conversationId, readerId }) => {
      if (Number(conversationId) === Number(activeConversationId) && Number(readerId) !== Number(myUser.id)) {
        markMyMessagesAsRead();
      }
    });
  }

  document.addEventListener('patuhi:new-message', async ({ detail }) => {
    if (Number(detail?.sender_id) === Number(myUser.id)) return;
    if (Number(detail?.conversation_id) === Number(activeConversationId) &&
        document.body.classList.contains('chat-conversation-active')) {
      await markConversationAsRead(activeConversationId);
    }
    await loadConversations();
  });

  document.addEventListener('patuhi:conversation-read', () => {
    loadConversations();
  });

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
      container.innerHTML = `<div class="p-3 text-danger small">${escapeHtml(json.message || 'Không thể tải cuộc trò chuyện.')}</div>`;
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
      const displayName = other.full_name || other.username || 'Người dùng';
      const unreadCount = Number(c.unread_count) || 0;
      const preview = unreadCount > 0
        ? `<strong class="conversation-unread-label">${unreadCount} tin nhắn mới</strong>`
        : escapeHtml(getConversationPreview(c.last_message));

      return `
        <div class="chat-conv-item ${Number(c.id) === Number(activeConversationId) ? 'active' : ''} ${unreadCount > 0 ? 'has-unread' : ''}"
             id="conv-item-${c.id}" onclick="selectConversation(${c.id})">
          <div class="d-flex align-items-center gap-3">
            <img src="${escapeHtml(other.avatar || '/uploads/avatars/default.png')}" class="rounded-circle" width="45" height="45" alt="" style="object-fit:cover;">
            <div class="flex-grow-1 overflow-hidden">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="fw-bold text-truncate" style="max-width: 140px;">${escapeHtml(displayName)}</span>
                <span class="text-muted" style="font-size: 11px;">${PatuhiApp.formatTimeAgo(c.last_message_at)}</span>
              </div>
              <p class="mb-0 text-muted small text-truncate conversation-preview" id="conv-lastmsg-${c.id}">${preview}</p>
              <span class="badge bg-light text-dark border small mt-1 text-truncate" style="max-width: 180px;">${escapeHtml(prod.title || 'Sản phẩm')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
    applyConversationSearch();
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
  document.body.classList.add('chat-conversation-active');
  if (socket) {
    socket.emit('join_conversation', conversationId);
  }

  // Update active styling
  document.querySelectorAll('.chat-conv-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`conv-item-${conversationId}`)?.classList.add('active');

  const messagesContainer = document.getElementById('messages-container');
  messagesContainer.innerHTML = '<div class="text-center py-5 text-muted">Đang tải tin nhắn...</div>';
  document.getElementById('message-input').disabled = true;
  document.getElementById('btn-send-msg').disabled = true;
  const attachButton = document.getElementById('btn-attach-image');
  if (attachButton) attachButton.disabled = true;
  cancelImagePreview();

  try {
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (Number(conversationId) !== Number(activeConversationId)) return;
    if (!res.ok) {
      messagesContainer.innerHTML = `<div class="p-3 text-danger">${escapeHtml(json.message || 'Không thể tải tin nhắn.')}</div>`;
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
    const productId = Number(prod.id);
    document.getElementById('chat-product-preview').innerHTML = `
      <img src="${escapeHtml(prodImg)}" class="rounded" width="35" height="35" alt="" style="object-fit:cover;">
      <div class="small">
        <a href="/product/${Number.isFinite(productId) ? productId : ''}" target="_blank" rel="noopener" class="fw-bold text-dark text-decoration-none text-truncate d-block" style="max-width: 140px;">${escapeHtml(prod.title || 'Sản phẩm')}</a>
        <span class="text-danger fw-bold">${PatuhiApp.formatPrice(prod.price)}</span>
      </div>
    `;

    // Enable input
    document.getElementById('message-input').disabled = false;
    document.getElementById('btn-send-msg').disabled = false;
    if (attachButton) attachButton.disabled = false;
    document.getElementById('message-input').focus();

    // Render messages (ignore accidental copies of the chat page markup).
    const visibleMessages = (messages || []).filter(message => !isChatPageMarkup(message.content));
    if (visibleMessages.length === 0) {
      messagesContainer.innerHTML = `
        <div class="text-center py-5 text-muted">
          <p class="mb-0">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên!</p>
        </div>
      `;
    } else {
      messagesContainer.innerHTML = '';
      visibleMessages.forEach(m => appendMessage(m));
      scrollToBottom();
    }
    await loadConversations();
    refreshReadStatus(conversationId);
    PatuhiApp.updateNotificationCount();
    readStatusSyncTimer = setInterval(() => refreshReadStatus(conversationId), 2000);
  } catch (err) {
    if (Number(conversationId) !== Number(activeConversationId)) return;
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
  if (isChatPageMarkup(message.content)) return null;

  const isMine = Number(message.sender_id) === Number(myUser.id);
  const messageId = Number(message.id);
  if (Number.isFinite(messageId) && document.getElementById(`message-${messageId}`)) return;

  const createdAt = message.created_at || message.createdAt || message.timestamp;
  const parsedDate = createdAt ? new Date(createdAt) : null;
  const timeLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? parsedDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : 'Vừa xong';
  const isRead = message.is_read === true || message.is_read === 1;

  const imageHtml = message.image_url && !message.is_recalled ? `
    <div class="message-image mb-2">
      <button type="button" class="chat-image-button border-0 p-0 bg-transparent" data-chat-image="${escapeHtml(message.image_url)}" aria-label="Mở ảnh tin nhắn">
        <img src="${escapeHtml(message.image_url)}" class="rounded img-fluid border" style="max-height: 220px; max-width: 280px; object-fit: cover; cursor: pointer;" alt="Ảnh tin nhắn" loading="lazy">
      </button>
    </div>
  ` : '';
  const contentHtml = `<div class="message-content">${escapeHtml(message.content || '')}</div>`;

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
    const imageButton = target.closest?.('.chat-image-button');
    if (imageButton) {
      openChatImageModal(imageButton.dataset.chatImage);
      return;
    }
    if (target && target.matches('.recall-btn')) {
      const messageId = target.dataset.messageId;
      const conversationId = activeConversationId;
      if (!messageId) return;
      if (!confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) return;
      try {
        const res = await fetch(`/api/chat/conversations/${conversationId}/messages/${messageId}/recall`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const json = await res.json();
        if (res.ok) {
          // UI sẽ được cập nhật qua socket 'message_recalled' hoặc ngay tại đây
          if (Number(conversationId) === Number(activeConversationId)) {
            applyMessageRecalled(messageId, json.data.message.content);
          }
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
  // Chỉ thay nội dung, giữ nguyên giờ gửi và trạng thái đã xem.
  const contentDiv = msgElem.querySelector('.message-content');
  if (contentDiv) contentDiv.textContent = newContent || 'Tin nhắn đã được thu hồi';
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
  const conversationId = activeConversationId;

  try {
    const nextPage = currentChatPage + 1;
    const res = await fetch(`/api/chat/conversations/${conversationId}/messages?page=${nextPage}&limit=20`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (Number(conversationId) !== Number(activeConversationId)) return;
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

function setupChatSearch() {
  const searchInput = document.getElementById('chat-search-input');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    applyConversationSearch();
  });
}

function applyConversationSearch() {
  const keyword = document.getElementById('chat-search-input')?.value.trim().toLocaleLowerCase('vi') || '';
  document.querySelectorAll('.chat-conv-item').forEach((item) => {
    const matches = !keyword || item.textContent.toLocaleLowerCase('vi').includes(keyword);
    item.classList.toggle('d-none', !matches);
  });
}

function backToConversations() {
  document.body.classList.remove('chat-conversation-active');
}

function openChatImageModal(imageUrl) {
  const image = document.getElementById('chat-image-modal-content');
  const modalElement = document.getElementById('chatImageModal');
  if (!image || !modalElement || !imageUrl) return;
  image.src = imageUrl;
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
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
  const conversationId = activeConversationId;
  input.value = '';
  cancelImagePreview();

  try {
    let res;
    if (imageToSend) {
      const formData = new FormData();
      if (content) formData.append('content', content);
      formData.append('image', imageToSend);

      res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: formData
      });
    } else {
      res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
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
      // HTTP xác nhận gửi thành công; createMessageElement loại tin trùng với socket.
      if (Number(conversationId) === Number(activeConversationId)) {
        appendMessage(json.data.message);
      }
      const displayLast = content || '[Hình ảnh]';
      updateConversationLastMessage(conversationId, displayLast);
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi gửi tin nhắn.', 'danger');
  }
}

function updateConversationLastMessage(convId, content, unreadCount = 0) {
  const el = document.getElementById(`conv-lastmsg-${convId}`);
  const item = document.getElementById(`conv-item-${convId}`);
  if (!el || !item) return;

  const unread = Number(unreadCount) || 0;
  item.classList.toggle('has-unread', unread > 0);
  if (unread > 0) {
    el.textContent = `${unread} tin nhắn mới`;
    el.classList.add('conversation-unread-label');
    el.classList.remove('text-muted');
    return;
  }

  el.textContent = getConversationPreview(content);
  el.classList.remove('conversation-unread-label');
  el.classList.add('text-muted');
}

function isChatPageMarkup(content) {
  if (typeof content !== 'string') return false;
  const markup = content
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .toLowerCase();
  return /<div\b[^>]*\bid=["']chat-box-wrapper["']/.test(markup) &&
    /\bid=["']messages-container["']/.test(markup) &&
    /\bid=["']message-form["']/.test(markup);
}

function getConversationPreview(content) {
  if (isChatPageMarkup(content)) return 'Tin nhắn không khả dụng';
  return content || '...';
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
