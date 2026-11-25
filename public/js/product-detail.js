let currentProduct = null;
let sellerPhone = '';
let commentProductId = null;
// Đơn hàng ảo: chỉ tồn tại trong bộ nhớ JS của trang, không lưu DB / không gọi API.
let virtualOrder = null;

document.addEventListener('DOMContentLoaded', () => {
  resetVirtualOrderState();

  document.getElementById('price-offer-amount')?.addEventListener('input', (event) => {
    event.currentTarget.setCustomValidity('');
  });

  // Xóa lỗi validate cũ khi người dùng nhập lại (đơn đặt)
  for (const id of ['virtual-order-name', 'virtual-order-phone', 'virtual-order-address', 'virtual-order-quantity']) {
    document.getElementById(id)?.addEventListener('input', (event) => {
      event.currentTarget.setCustomValidity('');
    });
  }
  document.getElementById('virtual-order-quantity')?.addEventListener('input', updateVirtualOrderTotal);

  const urlParts = window.location.pathname.split('/');
  const productId = urlParts[urlParts.length - 1];
  if (productId) {
    loadProductDetail(productId);
  }
});

// Trình duyệt có thể khôi phục trạng thái từ back/forward cache: xóa sạch đơn đặt.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) resetVirtualOrderState();
});

async function loadProductDetail(id) {
  try {
    const res = await fetch(`/api/products/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });

    const json = await res.json();
    if (!res.ok) {
      document.getElementById('detail-loading').innerHTML = `
        <div class="alert alert-danger mx-auto max-w-500">
          <i class="bi bi-exclamation-circle me-2"></i>${json.message || 'Không thể tải tin đăng.'}
          <div class="mt-3"><a href="/" class="btn btn-sm btn-outline-danger">Quay lại trang chủ</a></div>
        </div>
      `;
      return;
    }

    const { product, relatedProducts } = json.data;
    currentProduct = product;

    // Render UI Elements
    document.title = `${product.title} — Patuhi`;
    document.getElementById('breadcrumb-title').innerText = product.title;
    if (product.category) {
      document.getElementById('breadcrumb-category').innerText = product.category.name;
    }

    document.getElementById('detail-title').innerText = product.title;
    document.getElementById('detail-price').innerText = PatuhiApp.formatPrice(product.price);
    document.getElementById('detail-location').innerText = product.location;
    document.getElementById('detail-time').innerText = PatuhiApp.formatTimeAgo(product.created_at || product.createdAt);
    document.getElementById('detail-views').innerText = product.views;
    document.getElementById('detail-description').innerText = product.description;
    for (const field of ['brand', 'model']) {
      const value = product[field];
      document.getElementById(`detail-${field}-row`).hidden = !value;
      document.getElementById(`detail-${field}`).innerText = value || '';
    }

    // Condition
    const condElem = document.getElementById('detail-condition');
    if (product.condition === 'new') {
      condElem.innerText = 'Mới 100%';
      condElem.className = 'badge bg-success condition-badge';
    } else if (product.condition === 'like_new') {
      condElem.innerText = 'Như mới 99%';
      condElem.className = 'badge bg-info text-dark condition-badge';
    } else if (product.condition === 'other') {
      condElem.innerText = product.condition_detail || 'Tình trạng khác';
      condElem.className = 'badge bg-secondary condition-badge';
    } else {
      condElem.innerText = 'Đã qua sử dụng';
      condElem.className = 'badge bg-secondary condition-badge';
    }

    // Favorite Button Status
    updateFavoriteButton(product.is_favorited);

    // Gallery
    const images = product.images && product.images.length > 0
      ? product.images
      : [{ image_url: 'https://placehold.co/600x400?text=Khong+co+anh' }];

    document.getElementById('detail-main-img').src = images[0].image_url;

    const thumbContainer = document.getElementById('detail-thumbnails');
    thumbContainer.innerHTML = images.map((img, idx) => `
      <img src="${img.image_url}" class="thumb-img ${idx === 0 ? 'active' : ''}" 
           onclick="changeMainImage('${img.image_url}', this)" onerror="this.src='https://placehold.co/100x100?text=Anh'">
    `).join('');

    // Seller Info
    renderSeller(product);
    document.getElementById('comment-rating-row').hidden = product.is_owner || product.status !== 'approved';

    // Action Buttons (Chat & Edit)
    const actionContainer = document.getElementById('detail-action-buttons');
    if (product.is_owner) {
      actionContainer.innerHTML = `
        <a href="/post?edit=${product.id}" class="btn btn-warning text-dark fw-bold py-2 rounded-pill">
          <i class="bi bi-pencil-square me-1"></i> Chỉnh sửa tin đăng này
        </a>
      `;
    } else {
      actionContainer.innerHTML = `
        <button class="btn btn-primary fw-bold py-2 rounded-pill" onclick="startChatWithSeller()">
          <i class="bi bi-chat-dots-fill me-1"></i> Chat với người bán
        </button>
        <button class="btn btn-warning text-dark fw-bold py-2 rounded-pill" onclick="openVirtualOrderModal()">
          <i class="bi bi-bag-check me-1"></i> Tạo đơn đặt (trải nghiệm)
        </button>
      `;
      document.getElementById('price-negotiation').hidden = false;
    }

    // Show containers
    document.getElementById('detail-loading').classList.add('d-none');
    document.getElementById('col-left').classList.remove('d-none');
    document.getElementById('col-right').classList.remove('d-none');
    initComments(product.id);

    // Related Products
    if (relatedProducts && relatedProducts.length > 0) {
      document.getElementById('related-section').classList.remove('d-none');
      document.getElementById('related-list').innerHTML = relatedProducts.map(rp => {
        const img = rp.images && rp.images[0] ? rp.images[0].image_url : 'https://placehold.co/300x200';
        return `
          <div class="col">
            <div class="product-card">
              <div class="product-img-wrapper">
                <a href="/product/${rp.id}"><img src="${img}" alt="${rp.title}"></a>
              </div>
              <div class="p-3">
                <h6 class="fw-bold mb-1 text-truncate"><a href="/product/${rp.id}" class="text-dark text-decoration-none">${rp.title}</a></h6>
                <div class="product-price small">${PatuhiApp.formatPrice(rp.price)}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Lỗi chi tiết:', err);
  }
}

async function renderSeller(product) {
  const seller = product.seller || {};
  const name = seller.full_name || seller.username || 'Người bán';
  const initials = document.getElementById('seller-initials');
  initials.textContent = name.trim().split(/\s+/).slice(-2).map(word => Array.from(word)[0]).join('').toUpperCase();
  const avatar = document.getElementById('seller-avatar');
  if (seller.avatar && seller.avatar !== '/uploads/avatars/default.png') {
    avatar.onload = () => { avatar.hidden = false; initials.hidden = true; };
    avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
    avatar.src = seller.avatar;
  }
  document.getElementById('seller-name').textContent = name;
  document.getElementById('seller-profile-link').href = `/profile?profile=${seller.id}`;
  const activity = document.getElementById('seller-activity');
  activity.textContent = 'Đang tải hoạt động…';
  sellerPhone = product.phone_contact || seller.phone || 'Chưa cung cấp số';

  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${seller.id}/seller`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Không thể tải người bán');
    const { last_active_at } = (await res.json()).data;
    activity.textContent = last_active_at
      ? `Hoạt động ${PatuhiApp.formatTimeAgo(last_active_at).toLowerCase()}` : 'Chưa có dữ liệu hoạt động';
  } catch (error) {
    activity.textContent = 'Không thể tải hoạt động';
  }
}

function changeMainImage(url, elem) {
  document.getElementById('detail-main-img').src = url;
  document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  elem.classList.add('active');
}

function revealPhone() {
  document.getElementById('seller-phone-text').innerText = sellerPhone;
}

// ==========================================
// ĐẶT HÀNG ẢO (KHÔNG CẦN ĐĂNG NHẬP, KHÔNG LƯU DB)
// ==========================================

function resetVirtualOrderState() {
  virtualOrder = null;

  const form = document.getElementById('virtual-order-form');
  if (form) form.reset();

  const quantity = document.getElementById('virtual-order-quantity');
  if (quantity) quantity.value = '1';

  document.getElementById('virtual-order-success')?.classList.add('d-none');
  document.getElementById('virtual-order-summary')?.replaceChildren();

  const modalEl = document.getElementById('virtualOrderModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const openModal = bootstrap.Modal.getInstance(modalEl);
    if (openModal) openModal.hide();
  }

  updateVirtualOrderTotal();
}

function updateVirtualOrderTotal() {
  const totalEl = document.getElementById('virtual-order-total');
  if (!totalEl) return;

  const unitPrice = Number(currentProduct?.price) || 0;
  const rawQuantity = parseInt(document.getElementById('virtual-order-quantity')?.value, 10);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1;
  totalEl.textContent = PatuhiApp.formatPrice(unitPrice * quantity);
}

function openVirtualOrderModal() {
  if (!currentProduct) {
    PatuhiApp.showToast('Thông tin sản phẩm chưa sẵn sàng.', 'warning');
    return;
  }

  const images = currentProduct.images && currentProduct.images.length
    ? currentProduct.images
    : [{ image_url: 'https://placehold.co/80x80?text=Khong+co+anh' }];

  const imageEl = document.getElementById('virtual-order-image');
  if (imageEl) imageEl.src = images[0].image_url;

  const productEl = document.getElementById('virtual-order-product');
  if (productEl) productEl.textContent = currentProduct.title;

  const unitPriceEl = document.getElementById('virtual-order-unit-price');
  if (unitPriceEl) unitPriceEl.textContent = `${PatuhiApp.formatPrice(currentProduct.price)} / sản phẩm`;

  // Mỗi lần mở luôn bắt đầu từ form trống; không đọc localStorage/sessionStorage.
  document.getElementById('virtual-order-form')?.reset();
  const quantityEl = document.getElementById('virtual-order-quantity');
  if (quantityEl) quantityEl.value = '1';
  for (const id of ['virtual-order-name', 'virtual-order-phone', 'virtual-order-address', 'virtual-order-quantity']) {
    document.getElementById(id)?.setCustomValidity('');
  }
  document.getElementById('virtual-order-success')?.classList.add('d-none');
  document.getElementById('virtual-order-summary')?.replaceChildren();
  updateVirtualOrderTotal();

  const modalEl = document.getElementById('virtualOrderModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

function confirmVirtualOrder(event) {
  event.preventDefault();
  if (!currentProduct) return;

  const nameEl = document.getElementById('virtual-order-name');
  const phoneEl = document.getElementById('virtual-order-phone');
  const addressEl = document.getElementById('virtual-order-address');
  const quantityEl = document.getElementById('virtual-order-quantity');

  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  const address = addressEl.value.trim();
  const note = document.getElementById('virtual-order-note')?.value.trim() || '';
  const quantity = parseInt(quantityEl.value, 10);

  if (!name) {
    nameEl.setCustomValidity('Vui lòng nhập họ tên người nhận.');
    nameEl.reportValidity();
    return;
  }
  if (!phone) {
    phoneEl.setCustomValidity('Vui lòng nhập số điện thoại.');
    phoneEl.reportValidity();
    return;
  }
  if (!address) {
    addressEl.setCustomValidity('Vui lòng nhập địa chỉ nhận hàng.');
    addressEl.reportValidity();
    return;
  }
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > 99) {
    quantityEl.setCustomValidity('Số lượng phải từ 1 đến 99.');
    quantityEl.reportValidity();
    return;
  }

  const unitPrice = Number(currentProduct.price) || 0;
  const images = currentProduct.images && currentProduct.images.length
    ? currentProduct.images
    : [{ image_url: 'https://placehold.co/120x120?text=Khong+co+anh' }];

  virtualOrder = {
    productTitle: currentProduct.title,
    productImage: images[0].image_url,
    quantity,
    unitPrice,
    total: unitPrice * quantity,
    customerName: name,
    phone,
    address,
    note,
    createdAt: new Date()
  };

  const modalEl = document.getElementById('virtualOrderModal');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const openModal = bootstrap.Modal.getInstance(modalEl);
    if (openModal) openModal.hide();
  }

  renderVirtualOrderResult(virtualOrder);

  // Lưu vào "kho RAM" dùng chung để mục Đơn đặt hiển thị.
  // Không fetch, không localStorage/sessionStorage, không ghi Database.
  if (typeof PatuhiApp !== 'undefined' && typeof PatuhiApp.addTempOrder === 'function') {
    PatuhiApp.addTempOrder(virtualOrder);
  }

  // Dọn form nhưng vẫn giữ panel kết quả hiển thị.
  document.getElementById('virtual-order-form')?.reset();
  if (quantityEl) quantityEl.value = '1';
  updateVirtualOrderTotal();

  PatuhiApp.showToast('Đơn đặt đã được tạo! (chỉ trên trình duyệt, không lưu hệ thống)', 'success');
}

function renderVirtualOrderResult(order) {
  const summary = document.getElementById('virtual-order-summary');
  const successPanel = document.getElementById('virtual-order-success');
  if (!summary || !successPanel) return;

  summary.replaceChildren();
  const addRow = (label, value) => {
    const row = document.createElement('div');
    row.className = 'd-flex justify-content-between gap-3 py-1 border-bottom border-light';
    const labelEl = document.createElement('span');
    labelEl.className = 'text-muted text-nowrap';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'fw-semibold text-end text-break';
    valueEl.textContent = value;
    row.append(labelEl, valueEl);
    summary.appendChild(row);
  };

  addRow('Sản phẩm', order.productTitle);
  addRow('Số lượng', String(order.quantity));
  addRow('Đơn giá', PatuhiApp.formatPrice(order.unitPrice));
  addRow('Tổng tiền', PatuhiApp.formatPrice(order.total));
  addRow('Người nhận', order.customerName);
  addRow('Điện thoại', order.phone);
  addRow('Địa chỉ', order.address);
  addRow('Ghi chú', order.note || 'Không có');
  addRow('Thời gian', order.createdAt.toLocaleString('vi-VN'));

  successPanel.classList.remove('d-none');
  successPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateFavoriteButton(isFav) {
  const btn = document.getElementById('btn-favorite-detail');
  if (isFav) {
    btn.className = 'btn btn-danger btn-sm rounded-pill px-3';
    btn.innerHTML = '<i class="bi bi-heart-fill me-1"></i> Đã lưu';
  } else {
    btn.className = 'btn btn-outline-danger btn-sm rounded-pill px-3';
    btn.innerHTML = '<i class="bi bi-heart me-1"></i> Lưu tin';
  }
}

async function handleDetailFavorite() {
  if (!currentProduct) return;
  if (!PatuhiApp.currentUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để lưu tin yêu thích!', 'warning');
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1200);
    return;
  }

  const isFav = currentProduct.is_favorited;
  const method = isFav ? 'DELETE' : 'POST';

  try {
    const res = await fetch(`/api/favorites/${currentProduct.id}`, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      }
    });
    const json = await res.json();
    if (res.ok) {
      currentProduct.is_favorited = !isFav;
      updateFavoriteButton(currentProduct.is_favorited);
      PatuhiApp.showToast(json.message, 'success');
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi mạng kết nối.', 'danger');
  }
}

async function startChatWithSeller() {
  if (!PatuhiApp.currentUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để gửi tin nhắn cho người bán!', 'warning');
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1200);
    return;
  }

  try {
    const res = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productId: currentProduct.id })
    });
    const json = await res.json();
    if (res.ok) {
      window.location.href = `/chat?conversationId=${json.data.conversationId}`;
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Không thể mở cuộc trò chuyện lúc này.', 'danger');
  }
}

function openPriceOfferModal() {
  if (!PatuhiApp.currentUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để thương lượng giá!', 'warning');
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1000);
    return;
  }

  document.getElementById('offer-listed-price').textContent = PatuhiApp.formatPrice(currentProduct.price);
  const amountInput = document.getElementById('price-offer-amount');
  amountInput.value = '';
  amountInput.max = Math.floor(Number(currentProduct.price));
  bootstrap.Modal.getOrCreateInstance(document.getElementById('priceOfferModal')).show();
}

async function submitPriceOffer(event) {
  event.preventDefault();
  if (!currentProduct || !PatuhiApp.currentUser) return;

  const amountInput = document.getElementById('price-offer-amount');
  const amount = Number(amountInput.value);
  const listedPrice = Number(currentProduct.price);
  if (!Number.isFinite(amount) || amount < 1000 || amount >= listedPrice) {
    amountInput.setCustomValidity('Giá đề nghị phải thấp hơn giá niêm yết.');
    amountInput.reportValidity();
    return;
  }
  amountInput.setCustomValidity('');

  const submitButton = document.getElementById('btn-send-price-offer');
  submitButton.disabled = true;
  try {
    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
      'Content-Type': 'application/json'
    };
    const conversationRes = await fetch('/api/chat/conversations', {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId: currentProduct.id })
    });
    const conversationJson = await conversationRes.json();
    if (!conversationRes.ok) {
      PatuhiApp.showToast(conversationJson.message || 'Không thể mở cuộc trò chuyện.', 'danger');
      return;
    }

    const content = `Đề nghị giá ${PatuhiApp.formatPrice(amount)} cho sản phẩm "${currentProduct.title}" (giá niêm yết ${PatuhiApp.formatPrice(listedPrice)}).`;
    const messageRes = await fetch(`/api/chat/conversations/${conversationJson.data.conversationId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ content })
    });
    const messageJson = await messageRes.json();
    if (!messageRes.ok) {
      PatuhiApp.showToast(messageJson.message || 'Không gửi được đề nghị giá.', 'danger');
      return;
    }

    bootstrap.Modal.getInstance(document.getElementById('priceOfferModal'))?.hide();
    window.location.href = `/chat?conversationId=${conversationJson.data.conversationId}`;
  } catch (error) {
    PatuhiApp.showToast('Lỗi kết nối khi gửi đề nghị giá.', 'danger');
  } finally {
    submitButton.disabled = false;
  }
}

async function submitReport(event) {
  event.preventDefault();
  if (!PatuhiApp.currentUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để gửi báo cáo vi phạm!', 'warning');
    return;
  }

  const reason = document.querySelector('input[name="reportReason"]:checked')?.value;
  const description = document.getElementById('report-description').value;

  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        product_id: currentProduct.id,
        reason,
        description
      })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      const modal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
      if (modal) modal.hide();
      document.getElementById('report-form').reset();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi khi gửi báo cáo.', 'danger');
  }
}
// ==========================================
// BÌNH LUẬN SẢN PHẨM (chỉ hiển thị bình luận đã được Admin duyệt)
// ==========================================

function setCommentAvatar(imageElement, name) {
  imageElement.onerror = function () {
    this.onerror = null;
    this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=ff8800&color=fff`;
  };
}

function buildCommentElement(comment) {
  const user = comment.user || {};
  const displayName = user.full_name || user.username || 'Người dùng';

  const item = document.createElement('div');
  item.className = 'comment-item';

  const header = document.createElement('div');
  header.className = 'd-flex align-items-center gap-2 mb-2';

  const avatar = document.createElement('img');
  avatar.className = 'rounded-circle comment-avatar';
  avatar.width = 42;
  avatar.height = 42;
  avatar.alt = 'Avatar người bình luận';
  avatar.src = user.avatar || '/uploads/avatars/default.png';
  setCommentAvatar(avatar, displayName);

  const info = document.createElement('div');
  const name = document.createElement('div');
  name.className = 'fw-semibold small';
  name.textContent = displayName;
  const time = document.createElement('div');
  time.className = 'text-muted small';
  time.textContent = PatuhiApp.formatTimeAgo(comment.created_at || comment.createdAt);
  info.append(name, time);
  if (comment.rating) {
    const rating = document.createElement('div');
    rating.className = 'text-warning-emphasis small';
    rating.textContent = `★ ${comment.rating}/5`;
    info.append(rating);
  }

  header.append(avatar, info);
  item.appendChild(header);

  const content = document.createElement('div');
  content.className = 'comment-content text-secondary';
  content.textContent = comment.content || '';
  item.appendChild(content);

  return item;
}

function renderCommentAuth() {
  const user = PatuhiApp.currentUser;
  const form = document.getElementById('comment-form');
  const guest = document.getElementById('comment-guest');

  if (user) {
    form.classList.remove('d-none');
    guest.classList.add('d-none');
    const avatar = document.getElementById('comment-avatar');
    avatar.src = user.avatar || '/uploads/avatars/default.png';
    setCommentAvatar(avatar, user.full_name || user.username);
    document.getElementById('comment-user-name').textContent = user.full_name || user.username || '';
  } else {
    form.classList.add('d-none');
    guest.classList.remove('d-none');
    document.getElementById('comment-login-link').href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
  }
}

async function loadComments(productId) {
  const list = document.getElementById('comment-list');
  const empty = document.getElementById('comment-empty');

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(productId)}/comments`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (!res.ok) {
      list.textContent = 'Không thể tải bình luận lúc này.';
      document.getElementById('comment-total').textContent = '0 bình luận';
      return;
    }

    const { comments = [], total = 0 } = json.data || {};
    document.getElementById('comment-total').textContent = `${total} bình luận`;
    list.replaceChildren();
    comments.forEach(comment => list.appendChild(buildCommentElement(comment)));
    empty.classList.toggle('d-none', comments.length > 0);
  } catch (e) {
    list.textContent = 'Không thể tải bình luận lúc này.';
  }
}

async function initComments(productId) {
  // main.js cũng gọi checkAuth(); gọi lại ở đây để đảm bảo có trạng thái đăng nhập
  // trước khi quyết định hiển thị form hay thông báo yêu cầu đăng nhập.
  await PatuhiApp.checkAuth();
  commentProductId = productId;
  renderCommentAuth();

  const input = document.getElementById('comment-content');
  input.addEventListener('input', () => {
    document.getElementById('comment-counter').textContent = `${input.value.length}/1000`;
    input.setCustomValidity('');
  });

  await loadComments(productId);
}

async function submitComment(event) {
  event.preventDefault();
  if (!commentProductId || !PatuhiApp.currentUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để bình luận sản phẩm.', 'warning');
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1200);
    return;
  }

  const input = document.getElementById('comment-content');
  const content = input.value.trim();
  if (!content) {
    input.setCustomValidity('Vui lòng nhập nội dung bình luận.');
    input.reportValidity();
    return;
  }
  input.setCustomValidity('');

  const submitButton = document.getElementById('comment-submit');
  const ratingInput = document.getElementById('comment-rating');
  const rating = document.getElementById('comment-rating-row').hidden || !ratingInput.value
    ? null : Number(ratingInput.value);
  submitButton.disabled = true;

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(commentProductId)}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content, rating })
    });
    const json = await res.json();

    if (res.ok) {
      input.value = '';
      ratingInput.value = '';
      document.getElementById('comment-counter').textContent = '0/1000';
      // Không thêm bình luận vào danh sách: bình luận chỉ công khai sau khi Admin duyệt.
      PatuhiApp.showToast(
        json.message || 'Bình luận của bạn đã được gửi thành công và đang chờ quản trị viên xét duyệt.',
        'success'
      );
    } else {
      PatuhiApp.showToast(json.message || 'Không thể gửi bình luận.', 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi kết nối khi gửi bình luận.', 'danger');
  } finally {
    submitButton.disabled = false;
  }
}
