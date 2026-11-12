const productListings = [
  {
    image: "https://cdn.chotot.com/DtlJKxY0VO9LL3PXPUyaXJ8uvBgu0WODBWEAZav1kGQ/preset:listing/plain/f146666857f52907b531a0be5c967fa4-3009027206834083090.jpg",
    alt: "Mèo Anh lông lửng 3 tháng tuổi",
    title: "Mèo Anh lông lửng 3 tháng tuổi",
    condition: "Khác - Mèo nhỏ (dưới 1 năm tuổi)", price: "1.500.000 đ", date: "2 tuần trước", views: "2", city: "Thị xã Bến Cát", area: "P. Phú An mới",
    href: "https://www.chotot.com/mua-ban-meo-thi-xa-ben-cat-binh-duong/135590180.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/N24O129QZXV8jbBpya7Rq2wvySw4ICX0Uz1gnfD-NT4/preset:listing/plain/d433dfcfbd69569bd2c18fc0fc5562bd-3003521881485965319.jpg",
    alt: "iPhone 14PM 128/256 ZinApp BAO NỢ XẤU CHỈ OĐ",
    title: "iPhone 14PM 128/256 ZinApp BAO NỢ XẤU CHỈ OĐ",
    condition: "iPhone 14 Pro Max - 128 GB - Còn bảo hành", price: "14.900.000 đ", date: "Tin tiêu biểu", views: "4", city: "Quận 3", area: "P. Nhiêu Lộc mới",
    href: "https://www.chotot.com/mua-ban-dien-thoai-quan-3-tp-ho-chi-minh/134871438.htm?ad_delivery=true&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/Ae10rjDlyFmRmiEWHYWu0ydKxglsZaX7Z9VyhyNTDxE/preset:listing/plain/c0f39372ba4853e9e079e6b5e99894d7-3008762500017466405.jpg",
    alt: "Chó và Mèo",
    title: "Chó và Mèo", condition: "Khác - Mèo con (dưới 3 tháng tuổi)", price: "50.000 đ", date: "2 tuần trước", views: "3", city: "Thành phố Dĩ An", area: "P. Tân Đông Hiệp mới",
    href: "https://www.chotot.com/mua-ban-meo-thanh-pho-di-an-binh-duong/135560098.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/16vjTa4o3wUGVjzaiBdpwklQeKMsc5WolFBNoS2k1v0/preset:listing/plain/19c9372ecdd32afa224a619974b0a40e-3008761757065849893.jpg",
    alt: "Mèo con đực vằn vện 1 tháng hơn",
    title: "Mèo con đực vằn vện 1 tháng hơn", condition: "Mèo Mướp - Mèo con (dưới 3 tháng tuổi)", gift: true, date: "2 tuần trước", views: "3", city: "Quận 7", area: "P. Tân Hưng mới",
    href: "https://www.chotot.com/mua-ban-meo-quan-7-tp-ho-chi-minh/135560000.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/_quAw_HXSk8cH3RJaMknRE9MfadB7WDXTgmVC9kWXq4/preset:listing/plain/87b0d47d2d7e5c57749f417f6dd8d3e4-3009645433668988152.jpg",
    alt: "Mèo con xám cam 3 tháng tuổi",
    title: "Mèo con xám cam 3 tháng tuổi", condition: "Mèo Ta - Mèo nhỏ (dưới 1 năm tuổi)", gift: true, date: "6 ngày trước", views: "3", city: "Thành phố Thủ Đức", area: "P. Hiệp Bình mới",
    href: "https://www.chotot.com/mua-ban-meo-thanh-pho-thu-duc-tp-ho-chi-minh/135672172.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/dZ3OWJOZN9XUFsfvPB8y0i-AYHaPEv_Ltj9Z6sJY7EM/preset:listing/plain/137e6afe080d712fa4fc49b0c55bd97a-3010143104345887238.jpg",
    alt: "Mèo con nhỏ nhanh nhẹn màu đa dạng",
    title: "Mèo con nhỏ nhanh nhẹn màu đa dạng", condition: "Mèo Ta - Mèo nhỏ (dưới 1 năm tuổi)", gift: true, date: "3 ngày trước", city: "Q. Gò Vấp", area: "P. An Nhơn mới",
    href: "https://www.chotot.com/mua-ban-meo-quan-go-vap-tp-ho-chi-minh/135728646.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/0jseC8fMl2vnlA3kzJVO5-aALjSFj4PqdMUUDvSwnYU/preset:listing/plain/0339510e8e61ddb8988a19397a0a865c-3009789426802996087.jpg",
    alt: "12PRO MAX 128/256 99% Góp Tay Đôi Cửa Hàng",
    title: "12PRO MAX 128/256 99% Góp Tay Đôi Cửa Hàng", condition: "iPhone 12 Pro Max - 128 GB - Hết bảo hành", price: "9.800.000 đ", date: "Tin tiêu biểu", views: "6", city: "Thành phố Thủ Đức", area: "P. Thủ Đức mới",
    href: "https://www.chotot.com/mua-ban-dien-thoai-thanh-pho-thu-duc-tp-ho-chi-minh/135691385.htm?ad_delivery=true&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/0THEDIQ0BXZEYxALSnW2aYOSJ6hyiclTdHns-NU31QY/preset:listing/plain/0e80939853f4bf074982222350486ae1-3009601240824606079.jpg",
    alt: "Mèo ta tam thể sơ sinh",
    title: "Mèo ta tam thể sơ sinh", condition: "Mèo Ta - Mèo con (dưới 3 tháng tuổi)", gift: true, date: "7 ngày trước", views: "4", city: "Q. Gò Vấp", area: "P. An Hội Đông mới",
    href: "https://www.chotot.com/mua-ban-meo-quan-go-vap-tp-ho-chi-minh/135663957.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  {
    image: "https://cdn.chotot.com/iltEI84Ac2Zto4eSyye4g6s03NcBarm-9fTWDLjfRiY/preset:listing/plain/270838b6e2acfe374633380d7ddd388d-3008995219435063572.jpg",
    alt: "Mèo con 2 tháng",
    title: "Mèo con 2 tháng", condition: "Mèo Ta - Mèo con (dưới 3 tháng tuổi)", gift: true, date: "2 tuần trước", views: "3", city: "Quận 8", area: "P. Bình Đông mới",
    href: "https://www.chotot.com/mua-ban-meo-quan-8-tp-ho-chi-minh/135582613.htm?ad_source=recoad&event_source=ct_home_recommend_section",
  },
  { image: "https://cdn.chotot.com/jS9pQBFS4vkKtGUbM2Vv2_lE3bW-lV4gVnceVtBGuF0/preset:listing/plain/2dad59abbdf14a0ef8526271d53142bc-3009792406092805698.jpg", alt: "Mèo con trắng xám cái và đực", title: "Mèo con trắng xám cái và đực", condition: "Mèo con", date: "5 ngày trước", city: "Q. Tân Phú", area: "P. Phú Thạnh mới" },
  { image: "https://cdn.chotot.com/y_0PwLq9T80dfhmvkwUhsJtR193J8VG9xcAEHgU8wAg/preset:listing/plain/0333c5ef925aa83e6628298d6c59ad67-3008896477374136937.jpg", alt: "Mèo con 4 tháng tuổi", title: "Mèo con 4 tháng tuổi", condition: "Mèo Ta", city: "Quận Tân Phú" },
  { image: "https://cdn.chotot.com/bERvLuJIiqpQgE7U0faOzuBfYZn-jkI_tpGUxEwJVis/preset:listing/plain/92816341cfa19c510eb37878cd3a2d0f-3010210941165523325.jpg", alt: "Mèo Anh lông ngắn Golden cái", title: "Mèo Anh lông ngắn Golden cái", condition: "Mèo Anh lông ngắn", city: "Quận Bình Tân" },
  { image: "https://cdn.chotot.com/4Z2e2etyoduIrHvXLOxaK_GvQ5Uq8x8YLoe1PDEV_e8/preset:listing/plain/324db0b748fa6a0af45d7566d69eb76f-3010221147621443420.jpg", alt: "Mèo Silive xám bạc trong nước", title: "Mèo Silive xám bạc trong nước", condition: "Mèo con", city: "Quận Gò Vấp" },
  { image: "https://cdn.chotot.com/8bm3BtbK22A2xcjYrB4FayZXydedy8bUEQ--YG1W5xQ/preset:listing/plain/b6c5af52988d0803e737660dba85abed-3010306729296691844.jpg", alt: "16PRO MAX 256 99% Góp Tay Đôi Cửa Hàng", title: "16PRO MAX 256 99% Góp Tay Đôi Cửa Hàng", condition: "iPhone 16 Pro Max", city: "Thành phố Thủ Đức" },
  { image: "https://cdn.chotot.com/WtRGYiSHKIfnh7xvk05Nd41sDO85383ikMuJGKnv_dw/preset:listing/plain/00a3210189d0f863d7dd10c1c34dcfb5-3003521223420627693.jpg", alt: "iPhone 16Pro 128/256 ZinApp", title: "iPhone 16Pro 128/256 ZinApp", condition: "iPhone 16 Pro", city: "Quận 3" },
  { image: "https://cdn.chotot.com/IT_XQ49gxgc4s3srm_uxc6Er06RpjyTKTTqBcBgPYmo/preset:listing/plain/6aa3d1a8abdbcafa1606f978776fa317-3009947070997514808.jpg", alt: "Bé là mèo bengal", title: "Bé là mèo bengal", condition: "Mèo Bengal", city: "Quận 11" },
  { image: "https://cdn.chotot.com/6g_v58HbNpmvzURaAklyEgCJl1Pt5IP83oO3-CpozBY/preset:listing/plain/90eed1a6a233f218ac668af4b632b6cc-3009915310604440061.jpg", alt: "Mèo con dưới 6 tháng tuổi (4 con)", title: "Mèo con dưới 6 tháng tuổi (4 con)", condition: "Mèo con", city: "Quận 3" },
  { image: "https://cdn.chotot.com/Lp3FcguZroK-TVhWsn-1FyKt23nzH7gcP3Noz_W4fcg/preset:listing/plain/57c20ada4682ea5551b66cb4f89a7102-3009443908444132640.jpg", alt: "Mèo ta 3 tháng tuổi", title: "Mèo ta 3 tháng tuổi", condition: "Mèo Ta - Mèo con", city: "Thành phố Dĩ An" },
  { image: "https://videodelivery.net/26b6f54e58c17399c61d2059b8fd4cea/thumbnails/thumbnail.jpg", alt: "Tìm nhà mới cho các bé", title: "Tìm nhà mới cho các bé", condition: "Mèo con", city: "Quận Bình Thạnh" },
  { image: "https://videodelivery.net/6da0af73f587f66518e4a33879e665b0/thumbnails/thumbnail.jpg", alt: "Bé mèo gái Anh lông ngắn xám trắng 2 tháng tuổi", title: "Bé mèo gái Anh lông ngắn xám trắng 2 tháng tuổi", condition: "Mèo Anh lông ngắn", city: "Quận 4" },
  { image: "https://videodelivery.net/f851ec453c3c17d9859d6db35c44b985/thumbnails/thumbnail.jpg", alt: "Tặng 4 bé mèo con", title: "Tặng 4 bé mèo con", condition: "Mèo con", city: "Thành phố Thủ Dầu Một" },
  { image: "https://videodelivery.net/1649fb47ad0dd469ee09e0af3b8c19a4/thumbnails/thumbnail.jpg", alt: "Cho tặng 3 bé Mèo con 50 ngày tuổi", title: "Cho tặng 3 bé Mèo con 50 ngày tuổi", condition: "Mèo con", city: "Quận Gò Vấp" },
  { image: "https://videodelivery.net/7a4aca8c900984c61729d9c5502268fa/thumbnails/thumbnail.jpg", alt: "Mèo tam thể trắng vàng 6 tháng tuổi", title: "Mèo tam thể trắng vàng 6 tháng tuổi", condition: "Mèo Ta", city: "Quận 11" },
];

const productGrid = document.getElementById("product-grid");

if (productGrid) {
  const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  productGrid.className = "product-grid";
  productGrid.innerHTML = productListings.map((listing) => {
    const href = escapeHtml(listing.href || "#");
    const views = listing.views ? `<span>${escapeHtml(listing.views)}</span><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#product-view-icon"/></svg>` : "";
    const footer = listing.date || views ? `<div class="product-card__meta"><span class="product-card__date">${escapeHtml(listing.date || "")}</span><span class="product-card__views">${views}</span></div>` : "";
    const detail = listing.gift
      ? `<span class="product-card__gift">Cho tặng</span>`
      : listing.price ? `<span class="product-card__price">${escapeHtml(listing.price)}</span>` : "";

    return `<article class="product-card">
      <a class="product-card__link" href="${href}" target="_blank" rel="noreferrer">
        <div class="product-card__media"><img class="product-card__image" src="${escapeHtml(listing.image)}" alt="${escapeHtml(listing.alt)}" loading="lazy" />${footer}</div>
        <div class="product-card__body"><div class="product-card__details"><span class="product-card__title">${escapeHtml(listing.title)}</span>${listing.condition ? `<span class="product-card__condition">${escapeHtml(listing.condition)}</span>` : ""}${detail}</div><div class="product-card__footer"><div class="product-card__location"><svg viewBox="0 0 15 15" aria-hidden="true"><use href="#product-location-icon"/></svg><span class="product-card__location-text"><span>${escapeHtml(listing.city || "")}</span><span>${escapeHtml(listing.area || "")}</span></span></div><button class="product-card__more" type="button" aria-label="Tùy chọn tin đăng"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#product-more-icon"/></svg></button></div></div>
      </a>
      <button class="product-card__save" type="button" aria-label="Lưu tin"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#product-save-icon"/></svg></button>
    </article>`;
  }).join("");
}

document.querySelectorAll(".product-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".product-tab").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
  });
});
