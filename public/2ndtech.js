const searchForm = document.querySelector(".search-form");
const searchButton = document.querySelector(".search-submit");

if (searchForm && searchButton) {
  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams(new FormData(searchForm));
    window.location.href = `/tim-kiem?${params.toString()}`;
  });
}

const provinceSelect = searchForm?.querySelector('select[name="provinceCode"]');
if (provinceSelect) {
  const provinces = [...provinceSelect.options]
    .filter((option) => option.value)
    .map((option) => ({ code: option.value, name: option.textContent.trim() }));
  const oldLocationField = provinceSelect.closest(".search-select");
  const locationField = document.createElement("div");
  locationField.className = "search-select location-filter";
  oldLocationField.replaceWith(locationField);
  locationField.innerHTML = `
    <button class="location-filter__toggle" type="button" aria-expanded="false" aria-controls="location-options">
      <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-pin"></use></svg>
      <span>Chọn khu vực</span><span class="location-filter__chevron" aria-hidden="true"></span>
    </button>
    <div class="location-filter__menu" id="location-options" hidden>
      <label class="location-filter__search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-search"></use></svg>
        <input type="search" placeholder="Tìm tỉnh/thành..." aria-label="Tìm tỉnh hoặc thành phố">
      </label>
      <div class="location-filter__options"></div>
      <p class="location-filter__empty" hidden>Không tìm thấy tỉnh/thành phù hợp.</p>
    </div>`;

  const toggle = locationField.querySelector(".location-filter__toggle");
  const menu = locationField.querySelector(".location-filter__menu");
  const searchInput = menu.querySelector('input[type="search"]');
  const options = menu.querySelector(".location-filter__options");
  const emptyMessage = menu.querySelector(".location-filter__empty");
  const label = toggle.querySelector("span");
  options.replaceChildren(...provinces.map(({ code, name }) => {
    const item = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "provinceCode";
    checkbox.value = code;
    const text = document.createElement("span");
    text.textContent = name;
    item.append(checkbox, text);
    return item;
  }));
  const checkboxes = [...options.querySelectorAll('input[name="provinceCode"]')];
  const normalizeProvinceName = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
  searchInput.addEventListener("input", () => {
    const query = normalizeProvinceName(searchInput.value.trim());
    let visibleCount = 0;
    checkboxes.forEach((checkbox) => {
      const item = checkbox.closest("label");
      item.hidden = !normalizeProvinceName(checkbox.nextElementSibling.textContent).includes(query);
      if (!item.hidden) visibleCount += 1;
    });
    emptyMessage.hidden = visibleCount > 0;
  });
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    menu.hidden = isOpen;
    if (!isOpen) searchInput.focus();
  });
  checkboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
    const selected = checkboxes.filter((item) => item.checked).map((item) => item.nextElementSibling.textContent);
    label.textContent = selected.length > 2 ? `${selected.length} khu vực đã chọn` : selected.join(", ") || "Chọn khu vực";
  }));
  document.addEventListener("click", (event) => {
    if (!locationField.contains(event.target)) {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
  });
  locationField.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      toggle.focus();
    }
  });
}

const categorySelect = searchForm?.querySelector('select[name="cat"]');
if (categorySelect) {
  const categories = [...categorySelect.options]
    .filter((option) => option.value)
    .map((option) => ({ code: option.value, name: option.textContent.trim() }));
  const oldCategoryField = categorySelect;
  const categoryField = document.createElement("div");
  categoryField.className = "category-filter";
  oldCategoryField.replaceWith(categoryField);
  categoryField.innerHTML = `
    <button class="location-filter__toggle" type="button" aria-expanded="false" aria-controls="category-options">
      <span>Tất cả danh mục</span><span class="location-filter__chevron" aria-hidden="true"></span>
    </button>
    <div class="location-filter__menu" id="category-options" hidden>
      <label class="location-filter__search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-search"></use></svg>
        <input type="search" placeholder="Tìm danh mục..." aria-label="Tìm danh mục">
      </label>
      <div class="location-filter__options"></div>
      <p class="location-filter__empty" hidden>Không tìm thấy danh mục phù hợp.</p>
    </div>`;

  const toggle = categoryField.querySelector(".location-filter__toggle");
  const menu = categoryField.querySelector(".location-filter__menu");
  const searchInput = menu.querySelector('input[type="search"]');
  const options = menu.querySelector(".location-filter__options");
  const emptyMessage = menu.querySelector(".location-filter__empty");
  const label = toggle.querySelector("span");
  options.replaceChildren(...categories.map(({ code, name }) => {
    const item = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "cat";
    checkbox.value = code;
    const text = document.createElement("span");
    text.textContent = name;
    item.append(checkbox, text);
    return item;
  }));
  const checkboxes = [...options.querySelectorAll('input[name="cat"]')];
  const normalizeCategoryName = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLocaleLowerCase("vi");
  searchInput.addEventListener("input", () => {
    const query = normalizeCategoryName(searchInput.value.trim());
    let visibleCount = 0;
    checkboxes.forEach((checkbox) => {
      const item = checkbox.closest("label");
      item.hidden = !normalizeCategoryName(checkbox.nextElementSibling.textContent).includes(query);
      if (!item.hidden) visibleCount += 1;
    });
    emptyMessage.hidden = visibleCount > 0;
  });
  toggle.addEventListener("click", () => {
    const isOpen = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!isOpen));
    menu.hidden = isOpen;
    if (!isOpen) searchInput.focus();
  });
  checkboxes.forEach((checkbox) => checkbox.addEventListener("change", () => {
    const selected = checkboxes.filter((item) => item.checked).map((item) => item.nextElementSibling.textContent);
    label.textContent = selected.length > 2 ? `${selected.length} danh mục đã chọn` : selected.join(", ") || "Tất cả danh mục";
  }));
  document.addEventListener("click", (event) => {
    if (!categoryField.contains(event.target)) {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
    }
  });
  categoryField.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggle.setAttribute("aria-expanded", "false");
      menu.hidden = true;
      toggle.focus();
    }
  });
}

document.querySelectorAll(".listing-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".listing-tab").forEach((item) => item.classList.toggle("is-active", item === tab));
  });
});

const productListings = [
  {image:"https://cdn.2ndtech.vn/external-imports/chotot/134223427/image-1-88e04609-7384-4923-ba98-e2763fecf4c0.jpg",alt:"Dell Latitude 5320 i7 13.3 inch 16GB/256GB",price:"7.777.777đ",title:"Dell Latitude 5320 i7 13.3 inch 16GB/256GB",category:"Laptop",seller:"Nguyễn Tiến Quý",location:"Thành phố Buôn Ma Thuột, Đắk Lắk",quality:"Tốt",date:"6 ngày trước",shop:true},
  {image:"https://cdn.2ndtech.vn/external-imports/chotot/134264309/image-1-eafb837b-9f2b-45ea-9dec-c8f0baf2d80d.jpg",alt:"Apple iPad Air 5 256GB 5G Xám Đã sử dụng",price:"11.000.000đ",title:"Apple iPad Air 5 256GB 5G Xám Đã sử dụng",category:"Máy tính bảng",seller:"liêm nguyễn",location:"Thành phố Huế, TP Huế",quality:"Tốt",date:"6 ngày trước",shop:true},
  {image:"https://cdn.2ndtech.vn/external-imports/vuatot/14889/image-1-37178d20-123a-441e-85c9-f301a0ea099b.jpg",alt:"Dell 5410 i5 10310 Ram 8G SSD 256G màn hình 14 inch FullHD",price:"5.500.000đ",title:"💥Dell 5410 i5 10310 Ram 8G SSD 256G màn hình 14 inch FullHD - Máy đẹp, BH 1-3-6 tháng",category:"Dell",seller:"Nguyễn Ngọc Hiếu",location:"Quận Hoàng Mai, Hà Nội",quality:"Tốt",date:"6 ngày trước",profile:true},
  {image:"https://cdn.2ndtech.vn/external-imports/chotot/134244087/image-1-32080462-78b7-4666-b56f-80ab74b15176.jpg",alt:"Màn hình LG UltraGear 24GQ50F 24 inch FHD 165Hz",price:"2.000.000đ",title:"Màn hình LG UltraGear 24GQ50F 24 inch FHD 165Hz",category:"Phụ kiện (Màn hình, chuột..)",seller:"Thanh Bình",location:"Quận 8, Thành phố Hồ Chí Minh",quality:"Tốt",date:"6 ngày trước",shop:true},
  {image:"https://cdn.2ndtech.vn/external-imports/chotot/134243978/image-1-d2b734d2-3edc-4607-8381-6f77791b11be.jpg",alt:"Xiaomi Watch S1 Đen",price:"1.050.000đ",title:"Xiaomi Watch S1 Đen",category:"Thiết bị đeo thông minh",seller:"Vinhome Q9",location:"Thành phố Thủ Đức, Thành phố Hồ Chí Minh",quality:"Tốt",date:"6 ngày trước",shop:true,discussing:true},
  {image:"https://cdn.2ndtech.vn/external-imports/vuatot/14834/image-1-91b4e53a-9fb9-44a4-8315-628c15b07862.jpg",alt:"Laptop ASUS ROG Flow i7 12700H RTX 3050",price:"17.000.000đ",title:"Bán laptop ASUS ROG Flow i7 12700H/16GB/512GB/RTX 3050 xách tay Đức, giá 17 triệu",category:"ASUS",seller:"Công Thành",location:"Quận Thanh Xuân, Hà Nội",quality:"Cần sửa",date:"6 ngày trước",profile:true},
  {image:"https://cdn.2ndtech.vn/external-imports/chotot/134244080/image-1-e2dedbd7-811b-48c5-8ba9-9871461f609a.jpg",alt:"Camera an ninh Ezviz H6c Pro 2K 64GB",price:"369.999đ",title:"Camera an ninh Ezviz H6c Pro 2K 64GB",category:"Máy ảnh, máy quay",seller:"Zing Zing",location:"Quận 10, Thành phố Hồ Chí Minh",quality:"Tốt",date:"6 ngày trước",shop:true},
  {image:"https://cdn.2ndtech.vn/external-imports/vuatot/14902/image-1-968174d4-6d65-4fae-86bd-e18fa026aa46.jpg",alt:"Ipad mini4 bản 4g full cn",price:"1.400.000đ",title:"Ipad mini4 bản 4g full cn",category:"Máy tính bảng",seller:"Lê Thiện Phước",location:"Quận Hà Đông, Hà Nội",quality:"Tốt",date:"Đang có người trao đổi",profile:true},
];

const grid = document.getElementById("product-grid");
if (grid) {
  const esc = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  grid.innerHTML = productListings.map((item) => `<article class="product-card">
    <a class="product-card__link" href="https://2ndtech.vn/tin/${encodeURIComponent(item.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""))}">
      <div class="product-card__media"><img class="product-card__image" src="${esc(item.image)}" alt="${esc(item.alt)}" /><span class="product-card__meta"><span>${esc(item.date)}</span></span></div>
      <div class="product-card__body"><span class="product-card__price">${esc(item.price)}</span><span class="product-card__title">${esc(item.title)}</span><span class="product-card__condition">${esc(item.category)}</span><div class="product-card__footer"><a href="https://2ndtech.vn/shop">${esc(item.seller)}</a><span class="product-card__location"><svg viewBox="0 0 24 24"><use href="#icon-pin"/></svg><span class="product-card__location-text">${esc(item.location)}</span></span></div></div>
      <div class="product-card__badge-row">${item.shop?'<span class="product-card__badge">Shop<svg viewBox="0 0 24 24"><use href="#icon-shop"/></svg></span>':''}${item.profile?'<span class="product-card__badge">Hồ sơ mới<svg viewBox="0 0 24 24"><use href="#icon-shield"/></svg></span>':''}${item.discussing?'<span class="product-card__badge">Đang trao đổi</span>':''}</div>
    </a>
  </article>`).join("");
  grid.querySelectorAll(".product-card").forEach((card, index) => {
    const button = document.createElement("button");
    button.className = "product-card__save";
    button.type = "button";
    button.setAttribute("aria-label", "Thêm vào yêu thích");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-heart"/></svg>';
    button.addEventListener("click", () => {
      button.classList.toggle("is-saved");
      button.setAttribute("aria-pressed", String(button.classList.contains("is-saved")));
    });
    card.append(button);
  });
}
