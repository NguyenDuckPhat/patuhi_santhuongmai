// Quản lý trạng thái và tiện ích dùng chung trên toàn hệ thống Patuhi

const PatuhiApp = {
  currentUser: null,

  // Khởi tạo kiểm tra đăng nhập
  async init() {
    // Kiểm tra token từ Google OAuth redirect callback
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');
    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    await this.checkAuth();
    this.renderNavbar();
    this.renderFooter();
    this.updateNotificationCount();

    if (urlParams.get('login') === 'google_success') {
      setTimeout(() => {
        this.showToast('Đăng nhập bằng tài khoản Google thành công!', 'success');
      }, 300);
    }
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
        <div class="d-flex align-items-center gap-2 gap-md-3">
          <a href="/favorites" class="btn btn-outline-secondary position-relative" title="Tin yêu thích">
            <i class="bi bi-heart"></i>
          </a>
          <a href="/chat" class="btn btn-outline-secondary position-relative" title="Tin nhắn">
            <i class="bi bi-chat-dots"></i>
          </a>
          <a href="/post" class="btn btn-warning text-white fw-bold rounded-pill px-3 shadow-sm">
            <i class="bi bi-plus-circle me-1"></i> Đăng tin
          </a>

          <div class="dropdown">
            <button class="btn btn-light dropdown-toggle d-flex align-items-center gap-2 rounded-pill px-2 pe-3 border" type="button" data-bs-toggle="dropdown">
              <img src="${this.currentUser.avatar || '/uploads/avatars/default.png'}" class="rounded-circle" width="30" height="30" style="object-fit:cover;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.full_name)}&background=ff8800&color=fff'">
              <span class="d-none d-md-inline fw-semibold text-truncate" style="max-width: 120px;">${this.currentUser.full_name || this.currentUser.username}</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2 py-2">
              <li class="px-3 py-2 border-bottom mb-1 bg-light rounded-top-3">
                <div class="fw-bold text-dark text-truncate">${this.currentUser.full_name || this.currentUser.username}</div>
                <div class="text-muted small">@${this.currentUser.username} • <span class="badge ${isAdmin ? 'bg-danger' : 'bg-warning text-dark'} text-uppercase" style="font-size: 0.65rem;">${this.currentUser.role}</span></div>
              </li>
              <li><a class="dropdown-item py-2" href="/profile"><i class="bi bi-person me-2 text-primary"></i>Trang cá nhân & Tin đăng</a></li>
              <li><a class="dropdown-item py-2" href="/favorites"><i class="bi bi-heart me-2 text-danger"></i>Danh sách yêu thích</a></li>
              <li><a class="dropdown-item py-2" href="/my-reports"><i class="bi bi-flag me-2 text-warning"></i>Lịch sử báo cáo tin</a></li>
              ${isAdmin ? `<li><hr class="dropdown-divider my-1"></li><li><a class="dropdown-item py-2 text-danger fw-bold" href="/admin"><i class="bi bi-shield-check me-2"></i>Bảng Quản Trị Admin</a></li>` : ''}
              <li><hr class="dropdown-divider my-1"></li>
              <li><button class="dropdown-item py-2 text-danger" onclick="PatuhiApp.logout()"><i class="bi bi-box-arrow-right me-2"></i>Đăng xuất</button></li>
            </ul>
          </div>
        </div>
      `;
    } else {
      navAuthContainer.innerHTML = `
        <div class="d-flex align-items-center gap-2">
          <a href="/login" class="btn btn-outline-primary rounded-pill px-3">Đăng nhập</a>
          <a href="/register" class="btn btn-primary rounded-pill px-3">Đăng ký</a>
          <a href="/login?redirect=/post" class="btn btn-warning text-white fw-bold rounded-pill px-3 shadow-sm">
            <i class="bi bi-plus-circle me-1"></i> Đăng tin
          </a>
        </div>
      `;
    }
  },

  // Hiển thị Footer đồng bộ toàn hệ thống
  renderFooter() {
    const footer = document.querySelector('footer');
    if (!footer) return;

    // Không render đè nếu đã có cấu trúc site-footer
    if (footer.classList.contains('site-footer') && footer.querySelector('.footer-main')) return;

    footer.className = 'site-footer mt-auto';
    footer.innerHTML = `
      <!-- Top Highlights -->
      <div class="footer-highlights py-4 border-bottom border-secondary border-opacity-25">
        <div class="container">
          <div class="row g-4 text-center text-md-start">
            <div class="col-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
              <div class="highlight-icon"><i class="bi bi-shield-check"></i></div>
              <div>
                <div class="fw-bold text-white small">Kiểm duyệt uy tín</div>
                <div class="text-white-50 xs-text">100% tin được duyệt an toàn</div>
              </div>
            </div>
            <div class="col-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
              <div class="highlight-icon"><i class="bi bi-lightning-charge"></i></div>
              <div>
                <div class="fw-bold text-white small">Kết nối tức thì</div>
                <div class="text-white-50 xs-text">Chat trực tuyến thời gian thực</div>
              </div>
            </div>
            <div class="col-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
              <div class="highlight-icon"><i class="bi bi-currency-dollar"></i></div>
              <div>
                <div class="fw-bold text-white small">Đăng tin miễn phí</div>
                <div class="text-white-50 xs-text">Tiếp cận triệu người mua</div>
              </div>
            </div>
            <div class="col-6 col-md-3 d-flex align-items-center justify-content-center justify-content-md-start gap-3">
              <div class="highlight-icon"><i class="bi bi-headset"></i></div>
              <div>
                <div class="fw-bold text-white small">Hỗ trợ 24/7</div>
                <div class="text-white-50 xs-text">Hotline & CSKH nhiệt tình</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Footer Links -->
      <div class="footer-main py-5">
        <div class="container">
          <div class="row g-4">
            <!-- Col 1: Brand & Contact -->
            <div class="col-lg-4 col-md-6">
              <div class="d-flex align-items-center gap-2 mb-3">
                <div class="brand-icon-box">
                  <i class="bi bi-shop-window"></i>
                </div>
                <span class="brand-text text-white fs-4 fw-bold">PATUHI</span>
                <span class="badge bg-warning text-dark ms-1">C2C</span>
              </div>
              <p class="text-secondary small mb-3 pe-lg-3">
                Sàn thương mại điện tử C2C kết nối cộng đồng mua bán & trao đổi đồ cũ uy tín, nhanh chóng và an toàn hàng đầu tại Việt Nam.
              </p>
              <div class="footer-contact-item">
                <i class="bi bi-geo-alt-fill text-warning"></i>
                <span class="small text-secondary">Tòa nhà Patuhi, 123 Đường Công Nghệ, TP. Hồ Chí Minh</span>
              </div>
              <div class="footer-contact-item">
                <i class="bi bi-telephone-fill text-warning"></i>
                <span class="small text-secondary">Hotline: <strong class="text-white">1900 8888</strong> (8:00 - 21:00)</span>
              </div>
              <div class="footer-contact-item">
                <i class="bi bi-envelope-fill text-warning"></i>
                <span class="small text-secondary">Email: <strong class="text-white">support@patuhi.vn</strong></span>
              </div>
            </div>

            <!-- Col 2: Về Patuhi -->
            <div class="col-lg-2 col-md-6 col-6">
              <h6 class="footer-col-title text-white fw-bold mb-3">Về Patuhi</h6>
              <ul class="footer-links list-unstyled small mb-0">
                <li><a href="/"><i class="bi bi-chevron-right"></i> Trang chủ</a></li>
                <li><a href="/#categories-grid"><i class="bi bi-chevron-right"></i> Danh mục sản phẩm</a></li>
                <li><a href="/post"><i class="bi bi-chevron-right"></i> Đăng tin mua bán</a></li>
                <li><a href="/my-reports"><i class="bi bi-chevron-right"></i> Báo cáo vi phạm</a></li>
                <li><a href="/profile"><i class="bi bi-chevron-right"></i> Tài khoản của tôi</a></li>
              </ul>
            </div>

            <!-- Col 3: Hỗ trợ khách hàng -->
            <div class="col-lg-3 col-md-6 col-6">
              <h6 class="footer-col-title text-white fw-bold mb-3">Hỗ trợ khách hàng</h6>
              <ul class="footer-links list-unstyled small mb-0">
                <li><a href="javascript:void(0)"><i class="bi bi-chevron-right"></i> Quy chế hoạt động</a></li>
                <li><a href="javascript:void(0)"><i class="bi bi-chevron-right"></i> Hướng dẫn mua bán</a></li>
                <li><a href="javascript:void(0)"><i class="bi bi-chevron-right"></i> Quy định duyệt tin</a></li>
                <li><a href="javascript:void(0)"><i class="bi bi-chevron-right"></i> Bảo vệ người dùng</a></li>
                <li><a href="javascript:void(0)"><i class="bi bi-chevron-right"></i> Giải quyết tranh chấp</a></li>
              </ul>
            </div>

            <!-- Col 4: Kết nối & Bảo mật -->
            <div class="col-lg-3 col-md-6">
              <h6 class="footer-col-title text-white fw-bold mb-3">Kết nối với Patuhi</h6>
              <div class="d-flex gap-2 mb-4">
                <a href="#" class="footer-social-btn" title="Facebook"><i class="bi bi-facebook"></i></a>
                <a href="#" class="footer-social-btn" title="YouTube"><i class="bi bi-youtube"></i></a>
                <a href="#" class="footer-social-btn" title="Tiktok"><i class="bi bi-tiktok"></i></a>
                <a href="#" class="footer-social-btn" title="Zalo"><i class="bi bi-chat-text-fill"></i></a>
              </div>

              <h6 class="footer-col-title text-white fw-bold mb-2 small">Chứng nhận & An toàn</h6>
              <div class="d-flex flex-wrap gap-2">
                <span class="footer-cert-badge"><i class="bi bi-shield-lock-fill text-success me-1"></i>SSL 256-bit</span>
                <span class="footer-cert-badge"><i class="bi bi-patch-check-fill text-info me-1"></i>Bộ Công Thương</span>
                <span class="footer-cert-badge"><i class="bi bi-credit-card-2-front-fill text-warning me-1"></i>COD An Toàn</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Copyright -->
      <div class="footer-bottom py-3 border-top border-secondary border-opacity-25">
        <div class="container d-flex flex-column flex-md-row justify-content-between align-items-center gap-2 text-center text-md-start small text-secondary">
          <div>
            &copy; 2026 <strong>PATUHI Marketplace</strong>. Nền tảng mua bán đồ cũ & C2C an toàn.
          </div>
          <div class="d-flex gap-3">
            <a href="javascript:void(0)" class="text-secondary text-decoration-none hover-warning">Điều khoản</a>
            <span>•</span>
            <a href="javascript:void(0)" class="text-secondary text-decoration-none hover-warning">Bảo mật</a>
            <span>•</span>
            <a href="javascript:void(0)" class="text-secondary text-decoration-none hover-warning">Liên hệ</a>
          </div>
        </div>
      </div>
    `;
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
