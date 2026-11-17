let editProductId = null;
let selectedFiles = [];
let removedImageIds = [];

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
});

async function loadCategories() {
  try {
    const res = await fetch('/api/categories');
    const json = await res.json();
    if (json.success) {
      const select = document.getElementById('post-category');
      select.innerHTML = '<option value="">-- Chọn danh mục --</option>' +
        json.data.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
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
    document.getElementById('post-category').value = p.category_id;
    document.getElementById('post-condition').value = p.condition;
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
    if (selectedFiles.length >= 5) {
      PatuhiApp.showToast('Bạn chỉ được tải lên tối đa 5 hình ảnh!', 'warning');
      break;
    }
    selectedFiles.push(file);

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

  const title = document.getElementById('post-title').value.trim();
  const category_id = document.getElementById('post-category').value;
  const condition = document.getElementById('post-condition').value;
  const price = document.getElementById('post-price').value;
  const phone_contact = document.getElementById('post-phone').value.trim();
  const location = document.getElementById('post-location').value.trim();
  const description = document.getElementById('post-description').value.trim();

  const formData = new FormData();
  formData.append('title', title);
  formData.append('category_id', category_id);
  formData.append('condition', condition);
  formData.append('price', price);
  formData.append('phone_contact', phone_contact);
  formData.append('location', location);
  formData.append('description', description);

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
