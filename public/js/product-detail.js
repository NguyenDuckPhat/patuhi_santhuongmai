let currentProduct = null;
let sellerPhone = '';

document.addEventListener('DOMContentLoaded', () => {
  const urlParts = window.location.pathname.split('/');
  const productId = urlParts[urlParts.length - 1];
  if (productId) {
    loadProductDetail(productId);
  }
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
    document.getElementById('detail-time').innerText = PatuhiApp.formatTimeAgo(product.created_at);
    document.getElementById('detail-views').innerText = product.views;
    document.getElementById('detail-description').innerText = product.description;

    // Condition
    const condElem = document.getElementById('detail-condition');
    if (product.condition === 'new') {
      condElem.innerText = 'Mới 100%';
      condElem.className = 'badge bg-success condition-badge';
    } else if (product.condition === 'like_new') {
      condElem.innerText = 'Như mới 99%';
      condElem.className = 'badge bg-info text-dark condition-badge';
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
    const seller = product.seller || {};
    document.getElementById('seller-name').innerText = seller.full_name || 'Người bán';
    document.getElementById('seller-username').innerText = `@${seller.username || 'user'}`;
    document.getElementById('seller-avatar').src = seller.avatar || '/uploads/avatars/default.png';
    sellerPhone = product.phone_contact || seller.phone || 'Chưa cung cấp số';

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
      `;
    }

    // Show containers
    document.getElementById('detail-loading').classList.add('d-none');
    document.getElementById('col-left').classList.remove('d-none');
    document.getElementById('col-right').classList.remove('d-none');

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

function changeMainImage(url, elem) {
  document.getElementById('detail-main-img').src = url;
  document.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
  elem.classList.add('active');
}

function revealPhone() {
  document.getElementById('seller-phone-text').innerText = sellerPhone;
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
