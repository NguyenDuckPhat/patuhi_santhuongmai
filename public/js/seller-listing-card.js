// Component dùng chung cho từng tin đăng trong hồ sơ người bán.
function createSellerListingCard(product) {
  const card = document.createElement('li');
  card.className = 'seller-ad';
  card.innerHTML = `
    <a class="seller-ad-link">
      <div class="seller-ad-media">
        <img class="seller-ad-image" loading="lazy">
        <div class="seller-ad-overlay">
          <p class="seller-ad-time"></p>
          <div class="seller-ad-image-count">
            <span></span>
            <svg class="seller-ad-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true"><use href="#icon-1"/></svg>
            <svg class="seller-ad-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true"><use href="#icon-2"/></svg>
          </div>
        </div>
      </div>
      <div class="seller-ad-info">
        <div class="seller-ad-summary"><p class="seller-ad-title"></p><p class="seller-ad-price"></p></div>
        <div class="seller-ad-location"><span></span><svg class="seller-ad-icon" viewBox="0 0 24 24" width="1em" height="1em" fill="none" aria-hidden="true"><use href="#icon-4"/></svg></div>
      </div>
    </a>
    <button type="button" class="seller-ad-favorite" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><use href="#icon-3"/></svg>
    </button>`;
  const link = card.querySelector('.seller-ad-link');
  if (product.status !== 'sold') link.href = `/product/${product.id}`;
  else link.setAttribute('aria-label', `${product.title} — Đã bán`);

  const images = product.images || [];
  const primaryImage = images.find(image => image.is_primary) || images[0];
  const image = card.querySelector('.seller-ad-image');
  const placeholder = '/images/product-placeholder.svg';
  image.alt = product.title;
  image.onerror = () => { image.onerror = null; image.src = placeholder; };
  image.src = primaryImage?.image_url || placeholder;
  card.querySelector('.seller-ad-title').textContent = product.title;
  card.querySelector('.seller-ad-title').title = product.title;
  card.querySelector('.seller-ad-price').textContent = product.price == null
    ? 'Thương lượng' : `${new Intl.NumberFormat('vi-VN').format(Number(product.price))} đ`;
  card.querySelector('.seller-ad-time').textContent = product.status === 'sold'
    ? 'Đã bán' : PatuhiApp.formatTimeAgo(product.created_at || product.createdAt);
  card.querySelector('.seller-ad-image-count span').textContent = images.length;
  card.querySelector('.seller-ad-image-count').setAttribute('aria-label', `${images.length} ảnh`);
  card.querySelector('.seller-ad-location span').textContent = product.location || '';
  card.querySelector('.seller-ad-location').title = product.location || '';

  const favorite = card.querySelector('.seller-ad-favorite');
  const updateFavorite = () => {
    favorite.setAttribute('aria-pressed', Boolean(product.is_favorited));
    favorite.setAttribute('aria-label', `${product.is_favorited ? 'Bỏ lưu' : 'Lưu tin'}: ${product.title}`);
  };
  updateFavorite();
  favorite.addEventListener('click', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }
    favorite.disabled = true;
    try {
      const res = await fetch(`/api/favorites/${product.id}`, {
        method: product.is_favorited ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Không thể lưu tin đăng.');
      product.is_favorited = !product.is_favorited;
      updateFavorite();
    } catch (error) {
      PatuhiApp.showToast(error.message || 'Không thể lưu tin đăng.', 'danger');
    } finally {
      favorite.disabled = false;
    }
  });
  return card;
}
