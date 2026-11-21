// Logic xử lý toàn diện cho Bảng Điều Khiển Admin (Patuhi Dashboard)

let adminCommentsCache = [];
let commentSearchTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await PatuhiApp.checkAuth();
  if (!user || user.role !== 'admin') {
    alert('Truy cập bị từ chối! Bạn phải là Quản Trị Viên (Admin) để vào trang này.');
    window.location.href = '/login?redirect=/admin';
    return;
  }

  document.getElementById('admin-user-name').innerText = user.full_name || user.username;

  loadDashboardStats();
  loadAdminProducts();
});

function switchAdminTab(tab) {
  ['pending', 'users', 'categories', 'reports', 'comments'].forEach(t => {
    document.getElementById(`admin-tab-${t}`).classList.add('d-none');
    document.getElementById(`tab-btn-${t}`).classList.remove('active');
  });

  document.getElementById(`admin-tab-${tab}`).classList.remove('d-none');
  document.getElementById(`tab-btn-${tab}`).classList.add('active');

  if (tab === 'pending') loadAdminProducts();
  else if (tab === 'users') loadAdminUsers();
  else if (tab === 'categories') loadAdminCategories();
  else if (tab === 'reports') loadAdminReports();
  else if (tab === 'comments') loadAdminComments();
}

// 1. Tải Thống Kê Tổng Quan (Requirements 32, 33, 34)
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/admin/dashboard/stats', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (!res.ok) return;

    const { users, products, reports } = json.data;

    document.getElementById('stat-total-users').innerText = users.total;
    document.getElementById('stat-active-users').innerText = `${users.active} Hoạt động`;
    document.getElementById('stat-locked-users').innerText = `${users.locked} Khóa`;

    document.getElementById('stat-total-products').innerText = products.total;
    document.getElementById('stat-approved-products').innerText = `${products.approved} Đã duyệt`;
    document.getElementById('stat-sold-products').innerText = `${products.sold} Đã bán`;

    document.getElementById('stat-pending-products').innerText = products.pending;
    document.getElementById('badge-pending-count').innerText = products.pending;

    document.getElementById('stat-total-reports').innerText = reports.total;
    document.getElementById('stat-pending-reports').innerText = `${reports.pending} Chờ xử lý`;

    const commentStats = json.data.comments || {};
    document.getElementById('badge-pending-comments').innerText = commentStats.pending || 0;
    document.getElementById('stat-total-comments').innerText = commentStats.total || 0;
    document.getElementById('stat-pending-comments').innerText = commentStats.pending || 0;
    document.getElementById('stat-approved-comments').innerText = commentStats.approved || 0;
    document.getElementById('stat-rejected-comments').innerText = commentStats.rejected || 0;
  } catch (err) {
    console.error('Lỗi tải thống kê:', err);
  }
}

// 2. Duyệt Tin Đăng (Requirement 27)
async function loadAdminProducts() {
  const container = document.getElementById('admin-products-container');
  const status = document.getElementById('pending-status-filter').value;

  container.innerHTML = '<div class="text-center py-4 text-muted">Đang tải tin đăng...</div>';

  try {
    const res = await fetch(`/api/admin/products?status=${status}&limit=20`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (!res.ok) {
      container.innerHTML = `<div class="alert alert-danger">${json.message}</div>`;
      return;
    }

    const { products, total } = json.data;
    if (!products || products.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted">Không có tin đăng nào phù hợp!</div>';
      return;
    }

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Hình ảnh & Tiêu đề</th>
              <th>Người đăng</th>
              <th>Giá</th>
              <th>Trạng thái</th>
              <th>Ngày đăng</th>
              <th class="text-end">Thao tác duyệt</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => {
              const img = p.images && p.images[0] ? p.images[0].image_url : 'https://placehold.co/60x60';
              const seller = p.seller || {};

              return `
                <tr>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <img src="${img}" width="50" height="50" class="rounded" style="object-fit:cover;">
                      <div>
                        <a href="/product/${p.id}" target="_blank" class="fw-bold text-dark text-decoration-none d-block text-truncate" style="max-width: 250px;">
                          ${p.title}
                        </a>
                        <span class="text-muted small">${p.category ? p.category.name : ''}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="small fw-semibold">${seller.full_name || 'N/A'}</div>
                    <div class="text-muted small">@${seller.username}</div>
                  </td>
                  <td class="fw-bold text-danger text-nowrap">${PatuhiApp.formatPrice(p.price)}</td>
                  <td>
                    <span class="badge ${p.status === 'approved' ? 'bg-success' : (p.status === 'pending' ? 'bg-warning text-dark' : 'bg-danger')}">
                      ${p.status.toUpperCase()}
                    </span>
                  </td>
                  <td class="text-muted small">${PatuhiApp.formatTimeAgo(p.created_at || p.createdAt)}</td>
                  <td class="text-end text-nowrap">
                    ${p.status !== 'approved' ? `
                      <button class="btn btn-sm btn-success rounded-pill px-3 me-1" onclick="reviewListing(${p.id}, 'approve')">
                        <i class="bi bi-check-lg me-1"></i> Duyệt
                      </button>
                    ` : ''}
                    ${p.status !== 'rejected' ? `
                      <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="openRejectModal(${p.id})">
                        <i class="bi bi-x-lg me-1"></i> Từ chối
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi kết nối duyệt tin.</div>';
  }
}

async function reviewListing(id, action, rejection_reason = '') {
  try {
    const res = await fetch(`/api/admin/products/${id}/review`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, rejection_reason })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadAdminProducts();
      loadDashboardStats();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi máy chủ khi duyệt tin.', 'danger');
  }
}

function openRejectModal(id) {
  document.getElementById('reject-prod-id').value = id;
  document.getElementById('reject-reason').value = '';
  new bootstrap.Modal(document.getElementById('rejectProductModal')).show();
}

function confirmRejectProduct() {
  const id = document.getElementById('reject-prod-id').value;
  const reason = document.getElementById('reject-reason').value.trim();
  if (!reason) {
    alert('Vui lòng nhập lý do từ chối!');
    return;
  }
  reviewListing(id, 'reject', reason);
  bootstrap.Modal.getInstance(document.getElementById('rejectProductModal')).hide();
}

// 3. Quản Lý Người Dùng & Khóa/Mở Khóa (Requirements 28, 29)
async function loadAdminUsers() {
  const container = document.getElementById('admin-users-container');
  const q = document.getElementById('admin-search-user').value.trim();
  const role = document.getElementById('admin-filter-role').value;
  const status = document.getElementById('admin-filter-status').value;

  try {
    const params = new URLSearchParams({ q, role, status });
    const res = await fetch(`/api/admin/users?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (!res.ok) {
      container.innerHTML = `<div class="alert alert-danger">${json.message}</div>`;
      return;
    }

    const { users } = json.data;
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>Người dùng</th>
              <th>Email</th>
              <th>Số điện thoại</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              <th>Ngày tham gia</th>
              <th class="text-end">Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <img src="${u.avatar || '/uploads/avatars/default.png'}" width="38" height="38" class="rounded-circle" style="object-fit:cover;">
                    <div>
                      <div class="fw-semibold">${u.full_name}</div>
                      <div class="text-muted small">@${u.username}</div>
                    </div>
                  </div>
                </td>
                <td>${u.email}</td>
                <td>${u.phone || 'Chưa có'}</td>
                <td>
                  <span class="badge ${u.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${u.role.toUpperCase()}</span>
                </td>
                <td>
                  <span class="badge ${u.status === 'active' ? 'bg-success' : 'bg-dark'}">
                    ${u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td class="text-muted small">${PatuhiApp.formatTimeAgo(u.created_at)}</td>
                <td class="text-end text-nowrap">
                  ${u.status === 'active' ? `
                    <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="toggleUser(${u.id}, 'locked')">
                      <i class="bi bi-lock me-1"></i> Khóa
                    </button>
                  ` : `
                    <button class="btn btn-sm btn-outline-success rounded-pill px-3" onclick="toggleUser(${u.id}, 'active')">
                      <i class="bi bi-unlock me-1"></i> Mở khóa
                    </button>
                  `}
                  <button class="btn btn-sm btn-outline-secondary rounded-pill px-2" title="Đổi quyền" onclick="changeRolePrompt(${u.id}, '${u.role}')">
                    <i class="bi bi-person-gear"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi kết nối tải người dùng.</div>';
  }
}

async function toggleUser(id, newStatus) {
  if (!confirm(`Bạn có chắc muốn ${newStatus === 'locked' ? 'KHÓA' : 'MỞ KHÓA'} tài khoản này không?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}/status`, {
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
      loadAdminUsers();
      loadDashboardStats();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi cập nhật người dùng.', 'danger');
  }
}

async function changeRolePrompt(id, currentRole) {
  const newRole = currentRole === 'admin' ? 'member' : 'admin';
  if (!confirm(`Chuyển vai trò người dùng này sang: ${newRole.toUpperCase()}?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: newRole })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadAdminUsers();
      loadDashboardStats();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi đổi vai trò.', 'danger');
  }
}

// 4. Quản Lý Danh Mục (Requirement 30)
async function loadAdminCategories() {
  const container = document.getElementById('admin-categories-container');
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (!res.ok) return;

    const cats = json.data.categories;
    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>ID</th>
              <th>Icon</th>
              <th>Tên danh mục</th>
              <th>Slug đường dẫn</th>
              <th>Mô tả</th>
              <th class="text-end">Hành động</th>
            </tr>
          </thead>
          <tbody>
            ${cats.map(c => `
              <tr>
                <td>${c.id}</td>
                <td><i class="bi ${c.icon || 'bi-tag'} fs-4 text-warning"></i></td>
                <td class="fw-bold">${c.name}</td>
                <td><code>${c.slug}</code></td>
                <td class="text-muted small">${c.description || ''}</td>
                <td class="text-end text-nowrap">
                  <button class="btn btn-sm btn-outline-primary rounded-pill px-3 me-1" onclick='prepareEditCategory(${JSON.stringify(c)})'>
                    <i class="bi bi-pencil me-1"></i> Sửa
                  </button>
                  <button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="deleteCategory(${c.id})">
                    <i class="bi bi-trash me-1"></i> Xóa
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi tải danh mục.</div>';
  }
}

function prepareAddCategory() {
  document.getElementById('catModalTitle').innerText = 'Thêm Danh Mục Mới';
  document.getElementById('cat-id').value = '';
  document.getElementById('cat-name').value = '';
  document.getElementById('cat-icon').value = 'bi-grid';
  document.getElementById('cat-description').value = '';
}

function prepareEditCategory(c) {
  document.getElementById('catModalTitle').innerText = 'Chỉnh Sửa Danh Mục';
  document.getElementById('cat-id').value = c.id;
  document.getElementById('cat-name').value = c.name;
  document.getElementById('cat-icon').value = c.icon || '';
  document.getElementById('cat-description').value = c.description || '';
  new bootstrap.Modal(document.getElementById('categoryModal')).show();
}

async function handleSaveCategory(e) {
  e.preventDefault();
  const id = document.getElementById('cat-id').value;
  const name = document.getElementById('cat-name').value.trim();
  const icon = document.getElementById('cat-icon').value.trim();
  const description = document.getElementById('cat-description').value.trim();

  const url = id ? `/api/admin/categories/${id}` : '/api/admin/categories';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, icon, description })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      bootstrap.Modal.getInstance(document.getElementById('categoryModal')).hide();
      loadAdminCategories();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi lưu danh mục.', 'danger');
  }
}

async function deleteCategory(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
  try {
    const res = await fetch(`/api/admin/categories/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadAdminCategories();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi xóa danh mục.', 'danger');
  }
}

// 5. Xử Lý Báo Cáo Vi Phạm (Requirement 31)
async function loadAdminReports() {
  const container = document.getElementById('admin-reports-container');
  const status = document.getElementById('admin-filter-report-status').value;

  try {
    const res = await fetch(`/api/admin/reports?status=${status}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (!res.ok) return;

    const { reports } = json.data;
    if (!reports || reports.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted">Không có báo cáo nào!</div>';
      return;
    }

    const reasonMap = {
      'fraud': 'Lừa đảo tiền / cọc',
      'fake': 'Hàng giả, nhái',
      'offensive': 'Phản cảm',
      'wrong_category': 'Sai danh mục',
      'other': 'Khác'
    };

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>ID</th>
              <th>Sản phẩm bị báo cáo</th>
              <th>Người báo cáo</th>
              <th>Lý do</th>
              <th>Trạng thái</th>
              <th>Ghi chú BQT</th>
              <th class="text-end">Xử lý</th>
            </tr>
          </thead>
          <tbody>
            ${reports.map(r => {
              const p = r.product;
              const rep = r.reporter || {};
              return `
                <tr>
                  <td>#${r.id}</td>
                  <td>
                    ${p ? `
                      <a href="/product/${p.id}" target="_blank" class="fw-bold text-dark text-decoration-none">
                        ${p.title}
                      </a>
                    ` : '<span class="text-muted">(Đã gỡ/xóa)</span>'}
                  </td>
                  <td>
                    <div>${rep.full_name || 'N/A'}</div>
                    <span class="text-muted small">@${rep.username}</span>
                  </td>
                  <td>
                    <span class="fw-bold text-danger">${reasonMap[r.reason] || r.reason}</span>
                    ${r.description ? `<div class="small text-muted">${r.description}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${r.status === 'resolved' ? 'bg-success' : (r.status === 'pending' ? 'bg-warning text-dark' : 'bg-secondary')}">
                      ${r.status.toUpperCase()}
                    </span>
                  </td>
                  <td class="small text-secondary">${r.admin_note || 'Chưa có'}</td>
                  <td class="text-end text-nowrap">
                    ${r.status === 'pending' ? `
                      <button class="btn btn-sm btn-danger rounded-pill px-2 me-1" onclick="processReportAction(${r.id}, 'resolved', true)" title="Xác nhận vi phạm & Gỡ bỏ tin">
                        <i class="bi bi-shield-x me-1"></i> Gỡ tin
                      </button>
                      <button class="btn btn-sm btn-outline-secondary rounded-pill px-2" onclick="processReportAction(${r.id}, 'dismissed', false)" title="Bác bỏ báo cáo">
                        <i class="bi bi-slash-circle me-1"></i> Bác bỏ
                      </button>
                    ` : `
                      <span class="text-muted small">Đã xử lý</span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi tải báo cáo.</div>';
  }
}

async function processReportAction(id, status, hide_product) {
  const note = prompt('Nhập ghi chú xử lý của Quản Trị Viên (tùy chọn):', hide_product ? 'Xác nhận vi phạm, gỡ bỏ tin đăng khỏi sàn.' : 'Không phát hiện dấu hiệu vi phạm.');
  if (note === null) return;

  try {
    const res = await fetch(`/api/admin/reports/${id}/process`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, admin_note: note, hide_product })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadAdminReports();
      loadDashboardStats();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi xử lý báo cáo.', 'danger');
  }
}

// 6. Quản Lý Bình Luận Sản Phẩm
function escapeCommentHtml(value) {
  return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function scheduleCommentReload() {
  clearTimeout(commentSearchTimer);
  commentSearchTimer = setTimeout(loadAdminComments, 300);
}

async function loadAdminComments() {
  const container = document.getElementById('admin-comments-container');
  const status = document.getElementById('comment-status-filter').value;
  const q = document.getElementById('admin-search-comment').value.trim();

  container.innerHTML = '<div class="text-center py-4 text-muted">Đang tải bình luận...</div>';

  try {
    const params = new URLSearchParams({ status, q, limit: '50' });
    const res = await fetch(`/api/admin/comments?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (!res.ok) {
      container.innerHTML = `<div class="alert alert-danger">${escapeCommentHtml(json.message)}</div>`;
      return;
    }

    const { comments = [] } = json.data || {};
    adminCommentsCache = comments;
    const startIndex = ((Number(json.data && json.data.page) - 1) * 50) || 0;
    if (comments.length === 0) {
      container.innerHTML = '<div class="text-center py-4 text-muted">Không có bình luận nào phù hợp!</div>';
      return;
    }

    const statusInfo = {
      PENDING: { label: 'Chờ duyệt', badge: 'bg-warning text-dark' },
      APPROVED: { label: 'Đã duyệt', badge: 'bg-success' },
      REJECTED: { label: 'Bị từ chối', badge: 'bg-danger' }
    };

    container.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead class="table-light">
            <tr>
              <th>STT</th>
              <th>Hình ảnh</th>
              <th>Sản phẩm</th>
              <th>Người bình luận</th>
              <th>Nội dung</th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th class="text-end">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${comments.map((c, index) => {
              const user = c.user || {};
              const product = c.product || {};
              const images = product.images || [];
              const productImage = images.find(img => img.is_primary) || images[0];
              const st = statusInfo[c.status] || statusInfo.PENDING;
              const name = escapeCommentHtml(user.full_name || user.username || 'Người dùng');
              const username = escapeCommentHtml(user.username || '');
              const avatar = escapeCommentHtml(user.avatar || '/uploads/avatars/default.png');
              const productTitle = escapeCommentHtml(product.title || '(Sản phẩm đã gỡ)');
              const productThumb = escapeCommentHtml(productImage ? productImage.image_url : 'https://placehold.co/50x50');
              const content = escapeCommentHtml(c.content);
              const time = escapeCommentHtml(PatuhiApp.formatTimeAgo(c.created_at || c.createdAt));

              return `
                <tr>
                  <td class="text-muted small">${startIndex + index + 1}</td>
                  <td>
                    <img src="${productThumb}" width="50" height="50" class="rounded border" style="object-fit:cover;" onerror="this.onerror=null;this.src='https://placehold.co/50x50'">
                  </td>
                  <td>
                    ${product.id ? `<a href="/product/${Number(product.id)}" target="_blank" class="text-decoration-none small fw-semibold">${productTitle}</a>` : `<span class="text-muted small">${productTitle}</span>`}
                  </td>
                  <td>
                    <div class="d-flex align-items-center gap-2">
                      <img src="${avatar}" width="38" height="38" class="rounded-circle" style="object-fit:cover;" onerror="this.style.display='none'">
                      <div>
                        <div class="small fw-semibold">${name}</div>
                        <div class="text-muted small">@${username}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="small text-secondary" style="max-width: 360px; white-space: pre-wrap; word-break: break-word;">${content}</div>
                  </td>
                  <td class="text-muted small text-nowrap">${time}</td>
                  <td><span class="badge ${st.badge}">${escapeCommentHtml(st.label)}</span></td>
                  <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-primary rounded-pill px-2 me-1" onclick="openCommentDetailModal(${Number(c.id)})" title="Xem chi tiết">
                      <i class="bi bi-eye"></i>
                    </button>
                    ${c.status !== 'APPROVED' ? `
                      <button class="btn btn-sm btn-success rounded-pill px-2 me-1" onclick="reviewCommentAction(${Number(c.id)}, 'approve')" title="Duyệt">
                        <i class="bi bi-check-lg"></i>
                      </button>
                    ` : ''}
                    ${c.status !== 'REJECTED' ? `
                      <button class="btn btn-sm btn-outline-danger rounded-pill px-2 me-1" onclick="reviewCommentAction(${Number(c.id)}, 'reject')" title="Từ chối">
                        <i class="bi bi-x-lg"></i>
                      </button>
                    ` : ''}
                    <button class="btn btn-sm btn-danger rounded-pill px-2" onclick="removeCommentAction(${Number(c.id)})" title="Xóa">
                      <i class="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="alert alert-danger">Lỗi kết nối tải bình luận.</div>';
  }
}

async function reviewCommentAction(id, action) {
  try {
    const res = await fetch(`/api/admin/comments/${id}/review`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action })
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadAdminComments();
      loadDashboardStats();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi máy chủ khi duyệt bình luận.', 'danger');
  }
}

function openCommentDetailModal(id) {
  const comment = adminCommentsCache.find(item => item.id === id);
  if (!comment) {
    PatuhiApp.showToast('Không tìm thấy thông tin bình luận.', 'danger');
    return;
  }

  const user = comment.user || {};
  const product = comment.product || {};
  const statusInfo = {
    PENDING: { label: 'Chờ duyệt', badge: 'bg-warning text-dark' },
    APPROVED: { label: 'Đã duyệt', badge: 'bg-success' },
    REJECTED: { label: 'Bị từ chối', badge: 'bg-danger' }
  };
  const st = statusInfo[comment.status] || statusInfo.PENDING;
  const name = user.full_name || user.username || 'Người dùng';

  // Mọi nội dung động đều dùng textContent để tránh XSS
  const avatar = document.getElementById('comment-detail-avatar');
  avatar.onerror = function () {
    this.onerror = null;
    this.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=ff8800&color=fff';
  };
  avatar.src = user.avatar || '/uploads/avatars/default.png';

  document.getElementById('comment-detail-name').textContent = name;
  document.getElementById('comment-detail-username').textContent = '@' + (user.username || '');

  const productLink = document.getElementById('comment-detail-product');
  if (product.id) {
    productLink.textContent = product.title || '';
    productLink.href = '/product/' + Number(product.id);
  } else {
    productLink.textContent = '(Sản phẩm đã gỡ)';
    productLink.removeAttribute('href');
  }

  document.getElementById('comment-detail-time').textContent = PatuhiApp.formatTimeAgo(comment.created_at || comment.createdAt);

  const statusBadge = document.getElementById('comment-detail-status');
  statusBadge.className = 'badge ' + st.badge;
  statusBadge.textContent = st.label;

  document.getElementById('comment-detail-content').textContent = comment.content || '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('commentDetailModal')).show();
}

async function removeCommentAction(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa bình luận này? Hành động này không thể hoàn tác.')) return;

  try {
    const res = await fetch(`/api/admin/comments/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    });
    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      loadAdminComments();
      loadDashboardStats();
    } else {
      PatuhiApp.showToast(json.message, 'danger');
    }
  } catch (e) {
    PatuhiApp.showToast('Lỗi máy chủ khi xóa bình luận.', 'danger');
  }
}
