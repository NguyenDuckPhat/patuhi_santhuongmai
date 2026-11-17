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

function switchTab(tabName) {
  ['listings', 'info', 'password'].forEach(t => {
    document.getElementById(`tab-content-${t}`).classList.add('d-none');
    document.getElementById(`tab-btn-${t}`).classList.remove('active');
  });

  document.getElementById(`tab-content-${tabName}`).classList.remove('d-none');
  document.getElementById(`tab-btn-${tabName}`).classList.add('active');
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
                  <td class="text-muted small text-nowrap">${PatuhiApp.formatTimeAgo(p.created_at)}</td>
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
