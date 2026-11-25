// Quản lý trạng thái và tiện ích dùng chung trên toàn hệ thống Patuhi

const PatuhiApp = {
  currentUser: null,

  // Đơn đặt: chỉ tồn tại trong RAM của document hiện tại.
  // F5 / tải lại trang => object được tạo lại => mảng này rỗng.
  tempOrders: [],
  tempOrderSequence: 0,

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
    this.connectNotificationSocket();
    this.notificationCountTimer = setInterval(() => this.updateNotificationCount(), 20000);

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
          <a href="/profile?tab=buy-orders" class="temp-order-nav-link fw-semibold" title="Đơn hàng của tôi">
            Đơn hàng của tôi
          </a>
          <a href="/favorites" class="btn btn-outline-secondary position-relative" title="Tin yêu thích">
            <i class="bi bi-heart"></i>
          </a>
          <a href="/chat" class="btn btn-outline-secondary position-relative" title="Tin nhắn">
            <i class="bi bi-chat-dots"></i>
            <span id="unread-message-count" class="unread-message-badge d-none" aria-live="polite"></span>
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
              <li><a class="dropdown-item py-2" href="/profile?tab=buy-orders"><i class="bi bi-bag-check me-2 text-success"></i>Đơn hàng của tôi</a></li>
              <li><a class="dropdown-item py-2" href="/profile?tab=sell-orders"><i class="bi bi-box-seam me-2 text-warning"></i>Quản lý đơn hàng</a></li>
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
          <a href="javascript:void(0)" class="temp-order-nav-link fw-semibold" onclick="PatuhiApp.openTempOrders()" title="Đặt đơn">
            Đặt đơn
            <span class="badge bg-warning text-dark d-none" data-temp-order-count>0</span>
          </a>
          <a href="/login" class="btn btn-outline-primary rounded-pill px-3">Đăng nhập</a>
          <a href="/register" class="btn btn-primary rounded-pill px-3">Đăng ký</a>
          <a href="/login?redirect=/post" class="btn btn-warning text-white fw-bold rounded-pill px-3 shadow-sm">
            <i class="bi bi-plus-circle me-1"></i> Đăng tin
          </a>
        </div>
      `;
    }
    this.updateTempOrderBadge();
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
                ${this.currentUser
                  ? `<li><a href="/profile?tab=buy-orders"><i class="bi bi-chevron-right"></i> Đơn hàng của tôi</a></li>`
                  : `<li>
                       <button type="button" class="footer-link-btn" onclick="PatuhiApp.openTempOrders()">
                         <i class="bi bi-chevron-right"></i> Đặt đơn
                         <span class="badge bg-warning text-dark d-none" data-temp-order-count>0</span>
                       </button>
                     </li>`}
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
    this.updateTempOrderBadge();
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

  // ==========================================
  // ĐƠN ĐẶT (RAM - KHÔNG LƯU DB/STORAGE)
  // ==========================================

  addTempOrder(order) {
    this.tempOrderSequence += 1;
    this.tempOrders.push({
      ...order,
      tempLabel: `Đơn đặt #${this.tempOrderSequence}`
    });
    this.updateTempOrderBadge();
  },

  updateTempOrderBadge() {
    const count = this.tempOrders.length;
    document.querySelectorAll('[data-temp-order-count]').forEach((badge) => {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.toggle('d-none', count === 0);
    });
  },

  ensureTempOrderOverlay() {
    if (document.getElementById('temp-orders-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'temp-orders-overlay';
    overlay.className = 'temp-orders-overlay d-none';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Đơn đặt');
    overlay.innerHTML = `
      <div class="temp-orders-panel">
        <div class="temp-orders-header">
          <div>
            <h5 class="fw-bold mb-1"><i class="bi bi-bag-check text-warning me-2"></i>Đơn đặt của bạn</h5>
            <p class="small text-muted mb-0">Các đơn đặt chỉ tồn tại trên trình duyệt này và sẽ mất khi tải lại trang.</p>
          </div>
          <button type="button" class="btn-close" aria-label="Đóng" onclick="PatuhiApp.closeTempOrders()"></button>
        </div>
        <div class="temp-orders-body" id="temp-orders-body"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeTempOrders();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !overlay.classList.contains('d-none')) this.closeTempOrders();
    });
  },

  openTempOrders() {
    this.ensureTempOrderOverlay();
    this.renderTempOrderList();
    const overlay = document.getElementById('temp-orders-overlay');
    if (overlay) overlay.classList.remove('d-none');
    document.body.classList.add('temp-orders-open');
  },

  closeTempOrders() {
    const overlay = document.getElementById('temp-orders-overlay');
    if (overlay) overlay.classList.add('d-none');
    document.body.classList.remove('temp-orders-open');
  },

  renderTempOrderList() {
    const body = document.getElementById('temp-orders-body');
    if (!body) return;
    body.replaceChildren();

    const totalLine = document.createElement('div');
    totalLine.className = 'small text-muted mb-3';
    totalLine.textContent = `Tổng: ${this.tempOrders.length} đơn đặt`;
    body.appendChild(totalLine);

    if (this.tempOrders.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-center text-muted py-5 temp-orders-empty';
      empty.innerHTML = `
        <i class="bi bi-bag-heart fs-1 d-block mb-3 text-warning"></i>
        <p class="fw-semibold mb-1">Chưa có đơn đặt nào.</p>
        <p class="small mb-0">Mở một sản phẩm và bấm <strong>Tạo đơn đặt (trải nghiệm)</strong> để tạo đơn đặt tại đây.</p>
      `;
      body.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'row row-cols-1 row-cols-md-2 g-3';

    this.tempOrders.forEach((order, index) => {
      const col = document.createElement('div');
      col.className = 'col';

      const card = document.createElement('div');
      card.className = 'card border-0 shadow-sm rounded-4 h-100 temp-order-card';

      const cardBody = document.createElement('div');
      cardBody.className = 'card-body p-3';

      const head = document.createElement('div');
      head.className = 'd-flex gap-3 align-items-start mb-2';

      const img = document.createElement('img');
      img.className = 'temp-order-thumb';
      img.src = order.productImage || '';
      img.alt = 'Ảnh sản phẩm';
      img.onerror = function () { this.src = 'https://placehold.co/80x80?text=Anh'; };

      const info = document.createElement('div');
      info.className = 'min-width-0 flex-grow-1';

      const label = document.createElement('div');
      label.className = 'small fw-bold text-warning mb-1';
      label.textContent = order.tempLabel;

      const name = document.createElement('div');
      name.className = 'fw-bold text-break';
      name.textContent = order.productTitle;

      const unit = document.createElement('div');
      unit.className = 'small text-danger fw-semibold mt-1';
      unit.textContent = this.formatPrice(order.unitPrice);

      info.append(label, name, unit);
      head.append(img, info);
      cardBody.appendChild(head);

      const meta = document.createElement('div');
      meta.className = 'small text-muted mb-3';
      meta.textContent = `Số lượng: ${order.quantity} • Tổng: ${this.formatPrice(order.total)} • Người nhận: ${order.customerName}`;
      cardBody.appendChild(meta);

      const status = document.createElement('div');
      status.className = 'badge temp-order-status bg-warning-subtle text-dark mb-3';
      status.textContent = 'Đơn đặt – Chưa gửi đến người bán';
      cardBody.appendChild(status);

      const detailBtn = document.createElement('button');
      detailBtn.type = 'button';
      detailBtn.className = 'btn btn-sm btn-outline-warning text-dark fw-semibold rounded-pill w-100';
      detailBtn.textContent = 'Xem chi tiết';
      detailBtn.addEventListener('click', () => this.renderTempOrderDetail(index));
      cardBody.appendChild(detailBtn);

      card.appendChild(cardBody);
      col.appendChild(card);
      grid.appendChild(col);
    });

    body.appendChild(grid);
  },

  renderTempOrderDetail(index) {
    const order = this.tempOrders[index];
    const body = document.getElementById('temp-orders-body');
    if (!order || !body) return;
    body.replaceChildren();

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'btn btn-light btn-sm rounded-pill mb-3 temp-order-back-btn';
    backBtn.innerHTML = '<i class="bi bi-arrow-left me-1"></i>Quay lại danh sách';
    backBtn.addEventListener('click', () => this.renderTempOrderList());
    body.appendChild(backBtn);

    const card = document.createElement('div');
    card.className = 'card border-0 shadow-sm rounded-4';

    const cardBody = document.createElement('div');
    cardBody.className = 'card-body p-3 p-md-4';

    const heading = document.createElement('div');
    heading.className = 'd-flex justify-content-between align-items-start gap-3 mb-3';

    const headingText = document.createElement('div');
    const title = document.createElement('h6');
    title.className = 'fw-bold mb-1';
    title.textContent = `Chi tiết ${order.tempLabel}`;
    const sub = document.createElement('div');
    sub.className = 'small text-muted';
    sub.textContent = 'Chỉ tồn tại trên trình duyệt, không gửi đến người bán và sẽ mất khi tải lại trang.';
    headingText.append(title, sub);

    const badge = document.createElement('span');
    badge.className = 'badge temp-order-status bg-warning-subtle text-dark text-nowrap';
    badge.textContent = 'Đơn đặt – Chưa gửi đến người bán';

    heading.append(headingText, badge);
    cardBody.appendChild(heading);

    const productRow = document.createElement('div');
    productRow.className = 'd-flex gap-3 align-items-start border rounded-3 bg-light p-3 mb-3';

    const img = document.createElement('img');
    img.className = 'temp-order-thumb-lg';
    img.src = order.productImage || '';
    img.alt = 'Ảnh sản phẩm';
    img.onerror = function () { this.src = 'https://placehold.co/120x120?text=Anh'; };

    const productInfo = document.createElement('div');
    productInfo.className = 'min-width-0';
    const productName = document.createElement('div');
    productName.className = 'fw-bold text-break';
    productName.textContent = order.productTitle;
    const productPrice = document.createElement('div');
    productPrice.className = 'text-danger fw-bold mt-1';
    productPrice.textContent = this.formatPrice(order.unitPrice);
    productInfo.append(productName, productPrice);

    productRow.append(img, productInfo);
    cardBody.appendChild(productRow);

    const list = document.createElement('div');
    list.className = 'temp-order-detail-list';
    const addRow = (label, value, highlight = false) => {
      const row = document.createElement('div');
      row.className = 'd-flex justify-content-between gap-3 py-2 border-bottom border-light';
      const labelEl = document.createElement('span');
      labelEl.className = 'text-muted text-nowrap small';
      labelEl.textContent = label;
      const valueEl = document.createElement('span');
      valueEl.className = highlight
        ? 'fw-bold text-danger text-end text-break'
        : 'fw-semibold text-end text-break small';
      valueEl.textContent = value;
      row.append(labelEl, valueEl);
      list.appendChild(row);
    };

    addRow('Tên sản phẩm', order.productTitle);
    addRow('Giá bán', this.formatPrice(order.unitPrice));
    addRow('Số lượng', String(order.quantity));
    addRow('Tổng tiền', this.formatPrice(order.total), true);
    addRow('Họ tên người nhận', order.customerName);
    addRow('Số điện thoại', order.phone);
    addRow('Địa chỉ nhận hàng', order.address);
    addRow('Ghi chú', order.note || 'Không có');
    addRow('Thời gian tạo', order.createdAt instanceof Date ? order.createdAt.toLocaleString('vi-VN') : String(order.createdAt || ''));
    addRow('Trạng thái', 'Đơn đặt – Chưa gửi đến người bán');
    cardBody.appendChild(list);

    const note = document.createElement('div');
    note.className = 'alert alert-warning small mt-3 mb-0';
    note.innerHTML = '<i class="bi bi-info-circle me-1"></i>Đơn đặt này không phải đơn hàng thật. Thông tin không được lưu vào hệ thống và không ảnh hưởng đến doanh thu, thống kê hay danh sách đơn hàng của người bán.';
    cardBody.appendChild(note);

    card.appendChild(cardBody);
    body.appendChild(card);
  },

  // Nhãn trạng thái đơn hàng thật (đồng bộ với backend)
  orderStatusLabel(status) {
    const labels = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      shipping: 'Đang giao hàng',
      completed: 'Đã hoàn thành',
      cancelled: 'Đã hủy'
    };
    return labels[status] || status || 'Không rõ';
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
    if (!this.currentUser) return;
    const requestId = (this.notificationCountRequestId || 0) + 1;
    this.notificationCountRequestId = requestId;

    return fetch('/api/chat/unread-count', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    })
      .then(async (res) => {
        if (!res.ok) return;
        const json = await res.json();
        if (requestId !== this.notificationCountRequestId) return;
        const badge = document.getElementById('unread-message-count');
        if (!badge) return;

        const count = Math.max(0, Number(json.data?.unreadCount) || 0);
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.toggle('d-none', count === 0);
        badge.setAttribute('aria-label', `${count} tin nhắn chưa đọc`);
        badge.title = `${count} tin nhắn chưa đọc`;
      })
      .catch(() => {});
  },

  connectNotificationSocket() {
    if (!this.currentUser) return Promise.resolve(null);
    if (this.notificationSocket) return Promise.resolve(this.notificationSocket);
    if (this.notificationSocketPromise) return this.notificationSocketPromise;

    this.notificationSocketPromise = new Promise((resolve) => {
      const connect = () => {
        if (typeof window.io !== 'function' || !this.currentUser) return resolve(null);

        this.notificationSocket = window.io({
          auth: { token: localStorage.getItem('token') || '' }
        });
        this.notificationSocket.on('new_message_notification', (notification) => {
          this.updateNotificationCount();
          document.dispatchEvent(new CustomEvent('patuhi:new-message', { detail: notification }));
        });
        this.notificationSocket.on('conversation_read', (notification) => {
          this.updateNotificationCount();
          document.dispatchEvent(new CustomEvent('patuhi:conversation-read', { detail: notification }));
        });
        this.notificationSocket.on('connect', () => this.updateNotificationCount());
        resolve(this.notificationSocket);
      };

      if (typeof window.io === 'function') {
        connect();
        return;
      }

      const script = document.createElement('script');
      script.src = '/socket.io/socket.io.js';
      script.onload = connect;
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });

    return this.notificationSocketPromise;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  PatuhiApp.init();
});
