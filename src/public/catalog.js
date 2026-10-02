const productRows = document.getElementById('productRows');
const productForm = document.getElementById('productForm');
const productDialog = document.getElementById('productDialog');
const deleteDialog = document.getElementById('deleteDialog');
const apiIndicator = document.getElementById('apiIndicator');
const apiStatus = document.getElementById('apiStatus');
const searchInput = document.getElementById('searchInput');
const categoryFilter = document.getElementById('categoryFilter');
const stockFilter = document.getElementById('stockFilter');
const toast = document.getElementById('toast');
const formError = document.getElementById('formError');
const apiErrors = {
  'A product object is required': 'Vui lòng nhập thông tin sản phẩm.',
  'Name is required': 'Vui lòng nhập tên sản phẩm.',
  'Price must be a non-negative integer': 'Đơn giá phải là số nguyên VND không âm.',
  'Description must be a string': 'Mô tả không hợp lệ.',
  'SKU must be a string': 'Mã SKU không hợp lệ.',
  'Category must be a string': 'Nhóm hàng không hợp lệ.',
  'Stock must be a non-negative integer': 'Số lượng phải là số nguyên không âm.',
  'Product not found': 'Không tìm thấy sản phẩm.',
  'SKU already exists': 'Mã SKU này đã được sử dụng.',
  'Failed to fetch product': 'Không thể tải thông tin sản phẩm.',
  'Failed to create product': 'Không thể thêm sản phẩm.',
  'Failed to update product': 'Không thể cập nhật sản phẩm.',
  'Failed to delete product': 'Không thể xóa sản phẩm.',
};

let products = [];
let editingId = null;
let pendingDelete = null;
let toastTimer;

function escapeHtml(value) {
  const replacements = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return String(value ?? '').replace(/[&<>"']/g, (character) => replacements[character]);
}

async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại.');
  }

  if (response.status === 204) {
    return null;
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = apiErrors[body?.error]
      || (response.status >= 500
        ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
        : `Không thể hoàn tất yêu cầu (mã ${response.status}).`);
    throw new Error(message);
  }

  return body;
}

function setApiState(state, label) {
  apiIndicator.dataset.state = state;
  apiStatus.textContent = label;
}

function showToast(message, type = 'success') {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.dataset.type = type;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 3200);
}

function currency(value) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function compactCurrency(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000_000_000) {
    return `${(amount / 1_000_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} nghìn tỷ ₫`;
  }
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tỷ ₫`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu ₫`;
  }

  return currency(amount);
}

function shortDate(value) {
  if (!value) {
    return 'Chưa cập nhật';
  }

  const date = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    return 'Chưa cập nhật';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function countLabel(count, label) {
  return `${count.toLocaleString('vi-VN')} ${label}`;
}

function updateMetrics() {
  const inventoryValue = products.reduce(
    (total, product) => total + (Number(product.price) * Number(product.stock)),
    0,
  );
  const lowStockCount = products.filter((product) => (
    Number(product.stock) > 0 && Number(product.stock) <= 5
  )).length;
  const categories = new Set(products.map((product) => product.category).filter(Boolean));

  document.getElementById('metricProducts').textContent = products.length.toLocaleString('vi-VN');
  document.getElementById('metricValue').textContent = compactCurrency(inventoryValue);
  document.getElementById('metricLow').textContent = lowStockCount.toLocaleString('vi-VN');
  document.getElementById('metricCategories').textContent = categories.size.toLocaleString('vi-VN');
  document.getElementById('navProductCount').textContent = products.length.toLocaleString('vi-VN');
  document.getElementById('footerCount').textContent = countLabel(products.length, 'sản phẩm');
}

function updateCategoryOptions() {
  const selectedCategory = categoryFilter.value;
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))]
    .sort((first, second) => first.localeCompare(second, 'vi'));

  categoryFilter.innerHTML = '<option value="">Tất cả nhóm hàng</option>';
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  });

  if (categories.includes(selectedCategory)) {
    categoryFilter.value = selectedCategory;
  }
}

function getVisibleProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase('vi');
  const category = categoryFilter.value;
  const stock = stockFilter.value;

  return products.filter((product) => {
    const searchableText = [product.name, product.sku, product.category, product.description]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('vi');
    const matchesQuery = !query || searchableText.includes(query);
    const matchesCategory = !category || product.category === category;
    const stockCount = Number(product.stock);
    const matchesStock = stock === 'all'
      || (stock === 'low' && stockCount > 0 && stockCount <= 5)
      || (stock === 'out' && stockCount === 0);

    return matchesQuery && matchesCategory && matchesStock;
  });
}

function emptyRow() {
  if (products.length === 0) {
    return '<tr><td class="table-message empty-message" colspan="7"><strong>Danh mục chưa có sản phẩm</strong><span>Thêm sản phẩm để bắt đầu theo dõi tồn kho.</span><br><button class="empty-action" type="button" data-action="create">Thêm sản phẩm đầu tiên</button></td></tr>';
  }

  return '<tr><td class="table-message empty-message" colspan="7"><strong>Không tìm thấy sản phẩm phù hợp</strong><span>Hãy thử thay đổi từ khóa hoặc bộ lọc.</span></td></tr>';
}

function productRow(product, index) {
  const stock = Number(product.stock);
  let stockClass = '';
  let stockLabel = 'Còn hàng';

  if (stock === 0) {
    stockClass = 'is-out';
    stockLabel = 'Hết hàng';
  } else if (stock <= 5) {
    stockClass = 'is-low';
    stockLabel = 'Sắp hết';
  }

  const initial = String(product.name || '?').trim().charAt(0) || '?';
  const description = product.description || 'Chưa có mô tả';
  const sku = product.sku || 'Chưa cập nhật';
  const category = product.category || 'Chưa phân loại';

  return `
    <tr class="product-row" style="animation-delay:${Math.min(index * 25, 175)}ms">
      <td>
        <div class="product-cell">
          <span class="product-initial" aria-hidden="true">${escapeHtml(initial)}</span>
          <span>
            <strong class="product-name">${escapeHtml(product.name)}</strong>
            <span class="product-description">${escapeHtml(description)}</span>
          </span>
        </div>
      </td>
      <td><span class="sku-value">${escapeHtml(sku)}</span></td>
      <td><span class="category-tag">${escapeHtml(category)}</span></td>
      <td class="numeric-cell"><span class="price-value">${currency(product.price)}</span></td>
      <td><div class="stock-cell"><span class="stock-number">${stock.toLocaleString('vi-VN')}</span><span class="stock-status ${stockClass}">${stockLabel}</span></div></td>
      <td><span class="updated-value">${escapeHtml(shortDate(product.updated_at || product.created_at))}</span></td>
      <td>
        <div class="row-actions">
          <button class="row-action" type="button" data-action="edit" data-id="${Number(product.id)}">Sửa</button>
          <button class="row-action is-delete" type="button" data-action="delete" data-id="${Number(product.id)}">Xóa</button>
        </div>
      </td>
    </tr>`;
}

function renderProducts() {
  const visibleProducts = getVisibleProducts();

  document.getElementById('recordCount').textContent = countLabel(products.length, 'bản ghi');
  document.getElementById('filteredCount').textContent = `${visibleProducts.length}/${products.length} sản phẩm`;
  productRows.innerHTML = visibleProducts.length
    ? visibleProducts.map(productRow).join('')
    : emptyRow();
}

async function loadProducts(showLoading = true) {
  setApiState('loading', 'Đang kết nối API');
  if (showLoading) {
    productRows.innerHTML = '<tr><td class="table-message" colspan="7">Đang tải danh mục...</td></tr>';
  }

  try {
    const result = await apiRequest('/api/products');
    products = Array.isArray(result) ? result : [];
    setApiState('connected', 'Đã kết nối API');
    updateMetrics();
    updateCategoryOptions();
    renderProducts();
  } catch (error) {
    setApiState('error', 'API không khả dụng');
    productRows.innerHTML = `<tr><td class="table-message" colspan="7">${escapeHtml(error.message)} Hãy kiểm tra kết nối và thử làm mới.</td></tr>`;
    showToast(error.message, 'error');
  }
}

function formValue(name) {
  return productForm.elements.namedItem(name);
}

function openCreateDialog() {
  editingId = null;
  productForm.reset();
  formError.hidden = true;
  document.getElementById('dialogEyebrow').textContent = 'THÊM MẶT HÀNG';
  document.getElementById('dialogTitle').textContent = 'Thêm sản phẩm';
  document.getElementById('saveProductButton').textContent = 'Lưu sản phẩm';
  productDialog.showModal();
  formValue('name').focus();
}

function openEditDialog(product) {
  editingId = product.id;
  formError.hidden = true;
  document.getElementById('dialogEyebrow').textContent = `CẬP NHẬT MẶT HÀNG / ${product.id}`;
  document.getElementById('dialogTitle').textContent = 'Cập nhật sản phẩm';
  document.getElementById('saveProductButton').textContent = 'Lưu thay đổi';
  formValue('name').value = product.name || '';
  formValue('sku').value = product.sku || '';
  formValue('category').value = product.category || '';
  formValue('price').value = product.price;
  formValue('stock').value = product.stock;
  formValue('description').value = product.description || '';
  productDialog.showModal();
  formValue('name').focus();
}

async function saveProduct(event) {
  event.preventDefault();
  formError.hidden = true;

  const payload = {
    name: formValue('name').value.trim(),
    sku: formValue('sku').value.trim() || null,
    category: formValue('category').value.trim(),
    price: Number(formValue('price').value),
    stock: Number(formValue('stock').value),
    description: formValue('description').value.trim(),
  };

  const saveButton = document.getElementById('saveProductButton');
  saveButton.disabled = true;
  saveButton.textContent = 'Đang lưu...';

  try {
    if (editingId === null) {
      await apiRequest('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('Đã thêm sản phẩm vào danh mục.');
    } else {
      await apiRequest(`/api/products/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      showToast('Đã lưu thay đổi sản phẩm.');
    }

    productDialog.close();
    await loadProducts(false);
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = editingId === null ? 'Lưu sản phẩm' : 'Lưu thay đổi';
  }
}

function deleteProduct(product) {
  pendingDelete = product;
  document.getElementById('deleteProductName').textContent = product.name;
  deleteDialog.showModal();
}

async function confirmDeleteProduct() {
  if (!pendingDelete) {
    return;
  }

  const product = pendingDelete;
  const confirmButton = document.getElementById('confirmDeleteButton');
  confirmButton.disabled = true;

  try {
    await apiRequest(`/api/products/${product.id}`, { method: 'DELETE' });
    deleteDialog.close();
    pendingDelete = null;
    showToast('Đã xóa sản phẩm.');
    await loadProducts(false);
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    confirmButton.disabled = false;
  }
}

document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
}).format(new Date());

document.getElementById('addProductButton').addEventListener('click', openCreateDialog);
document.getElementById('refreshButton').addEventListener('click', () => loadProducts());
document.getElementById('closeDialogButton').addEventListener('click', () => productDialog.close());
document.getElementById('cancelDialogButton').addEventListener('click', () => productDialog.close());
document.getElementById('cancelDeleteButton').addEventListener('click', () => {
  pendingDelete = null;
  deleteDialog.close();
});
document.getElementById('confirmDeleteButton').addEventListener('click', confirmDeleteProduct);
deleteDialog.addEventListener('cancel', () => {
  pendingDelete = null;
});
productForm.addEventListener('submit', saveProduct);
searchInput.addEventListener('input', renderProducts);
categoryFilter.addEventListener('change', renderProducts);
stockFilter.addEventListener('change', renderProducts);

productRows.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  if (button.dataset.action === 'create') {
    openCreateDialog();
    return;
  }

  const product = products.find((item) => String(item.id) === button.dataset.id);
  if (!product) {
    return;
  }

  if (button.dataset.action === 'edit') {
    openEditDialog(product);
  } else if (button.dataset.action === 'delete') {
    deleteProduct(product);
  }
});

loadProducts();
