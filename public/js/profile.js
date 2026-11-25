let myUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  myUser = await PatuhiApp.checkAuth();
  if (!myUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để truy cập trang cá nhân!', 'warning');
    setTimeout(() => {
      window.location.href = '/login?redirect=/profile';
    }, 1000);
    return;
  }

  renderUserData();
  loadMyListings();
  loadBuyerOrderSummary();

  // Cập nhật lại số lượng đơn mua khi quay lại tab/trang hoặc định kỳ nhẹ.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && myUser) loadBuyerOrderSummary();
  });
  window.addEventListener('focus', () => {
    if (myUser) loadBuyerOrderSummary();
  });
  setInterval(() => {
    if (myUser && !document.hidden) loadBuyerOrderSummary();
  }, 30000);

  // Deep-link từ navbar/footer: /profile?tab=buy-orders|sell-orders
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  if (requestedTab && ['buy-orders', 'sell-orders', 'info', 'password'].includes(requestedTab)) {
    switchTab(requestedTab);
  }
});

function renderUserData() {
  document.getElementById('profile-name').innerText = myUser.full_name;
  document.getElementById('profile-username').innerText = `@${myUser.username}`;
  document.getElementById('profile-role').innerText = myUser.role.toUpperCase();
  document.getElementById('profile-avatar').src = myUser.avatar || '/uploads/avatars/default.png';

  document.getElementById('info-fullname').value = myUser.full_name || '';
  document.getElementById('info-username').value = myUser.username || '';
  document.getElementById('info-email').value = myUser.email || '';
  document.getElementById('info-phone').value = myUser.phone || '';
}

function switchTab(tabName, options = {}) {
  ['listings', 'buy-orders', 'sell-orders', 'info', 'password'].forEach(t => {
    document.getElementById(`tab-content-${t}`)?.classList.add('d-none');
    document.getElementById(`tab-btn-${t}`)?.classList.remove('active');
  });

  document.getElementById(`tab-content-${tabName}`)?.classList.remove('d-none');
  document.getElementById(`tab-btn-${tabName}`)?.classList.add('active');

  // Lazy load để không gọi API đơn hàng khi người dùng không mở tab.
  if (tabName === 'buy-orders' && !options.skipLoad) loadOrders('buyer');
  if (tabName === 'sell-orders' && !options.skipLoad) loadOrders('seller');
}

// Mở tab đơn mua với một filter cụ thể (dùng cho 4 ô tổng quan).
function openBuyerOrdersWithStatus(status) {
  const select = document.getElementById('buy-order-status-filter');
  const search = document.getElementById('buy-order-search');
  if (select) select.value = status || '';
  if (search) search.value = '';
  switchTab('buy-orders', { skipLoad: true });
  loadOrders('buyer');
}

// Lấy số lượng đơn mua theo trạng thái từ backend, không dùng dữ liệu giả.
async function loadBuyerOrderSummary() {
  if (!myUser) return;

  try {
    const res = await fetch('/api/orders/buyer/summary', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    if (!res.ok) return;
    const json = await res.json();
    const data = json.data || {};

    ['pending', 'confirmed', 'shipping', 'unrated'].forEach((status) => {
      const el = document.getElementById(`buy-order-count-${status}`);
      if (el) el.textContent = String(Number(data[status]) || 0);
    });
  } catch (error) {
    // Giữ nguyên số cũ nếu mạng lỗi; không ghi số giả.
  }
}

// 1. Tải danh sách tin đăng của tôi
async function loadMyListings() {
  const container = document.getElementById('my-listings-container');
  const status = document.getElementById('my-listings-status-filter').value;

  container.innerHTML = '<div class="text-center py-4 text-muted">Đang tải tin đăng...</div>';

  try {
    const url = status ? `/api/users/my-listings?status=${status}` : '/api/users/my-listings';
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (!res.ok) {
      container.innerHTML = `<div class="alert alert-danger">${json.message}</div>`;
      return;
    }

    const { products } = json.data;
    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-folder-x fs-1 mb-2"></i>
          <h6>Bạn chưa có tin đăng nào trong danh mục này!</h6>
          <a href="/post" class="btn btn-warning btn-sm fw-bold mt-2">Đăng tin ngay</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Sản phẩm</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Ngày đăng</th>
              <th class="text-end">Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => {
              const img = p.images && p.images[0] ? p.images[0].image_url : 'https://placehold.co/80x80';
              
              let statusBadge = '';
              if (p.status === 'approved') statusBadge = '<span class="badge bg-success">Đang bán</span>';
              else if (p.status === 'pending') statusBadge = '<span class="badge bg-warning text-dark">Chờ duyệt</span>';
              else if (p.status === 'sold') statusBadge = '<span class="badge bg-info text-dark">Đã bán</span>';
              else if (p.status === 'rejected') statusBadge = `<span class="badge bg-danger" title="${p.rejection_reason || ''}">Bị từ chối</span>`;
              else if (p.status === 'hidden') statusBadge = '<span class="badge bg-secondary">Đã ẩn</span>';

              return `
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-3">
                      <img src="${img}" class="rounded" width="55" height="55" style="object-fit:cover;">
                      <div>
                        <a href="/product/${p.id}" class="fw-bold text-dark text-decoration-none d-block text-truncate" style="max-width: 250px;">
                          ${p.title}
                        </a>
                        <span class="text-muted small">${p.category ? p.category.name : ''}</span>
                      </div>
                    </div>
                  </td>
                  <td class="fw-bold text-danger text-nowrap">${PatuhiApp.formatPrice(p.price)}</td>
                  <td>${statusBadge}</td>
                  <td class="text-muted small text-nowrap">${PatuhiApp.formatTimeAgo(p.created_at || p.createdAt)}</td>
                  <td class="text-end text-nowrap">
                    <div class="dropdown d-inline-block">
                      <button class="btn btn-sm btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown">
                        Tùy chọn
                      </button>
                      <ul class="dropdown-menu dropdown-menu-end shadow border-0">
                        <li><a class="dropdown-item" href="/post?edit=${p.id}"><i class="bi bi-pencil me-2"></i>Sửa thông tin</a></li>
                        ${p.status === 'approved' ? `
                          <li><button class="dropdown-item text-primary" onclick="changeStatus(${p.id}, 'sold')"><i class="bi bi-check2-circle me-2"></i>Đánh dấu Đã bán</button></li>
                          <li><button class="dropdown-item text-secondary" onclick="changeStatus(${p.id}, 'hidden')"><i class="bi bi-eye-slash me-2"></i>Ẩn tin đăng</button></li>
                        ` : ''}
                        ${p.status === 'sold' || p.status === 'hidden' ? `
                          <li><button class="dropdown-item text-success" onclick="changeStatus(${p.id}, 'pending')"><i class="bi bi-arrow-repeat me-2"></i>Đăng bán lại</button></li>
                        ` : ''}
                        <li><hr class="dropdown-divider"></li>
                        <li><button class="dropdown-item text-danger" onclick="deleteMyProduct(${p.id})"><i class="bi bi-trash me-2"></i>Xóa tin này</button></li>
                      </ul>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi kết nối khi tải danh sách tin.</div>';
  }
}

// 2. Đổi trạng thái tin đăng (Đã bán, Ẩn)
async function changeStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/products/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadMyListings();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi thao tác đổi trạng thái.', 'danger');
  }
}

// 3. Xóa tin đăng
async function deleteMyProduct(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa vĩnh viễn tin đăng này không? Hành động này không thể hoàn tác!')) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast('Đã xóa tin đăng thành công!', 'success');
      loadMyListings();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi khi xóa tin.', 'danger');
  }
}

// 4. Cập nhật thông tin profile
async function handleUpdateProfile(e) {
  e.preventDefault();
  const full_name = document.getElementById('info-fullname').value.trim();
  const phone = document.getElementById('info-phone').value.trim();

  try {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ full_name, phone })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      myUser = json.data.user;
      localStorage.setItem('user', JSON.stringify(myUser));
      renderUserData();
      PatuhiApp.renderNavbar();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi cập nhật profile.', 'danger');
  }
}

// 5. Tải ảnh avatar mới
async function uploadUserAvatar(input) {
  if (!input.files || input.files.length === 0) return;

  const formData = new FormData();
  formData.append('avatar', input.files[0]);

  try {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: formData
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast('Đã cập nhật ảnh đại diện!', 'success');
      myUser = json.data.user;
      localStorage.setItem('user', JSON.stringify(myUser));
      document.getElementById('profile-avatar').src = myUser.avatar;
      PatuhiApp.renderNavbar();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi tải avatar.', 'danger');
  }
}

// 6. Đổi mật khẩu
async function handleChangePassword(e) {
  e.preventDefault();
  const old_password = document.getElementById('old-password').value;
  const new_password = document.getElementById('new-password').value;
  const confirm_password = document.getElementById('confirm-password').value;

  if (new_password !== confirm_password) {
    PatuhiApp.showToast('Mật khẩu mới và mật khẩu xác nhận không khớp nhau!', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/users/change-password', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ old_password, new_password })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      document.getElementById('change-password-form').reset();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi đổi mật khẩu.', 'danger');
  }
}

// ==========================================
// ĐƠN HÀNG THẬT — NGƯỜI MUA / NGƯỜI BÁN
// ==========================================

function escapeHtml(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (ch) => map[ch]);
}

function orderStatusBadge(status) {
  const classes = {
    pending: 'bg-warning text-dark',
    confirmed: 'bg-info text-dark',
    shipping: 'bg-primary',
    completed: 'bg-success',
    cancelled: 'bg-secondary'
  };
  return `<span class="badge ${classes[status] || 'bg-secondary'}">${escapeHtml(PatuhiApp.orderStatusLabel(status))}</span>`;
}

function orderRoleLabel(role) {
  const labels = { buyer: 'Người mua', seller: 'Người bán', system: 'Hệ thống' };
  return labels[role] || '';
}

async function loadOrders(scope) {
  const prefix = scope === 'seller' ? 'sell' : 'buy';
  const container = document.getElementById(`${prefix}-orders-container`);
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4 text-muted">Đang tải đơn hàng...</div>';

  const status = document.getElementById(`${prefix}-order-status-filter`)?.value || '';
  const keyword = document.getElementById(`${prefix}-order-search`)?.value.trim() || '';
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (keyword) params.set('q', keyword);
  const query = params.toString();
  const url = `/api/orders/${scope}${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();

    if (!res.ok) {
      container.innerHTML = `<div class="alert alert-danger">${escapeHtml(json.message || 'Không thể tải danh sách đơn hàng.')}</div>`;
      return;
    }

    const orders = json.data?.orders || [];
    if (orders.length === 0) {
      container.innerHTML = `
        <div class="text-center py-5 text-muted">
          <i class="bi bi-bag-x fs-1 d-block mb-3"></i>
          <h6 class="fw-semibold mb-1">Chưa có đơn hàng nào.</h6>
          <p class="small mb-0">${scope === 'seller'
            ? 'Khi có người đặt tin đăng của bạn, đơn hàng sẽ xuất hiện tại đây.'
            : 'Hãy mở một sản phẩm và bấm Đặt hàng để tạo đơn mới.'}</p>
        </div>
      `;
      return;
    }

    const partnerHeader = scope === 'seller' ? 'Người nhận' : 'Người bán';

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Mã đơn</th>
              <th>Sản phẩm</th>
              <th>Số lượng</th>
              <th>Tổng tiền</th>
              <th>Ngày đặt</th>
              <th>${partnerHeader}</th>
              <th>Trạng thái</th>
              <th class="text-end">Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map((order) => renderOrderRow(order, scope)).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (error) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi kết nối khi tải danh sách đơn hàng.</div>';
  }
}

function renderOrderRow(order, scope) {
  const image = escapeHtml(order.product_image || 'https://placehold.co/80x80?text=Anh');
  const partner = scope === 'seller' ? order.receiver_name : (order.seller_name || '—');

  const actions = [`<button class="btn btn-sm btn-outline-secondary" onclick="viewOrderDetail(${order.id})">Xem chi tiết</button>`];

  if (scope === 'buyer' && order.status === 'pending') {
    actions.push(`<button class="btn btn-sm btn-outline-danger" onclick="cancelOrder(${order.id})">Hủy đơn</button>`);
  }

  if (scope === 'buyer' && order.status === 'completed') {
    if (order.is_rated) {
      actions.push('<span class="small text-muted">Đã đánh giá</span>');
    } else if (order.product_id) {
      actions.push(`<a class="btn btn-sm btn-outline-warning text-dark" href="/product/${order.product_id}?order_id=${order.id}">Đánh giá</a>`);
    }
  }

  if (scope === 'seller') {
    if (order.status === 'pending') {
      actions.push(`<button class="btn btn-sm btn-outline-success" onclick="updateOrderStatus(${order.id}, 'confirmed')">Xác nhận</button>`);
    }
    if (order.status === 'confirmed') {
      actions.push(`<button class="btn btn-sm btn-outline-primary" onclick="updateOrderStatus(${order.id}, 'shipping')">Giao hàng</button>`);
    }
    if (order.status === 'shipping') {
      actions.push(`<button class="btn btn-sm btn-outline-success" onclick="updateOrderStatus(${order.id}, 'completed')">Hoàn thành</button>`);
    }
    if (order.status === 'pending' || order.status === 'confirmed') {
      actions.push(`<button class="btn btn-sm btn-outline-danger" onclick="updateOrderStatus(${order.id}, 'cancelled')">Hủy</button>`);
    }
  }

  return `
    <tr>
      <td class="fw-semibold text-nowrap">${escapeHtml(order.order_code)}</td>
      <td>
        <div class="d-flex align-items-center gap-3">
          <img src="${image}" class="rounded order-row-thumb" alt="Ảnh sản phẩm">
          <div class="min-width-0">
            <div class="fw-semibold text-truncate" style="max-width: 220px;">${escapeHtml(order.product_title)}</div>
            <div class="small text-danger fw-bold">${PatuhiApp.formatPrice(order.unit_price)}</div>
          </div>
        </div>
      </td>
      <td class="text-nowrap">${Number(order.quantity || 0)}</td>
      <td class="fw-bold text-danger text-nowrap">${PatuhiApp.formatPrice(order.total_amount)}</td>
      <td class="text-muted small text-nowrap">${PatuhiApp.formatTimeAgo(order.created_at)}</td>
      <td class="small">${escapeHtml(partner)}</td>
      <td>${orderStatusBadge(order.status)}</td>
      <td class="text-end text-nowrap">${actions.join(' ')}</td>
    </tr>
  `;
}

async function viewOrderDetail(id) {
  const body = document.getElementById('order-detail-body');
  const footer = document.getElementById('order-detail-footer');
  if (!body || !footer) return;

  body.innerHTML = '<div class="text-center py-4 text-muted">Đang tải chi tiết đơn...</div>';
  footer.replaceChildren();

  try {
    const res = await fetch(`/api/orders/${id}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();

    if (!res.ok) {
      body.innerHTML = `<div class="alert alert-danger">${escapeHtml(json.message || 'Không thể tải chi tiết đơn hàng.')}</div>`;
    } else {
      const { order, statusHistory } = json.data;
      body.innerHTML = renderOrderDetailHtml(order, statusHistory || []);
      footer.innerHTML = renderOrderDetailActions(order);
    }

    const modalEl = document.getElementById('orderDetailModal');
    if (modalEl && typeof bootstrap !== 'undefined') {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
  } catch (error) {
    body.innerHTML = '<div class="alert alert-danger">Lỗi kết nối khi tải chi tiết đơn hàng.</div>';
  }
}

function renderOrderDetailHtml(order, statusHistory) {
  const image = escapeHtml(order.product_image || 'https://placehold.co/120x120?text=Anh');
  const steps = ['pending', 'confirmed', 'shipping', 'completed'];

  let progressHtml = '';
  if (order.status === 'cancelled') {
    progressHtml = `
      <div class="alert alert-secondary small mb-3">
        <i class="bi bi-x-circle me-1"></i>Đơn hàng đã bị hủy. Tiến trình giao hàng không còn hiệu lực.
      </div>
    `;
  } else {
    const currentIndex = steps.indexOf(order.status);
    progressHtml = `
      <div class="order-progress mb-4">
        ${steps.map((step, index) => {
          const state = index < currentIndex ? 'done' : index === currentIndex ? 'active' : 'upcoming';
          return `
            <div class="order-progress-step ${state}">
              <span class="order-progress-dot">${index < currentIndex ? '<i class="bi bi-check"></i>' : index + 1}</span>
              <span class="order-progress-label">${escapeHtml(PatuhiApp.orderStatusLabel(step))}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  const timelineHtml = statusHistory.length
    ? statusHistory.map((item) => `
        <div class="order-timeline-item">
          <div class="fw-semibold small">${escapeHtml(PatuhiApp.orderStatusLabel(item.to_status))}</div>
          <div class="text-muted small">${PatuhiApp.formatTimeAgo(item.created_at)} · ${escapeHtml(orderRoleLabel(item.changed_by_role))}</div>
          ${item.note ? `<div class="small text-muted mt-1">${escapeHtml(item.note)}</div>` : ''}
        </div>
      `).join('')
    : '<div class="small text-muted">Chưa có cập nhật trạng thái.</div>';

  const detailRow = (label, value) => `
    <div class="d-flex justify-content-between gap-3 py-2 border-bottom border-light">
      <span class="text-muted small text-nowrap">${escapeHtml(label)}</span>
      <span class="fw-semibold small text-end text-break">${escapeHtml(value ?? '')}</span>
    </div>
  `;

  return `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <div>
        <div class="fw-bold fs-5">${escapeHtml(order.order_code)}</div>
        <div class="text-muted small">Đặt lúc ${PatuhiApp.formatTimeAgo(order.created_at)}</div>
      </div>
      ${orderStatusBadge(order.status)}
    </div>

    ${progressHtml}

    <div class="row g-3">
      <div class="col-md-7">
        <div class="d-flex gap-3 align-items-start border rounded-3 bg-light p-3 mb-3">
          <img src="${image}" class="order-detail-thumb" alt="Ảnh sản phẩm">
          <div class="min-width-0">
            <div class="fw-bold text-break">${escapeHtml(order.product_title)}</div>
            <div class="text-danger fw-bold mt-1">${PatuhiApp.formatPrice(order.unit_price)} / sản phẩm</div>
          </div>
        </div>
        <div class="order-detail-list">
          ${detailRow('Số lượng', Number(order.quantity || 0))}
          ${detailRow('Tổng tiền', PatuhiApp.formatPrice(order.total_amount))}
          ${detailRow('Người bán', order.seller_name || '—')}
          ${detailRow('Họ tên người nhận', order.receiver_name)}
          ${detailRow('Số điện thoại', order.receiver_phone)}
          ${detailRow('Địa chỉ giao hàng', order.shipping_address)}
          ${detailRow('Ghi chú', order.note || 'Không có')}
          ${order.status === 'completed' ? detailRow('Đánh giá', order.is_rated ? 'Đã đánh giá' : 'Chưa đánh giá') : ''}
          ${detailRow('Cập nhật lần cuối', PatuhiApp.formatTimeAgo(order.updated_at || order.created_at))}
        </div>
      </div>
      <div class="col-md-5">
        <div class="border rounded-3 p-3 h-100">
          <div class="fw-bold small text-uppercase text-muted mb-3">
            <i class="bi bi-clock-history me-1"></i>Lịch sử trạng thái
          </div>
          <div class="order-timeline">
            ${timelineHtml}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderOrderDetailActions(order) {
  const buttons = [];
  const isBuyer = myUser && Number(order.buyer_id) === Number(myUser.id);
  const isSeller = myUser && Number(order.seller_id) === Number(myUser.id);
  const id = Number(order.id);

  if (isBuyer && order.status === 'pending') {
    buttons.push(`
      <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="cancelOrder(${id})">
        <i class="bi bi-x-circle me-1"></i>Hủy đơn
      </button>
    `);
  }

  if (isBuyer && order.status === 'completed' && !order.is_rated && order.product_id) {
    buttons.push(`
      <a class="btn btn-sm btn-outline-warning text-dark rounded-pill px-3" href="/product/${order.product_id}?order_id=${id}">
        <i class="bi bi-star me-1"></i>Đánh giá
      </a>
    `);
  }

  if (isSeller) {
    if (order.status === 'pending') {
      buttons.push(`
        <button class="btn btn-sm btn-outline-success rounded-pill px-3" onclick="updateOrderStatus(${id}, 'confirmed')">
          <i class="bi bi-check-circle me-1"></i>Xác nhận
        </button>
      `);
    }
    if (order.status === 'confirmed') {
      buttons.push(`
        <button class="btn btn-sm btn-outline-primary rounded-pill px-3" onclick="updateOrderStatus(${id}, 'shipping')">
          <i class="bi bi-truck me-1"></i>Giao hàng
        </button>
      `);
    }
    if (order.status === 'shipping') {
      buttons.push(`
        <button class="btn btn-sm btn-outline-success rounded-pill px-3" onclick="updateOrderStatus(${id}, 'completed')">
          <i class="bi bi-check2-all me-1"></i>Hoàn thành
        </button>
      `);
    }
    if (order.status === 'pending' || order.status === 'confirmed') {
      buttons.push(`
        <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="updateOrderStatus(${id}, 'cancelled')">
          <i class="bi bi-x-circle me-1"></i>Hủy
        </button>
      `);
    }
  }

  return `${buttons.join(' ')}
    <button type="button" class="btn btn-light btn-sm rounded-pill px-3" data-bs-dismiss="modal">Đóng</button>`;
}

async function updateOrderStatus(id, nextStatus) {
  try {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: nextStatus })
    });
    const json = await res.json();

    if (!res.ok) {
      PatuhiApp.showToast(json.message || 'Không thể cập nhật trạng thái đơn.', 'danger');
      return;
    }

    PatuhiApp.showToast(json.message || 'Đã cập nhật trạng thái đơn hàng.', 'success');
    loadOrders('seller');
    loadBuyerOrderSummary();

    const modalEl = document.getElementById('orderDetailModal');
    if (modalEl && modalEl.classList.contains('show')) viewOrderDetail(id);
  } catch (error) {
    PatuhiApp.showToast('Lỗi kết nối khi cập nhật trạng thái đơn.', 'danger');
  }
}

async function cancelOrder(id) {
  if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) return;

  try {
    const res = await fetch(`/api/orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();

    if (!res.ok) {
      PatuhiApp.showToast(json.message || 'Không thể hủy đơn hàng.', 'danger');
      return;
    }

    PatuhiApp.showToast(json.message || 'Đã hủy đơn hàng.', 'success');
    loadOrders('buyer');
    loadBuyerOrderSummary();

    const modalEl = document.getElementById('orderDetailModal');
    if (modalEl && modalEl.classList.contains('show')) viewOrderDetail(id);
  } catch (error) {
    PatuhiApp.showToast('Lỗi kết nối khi hủy đơn hàng.', 'danger');
  }
}
