// Quản lý hiển thị danh sách sản phẩm, lọc, tìm kiếm và phân trang
let currentPage = 1;
const limit = 12;

document.addEventListener('DOMContentLoaded', () => {
  loadCategories();
  loadProducts();
});

// 1. Tải danh sách danh mục
async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (!json.success) return;

    const cats = json.data.categories;
    const grid = document.getElementById('categories-grid');
    const filterSelect = document.getElementById('filter-category');

    if (grid) {
      grid.innerHTML = cats.map(c => `
        <div class="col">
          <a href="javascript:void(0)" onclick="selectCategory(${c.id})" class="category-card p-3 d-flex flex-column align-items-center h-100">
            <i class="bi ${c.icon || 'bi-tag'} category-icon mb-2"></i>
            <span class="small fw-semibold text-truncate w-100 text-center">${c.name}</span>
          </a>
        </div>
      `).join('');
    }

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">Tất cả danh mục</option>' + 
        cats.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  } catch (e) {
    console.error('Lỗi tải danh mục:', e);
  }
}

// 2. Tải danh sách sản phẩm
async function loadProducts(page = 1) {
  currentPage = page;
  const productList = document.getElementById('product-list');
  const emptyState = document.getElementById('empty-state');
  const totalResults = document.getElementById('total-results');

  const q = document.getElementById('search-input')?.value || '';
  const category_id = document.getElementById('filter-category')?.value || '';
  const condition = document.getElementById('filter-condition')?.value || '';
  const min_price = document.getElementById('filter-min-price')?.value || '';
  const max_price = document.getElementById('filter-max-price')?.value || '';
  const sort = document.getElementById('filter-sort')?.value || 'newest';

  const params = new URLSearchParams({
    page,
    limit,
    sort
  });
  if (q) params.append('q', q);
  if (category_id) params.append('category_id', category_id);
  if (condition) params.append('condition', condition);
  if (min_price) params.append('min_price', min_price);
  if (max_price) params.append('max_price', max_price);

  try {
    const res = await fetch(`/api/products?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (!json.success) return;

    const { products, total, totalPages } = json.data;

    totalResults.innerText = `Tìm thấy ${total} sản phẩm`;

    if (!products || products.length === 0) {
      productList.innerHTML = '';
      emptyState.classList.remove('d-none');
      renderPagination(0, 1);
      return;
    }

    emptyState.classList.add('d-none');

    productList.innerHTML = products.map(p => {
      const primaryImg = (p.images && p.images.length > 0)
        ? p.images.find(img => img.is_primary)?.image_url || p.images[0].image_url
        : 'https://placehold.co/400x300?text=Khong+co+anh';

      let conditionLabel = 'Đã qua sử dụng';
      let conditionClass = 'bg-secondary text-white';
      if (p.condition === 'new') {
        conditionLabel = 'Mới 100%';
        conditionClass = 'bg-success text-white';
      } else if (p.condition === 'like_new') {
        conditionLabel = 'Như mới 99%';
        conditionClass = 'bg-info text-dark';
      } else if (p.condition === 'other') {
        conditionLabel = p.condition_detail || 'Tình trạng khác';
        conditionClass = 'bg-secondary text-white';
      }

      return `
        <div class="col">
          <div class="product-card position-relative">
            <div class="product-img-wrapper">
              <a href="/product/${p.id}">
                <img src="${primaryImg}" alt="${p.title}" loading="lazy" onerror="this.src='https://placehold.co/400x300?text=Hinh+Anh'">
              </a>
              <button class="btn-favorite-icon ${p.is_favorited ? 'active' : ''}" 
                      onclick="toggleFavorite(event, ${p.id}, this)" 
                      title="${p.is_favorited ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}">
                <i class="bi ${p.is_favorited ? 'bi-heart-fill' : 'bi-heart'}"></i>
              </button>
            </div>
            <div class="p-3 d-flex flex-column flex-grow-1">
              <span class="badge ${conditionClass} condition-badge align-self-start mb-2">${conditionLabel}</span>
              <h6 class="fw-bold mb-1 text-truncate-2">
                <a href="/product/${p.id}" class="text-dark text-decoration-none" title="${p.title}">
                  ${p.title}
                </a>
              </h6>
              <div class="product-price mb-2">${PatuhiApp.formatPrice(p.price)}</div>
              <div class="mt-auto d-flex justify-content-between align-items-center text-muted small pt-2 border-top">
                <span class="text-truncate" style="max-width: 140px;">
                  <i class="bi bi-geo-alt me-1"></i>${p.location}
                </span>
                <span>${PatuhiApp.formatTimeAgo(p.created_at || p.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    renderPagination(totalPages, currentPage);
  } catch (err) {
    console.error('Lỗi tải sản phẩm:', err);
  }
}

// 3. Chọn danh mục từ icon
function selectCategory(catId) {
  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    catSelect.value = catId;
    applyFilters();
  }
}

// 4. Áp dụng bộ lọc
function applyFilters() {
  loadProducts(1);
}

// 5. Đặt lại bộ lọc
function resetFilters() {
  const searchInput = document.getElementById('search-input');
  const catSelect = document.getElementById('filter-category');
  const condSelect = document.getElementById('filter-condition');
  const minPrice = document.getElementById('filter-min-price');
  const maxPrice = document.getElementById('filter-max-price');
  const sortSelect = document.getElementById('filter-sort');

  if (searchInput) searchInput.value = '';
  if (catSelect) catSelect.value = '';
  if (condSelect) condSelect.value = '';
  if (minPrice) minPrice.value = '';
  if (maxPrice) maxPrice.value = '';
  if (sortSelect) sortSelect.value = 'newest';

  loadProducts(1);
}

// 6. Xử lý Thêm / Bỏ yêu thích
async function toggleFavorite(event, productId, btn) {
  event.preventDefault();
  event.stopPropagation();

  if (!PatuhiApp.currentUser) {
    PatuhiApp.showToast('Vui lòng đăng nhập để lưu sản phẩm vào danh sách yêu thích!', 'warning');
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
    }, 1200);
    return;
  }

  const isFavorited = btn.classList.contains('active');
  const method = isFavorited ? 'DELETE' : 'POST';

  try {
    const res = await fetch(`/api/favorites/${productId}`, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        'Content-Type': 'application/json'
      }
    });
    const json = await res.json();

    if (res.ok) {
      if (isFavorited) {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="bi bi-heart"></i>';
        PatuhiApp.showToast('Đã xóa khỏi danh sách yêu thích.', 'info');
      } else {
        btn.classList.add('active');
        btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
        PatuhiApp.showToast('Đã thêm vào danh sách yêu thích!', 'success');
      }
    } else {
      PatuhiApp.showToast(json.message || 'Lỗi thao tác yêu thích', 'danger');
    }
  } catch (err) {
    PatuhiApp.showToast('Lỗi kết nối máy chủ.', 'danger');
  }
}

// 7. Render phân trang
function renderPagination(totalPages, activePage) {
  const container = document.getElementById('pagination-container');
  if (!container || totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '<ul class="pagination shadow-sm">';
  html += `
    <li class="page-item ${activePage === 1 ? 'disabled' : ''}">
      <button class="page-link" onclick="loadProducts(${activePage - 1})"><i class="bi bi-chevron-left"></i></button>
    </li>
  `;

  for (let i = 1; i <= totalPages; i++) {
    html += `
      <li class="page-item ${i === activePage ? 'active' : ''}">
        <button class="page-link" onclick="loadProducts(${i})">${i}</button>
      </li>
    `;
  }

  html += `
    <li class="page-item ${activePage === totalPages ? 'disabled' : ''}">
      <button class="page-link" onclick="loadProducts(${activePage + 1})"><i class="bi bi-chevron-right"></i></button>
    </li>
  `;
  html += '</ul>';

  container.innerHTML = html;
}
