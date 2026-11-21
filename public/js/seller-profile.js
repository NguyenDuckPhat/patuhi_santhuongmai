const sellerId = Number(new URLSearchParams(window.location.search).get('profile'));
let sellerProfile = null;
let listingRequest = 0;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('seller-share').addEventListener('click', shareSellerProfile);
  document.getElementById('seller-menu-share').addEventListener('click', shareSellerProfile);
  document.getElementById('seller-follow').addEventListener('click', toggleSellerFollow);
  document.getElementById('seller-all-listings').addEventListener('click', () => loadSellerListings('all'));
  document.getElementById('seller-filters').addEventListener('click', event => {
    const button = event.target.closest('button[data-status]');
    if (button) loadSellerListings(button.dataset.status);
  });
  document.getElementById('seller-load-more').addEventListener('click', event => {
    const { status, page } = event.currentTarget.dataset;
    loadSellerListings(status, Number(page));
  });
  loadSellerProfile();
  window.setInterval(refreshSellerActivity, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshSellerActivity();
  });
});

function renderSellerActivity(lastActiveAt) {
  const lastActive = lastActiveAt ? new Date(lastActiveAt).getTime() : NaN;
  const elapsed = Date.now() - lastActive;
  const online = Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 5 * 60 * 1000;
  const activity = document.getElementById('seller-activity');
  activity.parentElement.classList.toggle('is-online', online);
  activity.textContent = online ? 'Đang online' : lastActiveAt
    ? `Hoạt động ${PatuhiApp.formatTimeAgo(lastActiveAt).toLowerCase()}` : 'Chưa có dữ liệu hoạt động';
  activity.title = activity.textContent;
}

async function refreshSellerActivity() {
  if (!sellerProfile || document.hidden) return;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${sellerId}/seller`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (res.ok) sellerProfile.last_active_at = (await res.json()).data.last_active_at;
  } catch (error) {
    // Giữ mốc hoạt động gần nhất khi kết nối tạm thời bị gián đoạn.
  }
  renderSellerActivity(sellerProfile.last_active_at);
}

function formatSellerMembership(value) {
  if (!value) return 'Chưa có dữ liệu';
  const joined = new Date(value);
  if (Number.isNaN(joined.getTime())) return 'Chưa có dữ liệu';
  const now = new Date();
  let months = (now.getFullYear() - joined.getFullYear()) * 12 + now.getMonth() - joined.getMonth();
  if (now.getDate() < joined.getDate()) months--;
  if (months <= 0) return 'Dưới 1 tháng';
  const years = Math.floor(months / 12);
  return [years && `${years} năm`, months % 12 && `${months % 12} tháng`].filter(Boolean).join(' ');
}

async function loadSellerProfile() {
  try {
    if (!Number.isSafeInteger(sellerId) || sellerId <= 0) throw new Error('Hồ sơ người bán không hợp lệ.');
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${sellerId}/seller`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || 'Không thể tải hồ sơ người bán.');
    sellerProfile = json.data;
    const { seller, last_active_at, location, response_rate, rating, rating_count, listings, is_owner } = sellerProfile;
    const name = seller.full_name || seller.username || 'Người bán';
    document.title = `${name} — Hồ sơ người bán | Patuhi`;
    document.getElementById('seller-name').textContent = name;
    document.getElementById('seller-name').title = name;
    const initials = document.getElementById('seller-initials');
    initials.textContent = name.trim().split(/\s+/).slice(-2).map(word => Array.from(word)[0]).join('').toUpperCase();
    const avatar = document.getElementById('seller-avatar');
    avatar.onload = () => { avatar.hidden = false; initials.hidden = true; };
    avatar.onerror = () => { avatar.hidden = true; initials.hidden = false; };
    if (seller.avatar && seller.avatar !== '/uploads/avatars/default.png') {
      avatar.src = seller.avatar;
    }
    renderSellerActivity(last_active_at);
    document.getElementById('seller-location').textContent = location || 'Chưa có thông tin khu vực';
    document.getElementById('seller-location').title = location || 'Chưa có thông tin khu vực';
    document.getElementById('seller-joined').textContent = formatSellerMembership(seller.createdAt || seller.created_at);
    document.getElementById('seller-response').textContent = response_rate === null ? 'Chưa có dữ liệu' : `${response_rate}%`;
    document.getElementById('seller-response').parentElement.title = `Tỷ lệ phản hồi: ${response_rate === null ? 'Chưa có dữ liệu' : `${response_rate}%`}`;
    document.getElementById('seller-rating-value').textContent = rating === null ? '—' : Number(rating).toFixed(1);
    document.getElementById('seller-rating-count').textContent = `( ${rating_count} đánh giá)`;
    document.getElementById('seller-rating').setAttribute('aria-label', rating === null
      ? 'Chưa có đánh giá' : `${Number(rating).toFixed(1)} trên 5 sao, ${rating_count} đánh giá`);
    document.getElementById('seller-follow').hidden = is_owner;
    updateSellerFollow();
    document.querySelectorAll('#seller-filters button').forEach(button => {
      const label = button.dataset.status === 'approved' ? 'Tin đang hoạt động' : 'Đã bán';
      button.textContent = `${label} ( ${listings[button.dataset.status]} )`;
    });
    document.getElementById('seller-all-listings').textContent = `Tất cả tin đăng ( ${listings.all} )`;
    document.getElementById('seller-content').hidden = false;
    loadSellerListings('approved');
  } catch (error) {
    const feedback = document.getElementById('seller-error');
    feedback.textContent = error.message || 'Không thể tải hồ sơ người bán.';
    feedback.hidden = false;
  } finally {
    document.getElementById('seller-loading').hidden = true;
  }
}

async function loadSellerListings(status, page = 1) {
  const request = ++listingRequest;
  const list = document.getElementById('seller-listings');
  const feedback = document.getElementById('seller-listing-status');
  const more = document.getElementById('seller-load-more');
  more.hidden = true;
  if (page === 1) {
    list.replaceChildren();
    document.querySelectorAll('#seller-filters button').forEach(button => {
      const selected = button.dataset.status === status;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', selected);
    });
  }
  feedback.textContent = 'Đang tải tin đăng…';
  feedback.hidden = false;
  try {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/users/${sellerId}/seller/listings?status=${status}&page=${page}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) throw new Error('Không thể tải tin đăng');
    const { products, totalPages } = (await res.json()).data;
    if (request !== listingRequest) return;
    feedback.textContent = page === 1 && !products.length ? 'Không có tin đăng trong mục này.' : '';
    feedback.hidden = !feedback.textContent;
    for (const product of products) {
      list.append(createSellerListingCard(product));
    }
    more.dataset.status = status;
    more.dataset.page = page + 1;
    more.textContent = 'Xem thêm';
    more.hidden = page >= totalPages;
  } catch (error) {
    if (request !== listingRequest) return;
    feedback.textContent = 'Không thể tải tin đăng.';
    more.dataset.status = status;
    more.dataset.page = page;
    more.textContent = 'Thử lại';
    more.hidden = false;
  }
}

function updateSellerFollow() {
  const button = document.getElementById('seller-follow');
  button.setAttribute('aria-pressed', sellerProfile.is_following);
  document.getElementById('seller-follow-label').textContent = sellerProfile.is_following ? 'Đang theo dõi' : 'Theo dõi';
  document.getElementById('seller-followers').textContent = sellerProfile.followers.toLocaleString('vi-VN');
}

async function toggleSellerFollow() {
  const token = localStorage.getItem('token');
  const loginUrl = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  if (!token) {
    window.location.href = loginUrl;
    return;
  }
  const button = document.getElementById('seller-follow');
  button.disabled = true;
  try {
    const res = await fetch(`/api/users/${sellerId}/follow`, {
      method: sellerProfile.is_following ? 'DELETE' : 'PUT',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      window.location.href = loginUrl;
      return;
    }
    const json = await res.json();
    if (!res.ok) throw new Error(json.message);
    Object.assign(sellerProfile, json.data);
    updateSellerFollow();
  } catch (error) {
    PatuhiApp.showToast(error.message || 'Không thể cập nhật theo dõi.', 'danger');
  } finally {
    button.disabled = false;
  }
}

async function shareSellerProfile() {
  const url = new URL(`/profile?profile=${sellerId}`, window.location.origin).href;
  if (navigator.share) {
    try {
      await navigator.share({ title: document.title, url });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    PatuhiApp.showToast('Đã sao chép liên kết hồ sơ người bán.', 'success');
  } catch (error) {
    window.prompt('Sao chép liên kết hồ sơ người bán', url);
  }
}
