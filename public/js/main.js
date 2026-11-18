// Quản lý trạng thái và tiện ích dùng chung trên toàn hệ thống Patuhi

const PatuhiApp = {
  currentUser: null,

  // Khởi tạo kiểm tra đăng nhập
  async init() {
    await this.checkAuth();
    this.renderNavbar();
    this.updateNotificationCount();
  },

  // Lấy thông tin user hiện tại từ token cookie/localStorage
  async checkAuth() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.data.user;
        localStorage.setItem('user', JSON.stringify(this.currentUser));
      } else {
        this.currentUser = null;
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    } catch (e) {
      this.currentUser = null;
    }
    return this.currentUser;
  },

  // Hiển thị Navbar theo vai trò (Khách, Thành viên, Quản trị viên)
  renderNavbar() {
    const navAuthContainer = document.getElementById('nav-auth-container');
    if (!navAuthContainer) return;

    if (this.currentUser) {
      const isAdmin = this.currentUser.role === 'admin';
      navAuthContainer.innerHTML = `
        <div class="d-flex align-items-center gap-3">
          <a href="/favorites" class="btn btn-outline-secondary position-relative rounded-pill px-3" title="Tin yêu thích">
            <i class="bi bi-heart"></i>
          </a>
          <a href="/chat" class="btn btn-outline-secondary position-relative rounded-pill px-3" title="Tin nhắn">
            <i class="bi bi-chat-dots"></i>
          </a>
          <a href="/post" class="btn btn-warning text-dark fw-bold rounded-pill px-3">
            <i class="bi bi-plus-circle me-1"></i> Đăng tin
          </a>

          <div class="dropdown">
            <button class="btn btn-light dropdown-toggle d-flex align-items-center gap-2 rounded-pill px-3 border" type="button" data-bs-toggle="dropdown">
              <img src="${this.currentUser.avatar || '/uploads/avatars/default.png'}" class="rounded-circle" width="30" height="30" style="object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.full_name)}&background=ff8800&color=fff'">
              <span class="d-none d-md-inline fw-semibold">${this.currentUser.full_name || this.currentUser.username}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
              <li><h6 class="dropdown-header">Tài khoản: @${this.currentUser.username} (${this.currentUser.role.toUpperCase()})</h6></li>
              <li><a class="dropdown-item" href="/profile"><i class="bi bi-person me-2"></i>Trang cá nhân & Tin đăng</a></li>
              <li><a class="dropdown-item" href="/favorites"><i class="bi bi-heart me-2"></i>Danh sách yêu thích</a></li>
              <li><a class="dropdown-item" href="/my-reports"><i class="bi bi-flag me-2"></i>Lịch sử báo cáo tin</a></li>
              ${isAdmin ? `<li><hr class="dropdown-divider"></li><li><a class="dropdown-item text-danger fw-bold" href="/admin"><i class="bi bi-shield-check me-2"></i>Bảng Quản Trị Admin</a></li>` : ''}
              <li><hr class="dropdown-divider"></li>
              <li><button class="dropdown-item text-danger" onclick="PatuhiApp.logout()"><i class="bi bi-box-arrow-right me-2"></i>Đăng xuất</button></li>
            </ul>
          </div>
        </div>
      `;
    } else {
      navAuthContainer.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <a href="/login" class="btn btn-outline-primary rounded-pill px-3">Đăng nhập</a>
          <a href="/register" class="btn btn-primary rounded-pill px-3">Đăng ký</a>
          <a href="/login?redirect=/post" class="btn btn-warning text-dark fw-bold rounded-pill px-3">
            <i class="bi bi-plus-circle me-1"></i> Đăng tin
          </a>
        </div>
      `;
    }
  },

  // Đăng xuất
  async logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUser = null;
    this.showToast('Đã đăng xuất thành công!', 'info');
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  },

  // Hiển thị thông báo Toast
  showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
      container.style.zIndex = '9999';
      document.body.appendChild(container);
    }

    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' : (type === 'danger' ? 'bg-danger text-white' : 'bg-primary text-white');
    const html = `
      <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    const toastElem = document.getElementById(toastId);
    const bsToast = new bootstrap.Toast(toastElem, { delay: 3500 });
    bsToast.show();
    toastElem.addEventListener('hidden.bs.toast', () => toastElem.remove());
  },

  // Định dạng giá tiền VND
  formatPrice(price) {
    if (!price && price !== 0) return 'Thương lượng';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  },

  // Định dạng thời gian
  formatTimeAgo(dateString) {
    if (dateString === null || dateString === undefined || dateString === '') return 'Không rõ thời gian';

    const normalizedDate = typeof dateString === 'string'
      ? dateString.trim().replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/, '$1T$2')
      : dateString;
    const date = new Date(normalizedDate);
    if (Number.isNaN(date.getTime())) return 'Không rõ thời gian';

    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);

    if (diffSec < 60) return 'Vừa xong';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} giờ trước`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  },

  updateNotificationCount() {
    // optional live indicator
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PatuhiApp.init();
});
