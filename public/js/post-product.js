let editProductId = null;
let selectedFiles = [];
let removedImageIds = [];
let currentPostStep = 1;
const phoneBrandOptions = ['Apple', 'Samsung', 'Xiaomi', 'OPPO', 'Vivo', 'Huawei', 'Sony'];
const phoneModelOptions = ['iPhone', 'Galaxy', 'Redmi', 'OPPO A Series', 'Vivo V Series'];

document.addEventListener('DOMContentLoaded', async () => {
  // Kiểm tra đăng nhập
  const user = await PatuhiApp.checkAuth();
  if (!user) {
    PatuhiApp.showToast('Vui lòng đăng nhập để đăng tin bán sản phẩm!', 'warning');
    setTimeout(() => {
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }, 1000);
    return;
  }

  // Tải danh mục
  await loadCategories();
  document.getElementById('post-category').addEventListener('change', () => {
    updateOtherCategoryField();
    updateBrandModelOptions();
  });
  document.getElementById('post-brand').addEventListener('change', () => toggleOtherProductField('brand'));
  document.getElementById('post-model').addEventListener('change', () => toggleOtherProductField('model'));
  document.getElementById('post-condition').addEventListener('change', toggleOtherConditionField);
  updateBrandModelOptions();

  // Kiểm tra xem có đang ở chế độ sửa tin không
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  if (editId) {
    editProductId = editId;
    loadProductForEdit(editId);
  } else {
    // Tự điền số điện thoại nếu user có sẵn
    if (user.phone) {
      document.getElementById('post-phone').value = user.phone;
    }
  }
  updatePostStepIndicators();
});

function updateOtherCategoryField() {
  const isOther = document.getElementById('post-category').value === 'other';
  const group = document.getElementById('other-category-group');
  const input = document.getElementById('post-category-other');
  group.hidden = !isOther;
  input.required = isOther;
  if (!isOther) {
    input.value = '';
    input.classList.remove('is-invalid');
  }
}

function updateBrandModelOptions() {
  const category = document.getElementById('post-category');
  const isPhone = category.selectedOptions[0]?.textContent.toLowerCase().includes('điện thoại');

  for (const [field, options] of [['brand', phoneBrandOptions], ['model', phoneModelOptions]]) {
    const select = document.getElementById(`post-${field}`);
    const previousValue = getProductFieldValue(field);
    const values = isPhone ? options : [];
    select.innerHTML = '<option value="">-- Chọn --</option>' +
      values.map((value) => `<option value="${value}">${value}</option>`).join('') +
      `<option value="Khác">${field === 'model' ? 'Tự nhập' : 'Khác'}</option>`;

    if (values.includes(previousValue)) {
      select.value = previousValue;
      toggleOtherProductField(field);
    } else if (previousValue) {
      select.value = 'Khác';
      toggleOtherProductField(field);
      document.getElementById(`post-${field}-other`).value = previousValue;
    } else if (!isPhone) {
      select.value = 'Khác';
      toggleOtherProductField(field);
    } else {
      select.value = '';
      toggleOtherProductField(field);
    }
  }
}

function toggleOtherProductField(field) {
  const select = document.getElementById(`post-${field}`);
  const input = document.getElementById(`post-${field}-other`);
  const isOther = select.value === 'Khác';
  input.hidden = !isOther;
  input.required = isOther;
  if (!isOther) input.value = '';
}

function toggleOtherConditionField() {
  const select = document.getElementById('post-condition');
  const input = document.getElementById('post-condition-other');
  const isOther = select.value === 'other';
  input.hidden = !isOther;
  input.required = isOther;
  if (!isOther) {
    input.value = '';
    input.classList.remove('is-invalid');
  }
}

function updatePostStepIndicators() {
  document.querySelectorAll('[data-step-indicator]').forEach((item) => {
    const step = Number(item.dataset.stepIndicator);
    item.classList.toggle('active', step === currentPostStep);
    item.classList.toggle('completed', step < currentPostStep);
    if (step === currentPostStep) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}

function validatePostStep(step) {
  const requiredByStep = {
    1: ['post-category'],
    2: ['post-title', 'post-condition', 'post-price', 'post-description', 'post-location']
  };
  const fields = requiredByStep[step] || [];
  let valid = true;
  for (const id of fields) {
    const field = document.getElementById(id);
    if (!field.checkValidity()) {
      field.classList.add('is-invalid');
      field.reportValidity();
      valid = false;
      break;
    }
    field.classList.remove('is-invalid');
  }
  if (step === 1 && document.getElementById('post-category').value === 'other') {
    const input = document.getElementById('post-category-other');
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      input.reportValidity();
      valid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  }
  if (step === 2) {
    const conditionInput = document.getElementById('post-condition-other');
    if (document.getElementById('post-condition').value === 'other' && !conditionInput.value.trim()) {
      conditionInput.classList.add('is-invalid');
      conditionInput.reportValidity();
      valid = false;
    } else {
      conditionInput.classList.remove('is-invalid');
    }
    for (const field of ['brand', 'model']) {
      const select = document.getElementById(`post-${field}`);
      const input = document.getElementById(`post-${field}-other`);
      if (select.value === 'Khác' && !input.value.trim()) {
        input.classList.add('is-invalid');
        input.reportValidity();
        valid = false;
        break;
      }
      input.classList.remove('is-invalid');
    }
  }
  const remainingExistingImages = document.querySelectorAll('#existing-images-container img').length;
  if (step === 3 && remainingExistingImages + selectedFiles.length === 0) {
    document.getElementById('post-image-error').hidden = false;
    valid = false;
  }
  return valid;
}

function updatePostPreview() {
  const category = document.getElementById('post-category');
  document.getElementById('post-preview-title').textContent = document.getElementById('post-title').value.trim();
  document.getElementById('post-preview-category').textContent = category.value === 'other'
    ? document.getElementById('post-category-other').value.trim()
    : category.selectedOptions[0]?.textContent || '';
  document.getElementById('post-preview-price').textContent = PatuhiApp.formatPrice(Number(document.getElementById('post-price').value));
  document.getElementById('post-preview-description').textContent = document.getElementById('post-description').value.trim();
  document.getElementById('post-preview-details').textContent = [
    getProductFieldValue('brand') && `Hãng: ${getProductFieldValue('brand')}`,
    getProductFieldValue('model') && `Model: ${getProductFieldValue('model')}`,
    document.getElementById('post-condition').value === 'other'
      ? `Tình trạng: ${document.getElementById('post-condition-other').value.trim()}`
      : document.getElementById('post-condition').selectedOptions[0]?.textContent,
    document.getElementById('post-location').value.trim(),
    document.getElementById('post-phone').value.trim()
  ].filter(Boolean).join(' · ');

  const images = document.getElementById('post-preview-images');
  images.querySelectorAll('img[data-preview-url]').forEach((image) => URL.revokeObjectURL(image.dataset.previewUrl));
  images.replaceChildren();
  const existingImages = [...document.querySelectorAll('#existing-images-container img')].map((img) => img.src);
  existingImages.forEach((src) => {
    const image = document.createElement('img');
    image.className = 'post-preview-image';
    image.src = src;
    image.alt = 'Ảnh sản phẩm';
    images.appendChild(image);
  });
  selectedFiles.forEach((file) => {
    const image = document.createElement('img');
    image.className = 'post-preview-image';
    image.dataset.previewUrl = URL.createObjectURL(file);
    image.src = image.dataset.previewUrl;
    image.alt = 'Ảnh sản phẩm';
    images.appendChild(image);
  });
}

function getProductFieldValue(field) {
  const select = document.getElementById(`post-${field}`);
  return select.value === 'Khác'
    ? document.getElementById(`post-${field}-other`).value.trim()
    : select.value;
}

function goToPostStep(step) {
  if (step > currentPostStep && !validatePostStep(currentPostStep)) return;
  if (step === 4) updatePostPreview();
  currentPostStep = step;
  document.querySelectorAll('.post-step').forEach((section) => {
    section.hidden = Number(section.dataset.step) !== step;
  });
  updatePostStepIndicators();
  document.getElementById('form-heading').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success) {
      const select = document.getElementById('post-category');
      select.innerHTML = '<option value="">-- Chọn danh mục --</option>' +
        json.data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('') +
        '<option value="other">Khác</option>';
    }
  } catch (e) {
    console.error('Lỗi tải danh mục:', e);
  }
}

async function loadProductForEdit(id) {
  try {
    document.getElementById('form-heading').innerText = 'Chỉnh sửa thông tin tin đăng';
    document.getElementById('btn-submit-post').innerText = 'Lưu thay đổi';

    const res = await fetch(`/api/products/${id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    });
    const json = await res.json();
    if (!res.ok) {
      PatuhiApp.showToast(json.message || 'Không tìm thấy sản phẩm.', 'danger');
      return;
    }

    const p = json.data.product;
    document.getElementById('post-title').value = p.title;
    if (p.brand) setProductFieldValue('brand', p.brand);
    if (p.model) setProductFieldValue('model', p.model);
    document.getElementById('post-category').value = p.category_id;
    updateOtherCategoryField();
    updateBrandModelOptions();
    document.getElementById('post-condition').value = p.condition;
    document.getElementById('post-condition-other').value = p.condition_detail || '';
    toggleOtherConditionField();
    document.getElementById('post-price').value = p.price;
    document.getElementById('post-phone').value = p.phone_contact || '';
    document.getElementById('post-location').value = p.location;
    document.getElementById('post-description').value = p.description;

    // Hiển thị các ảnh đã có
    if (p.images && p.images.length > 0) {
      const container = document.getElementById('existing-images-container');
      container.innerHTML = p.images.map(img => `
        <div class="preview-img-item" id="exist-img-${img.id}">
          <img src="${img.image_url}">
          <button type="button" class="btn-remove-img" onclick="markRemoveExistingImage(${img.id})">&times;</button>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Lỗi load sửa:', err);
  }
}

function setProductFieldValue(field, value) {
  const select = document.getElementById(`post-${field}`);
  if ([...select.options].some((option) => option.value === value)) {
    select.value = value;
  } else {
    select.value = 'Khác';
    toggleOtherProductField(field);
    document.getElementById(`post-${field}-other`).value = value;
  }
}

function markRemoveExistingImage(imgId) {
  removedImageIds.push(imgId);
  const elem = document.getElementById(`exist-img-${imgId}`);
  if (elem) elem.remove();
}

function handleImageSelection(input) {
  if (!input.files || input.files.length === 0) return;

  const previewContainer = document.getElementById('new-images-preview');
  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    const existingCount = document.querySelectorAll('#existing-images-container img').length;
    if (existingCount + selectedFiles.length >= 5) {
      PatuhiApp.showToast('Bạn chỉ được tải lên tối đa 5 hình ảnh!', 'warning');
      break;
    }
    selectedFiles.push(file);
    document.getElementById('post-image-error').hidden = true;

    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'preview-img-item';
      div.innerHTML = `
        <img src="${e.target.result}">
        <button type="button" class="btn-remove-img" onclick="removeSelectedFile(${selectedFiles.length - 1}, this)">&times;</button>
      `;
      previewContainer.appendChild(div);
    };
    reader.readAsDataURL(file);
  }
  input.value = ''; // reset file input
}

function removeSelectedFile(index, btn) {
  selectedFiles.splice(index, 1);
  btn.closest('.preview-img-item').remove();
}

async function handleProductSubmit(event) {
  event.preventDefault();
  if (currentPostStep !== 4) {
    goToPostStep(currentPostStep + 1);
    return;
  }
  for (const step of [1, 2, 3]) {
    if (!validatePostStep(step)) {
      goToPostStep(step);
      return;
    }
  }

  const title = document.getElementById('post-title').value.trim();
  const category_id = document.getElementById('post-category').value;
  const condition = document.getElementById('post-condition').value;
  const condition_detail = document.getElementById('post-condition-other').value.trim();
  const price = document.getElementById('post-price').value;
  const phone_contact = document.getElementById('post-phone').value.trim();
  const location = document.getElementById('post-location').value.trim();
  const description = document.getElementById('post-description').value.trim();
  const brand = getProductFieldValue('brand');
  const model = getProductFieldValue('model');

  const formData = new FormData();
  formData.append('title', title);
  if (category_id === 'other') {
    formData.append('category_name', document.getElementById('post-category-other').value.trim());
  } else {
    formData.append('category_id', category_id);
  }
  formData.append('condition', condition);
  formData.append('condition_detail', condition_detail);
  formData.append('price', price);
  formData.append('phone_contact', phone_contact);
  formData.append('location', location);
  formData.append('description', description);
  formData.append('brand', brand);
  formData.append('model', model);

  // Thêm các file ảnh mới
  for (let i = 0; i < selectedFiles.length; i++) {
    formData.append('images', selectedFiles[i]);
  }

  // Thêm id ảnh cần xóa khi sửa
  if (removedImageIds.length > 0) {
    formData.append('remove_image_ids', removedImageIds.join(','));
  }

  const btnSubmit = document.getElementById('btn-submit-post');
  btnSubmit.disabled = true;
  btnSubmit.innerText = 'Đang xử lý...';

  try {
    const url = editProductId ? `/api/products/${editProductId}` : '/api/products';
    const method = editProductId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      },
      body: formData
    });

    const json = await res.json();
    if (res.ok) {
      PatuhiApp.showToast(json.message, 'success');
      setTimeout(() => {
        if (json.data && json.data.product) {
          window.location.href = `/product/${json.data.product.id}`;
        } else {
          window.location.href = '/profile';
        }
      }, 1200);
    } else {
      btnSubmit.disabled = false;
      btnSubmit.innerText = editProductId ? 'Lưu thay đổi' : 'Đăng tin ngay';
      PatuhiApp.showToast(json.message || 'Lỗi khi lưu tin.', 'danger');
    }
  } catch (err) {
    btnSubmit.disabled = false;
    btnSubmit.innerText = editProductId ? 'Lưu thay đổi' : 'Đăng tin ngay';
    PatuhiApp.showToast('Lỗi kết nối máy chủ.', 'danger');
  }
}
