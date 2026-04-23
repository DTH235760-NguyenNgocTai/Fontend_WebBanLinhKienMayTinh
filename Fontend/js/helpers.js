import {
  danhMucApi,
  gioHangApi,
  hinhAnhSanPhamApi,
  thuongHieuApi,
} from "./api.js";
import { getCurrentAccount, isAdmin, logout } from "./auth.js";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
});
const PRODUCT_PURCHASABLE_STATUSES = new Set(["hoat_dong", "sap_het_hang"]);

const body = document.body;
const basePath = body?.dataset.basePath || "";

export const ROUTES = {
  home: `${basePath}index.html`,
  login: `${basePath}login.html`,
  register: `${basePath}register.html`,
  san_pham: `${basePath}pages/san-pham.html`,
  chi_tiet_san_pham: `${basePath}pages/chi-tiet-san-pham.html`,
  gio_hang: `${basePath}pages/gio-hang.html`,
  thanh_toan: `${basePath}pages/thanh-toan.html`,
  don_hang: `${basePath}pages/don-hang.html`,
  tai_khoan: `${basePath}pages/tai-khoan.html`,
  admin_dashboard: `${basePath}pages/admin/dashboard.html`,
  admin_san_pham: `${basePath}pages/admin/san-pham.html`,
  admin_danh_muc: `${basePath}pages/admin/danh-muc.html`,
  admin_thuong_hieu: `${basePath}pages/admin/thuong-hieu.html`,
  admin_don_hang: `${basePath}pages/admin/don-hang.html`,
  admin_tai_khoan: `${basePath}pages/admin/tai-khoan.html`,
  admin_vai_tro: `${basePath}pages/admin/vai-tro.html`,
};

const statusMaps = {
  trang_thai_san_pham: {
    hoat_dong: { label: "Hoạt động", tone: "success" },
    sap_het_hang: { label: "Sắp hết hàng", tone: "warning" },
    dang_nhap_hang: { label: "Đang nhập hàng", tone: "info" },
    ngung_kinh_doanh: { label: "Ngừng kinh doanh", tone: "danger" },
  },
  trang_thai_tai_khoan: {
    hoat_dong: { label: "Hoạt động", tone: "success" },
    bi_khoa: { label: "Bị khóa", tone: "danger" },
  },
  trang_thai_don_hang: {
    cho_xac_nhan: { label: "Chờ xác nhận", tone: "warning" },
    dang_xu_ly: { label: "Đang xử lý", tone: "info" },
    dang_giao: { label: "Đang giao", tone: "info" },
    hoan_thanh: { label: "Hoàn thành", tone: "success" },
    da_huy: { label: "Đã hủy", tone: "danger" },
  },
  trang_thai_thanh_toan: {
    chua_thanh_toan: { label: "Chưa thanh toán", tone: "warning" },
    da_thanh_toan: { label: "Đã thanh toán", tone: "success" },
    that_bai: { label: "Thất bại", tone: "danger" },
  },
};

const paymentMethodLabels = {
  cod: "Thanh toán bằng tiền mặt",
  cash: "Thanh toán bằng tiền mặt",
  tien_mat: "Thanh toán bằng tiền mặt",
  thanh_toan_tien_mat: "Thanh toán bằng tiền mặt",
  thanh_toan_bang_tien_mat: "Thanh toán bằng tiền mặt",
  cash_on_delivery: "Thanh toán bằng tiền mặt",
  online: "Thanh toán online",
  chuyen_khoan: "Thanh toán online",
  bank_transfer: "Thanh toán online",
  thanh_toan_online: "Thanh toán online",
  thanh_toan_truc_tuyen: "Thanh toán online",
  vnpay: "Thanh toán online",
  momo: "Thanh toán online",
};

function defaultImageDataUri(label = "No image") {
  const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
            <rect width="640" height="640" rx="36" fill="#f8fafc"/>
            <rect x="54" y="54" width="532" height="532" rx="28" fill="#ffffff" stroke="#e5e7eb" stroke-width="10"/>
            <path d="M208 420l82-102 66 72 54-66 86 96H208z" fill="#dbe4f0"/>
            <circle cx="256" cy="228" r="42" fill="#d70018" opacity=".18"/>
            <text x="320" y="520" text-anchor="middle" font-family="Be Vietnam Pro, Arial, sans-serif" font-size="28" fill="#6b7280">${label}</text>
        </svg>
    `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function formatDateTime(value) {
  if (!value) {
    return "Chưa cập nhật";
  }

  return dateFormatter.format(new Date(value));
}

export function escapeHtml(value = "") {
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

export function buildUrl(path, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, value);
  });

  return query.toString() ? `${path}?${query.toString()}` : path;
}

export function debounce(callback, wait = 300) {
  let timeoutId = 0;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), wait);
  };
}

function getStatusConfig(type, value) {
  return statusMaps[type]?.[value] || {
    label: value || "Chưa cập nhật",
    tone: "info",
  };
}

function normalizeLookupKey(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getStatusLabel(type, value) {
  return getStatusConfig(type, value).label;
}

export function renderStatus(type, value) {
  const config = getStatusConfig(type, value);

  return `<span class="status-pill ${config.tone}">${escapeHtml(config.label)}</span>`;
}

export function formatPaymentMethod(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return "Chưa cập nhật";
  }

  return paymentMethodLabels[normalizeLookupKey(rawValue)] || rawValue;
}

export function handleImageError(event, label = "No image") {
  if (!event?.target) {
    return;
  }

  event.target.src = defaultImageDataUri(label);
}

export function setFallbackImage(imageElement, label = "No image") {
  if (!imageElement) {
    return;
  }

  imageElement.addEventListener("error", (event) =>
    handleImageError(event, label),
  );
}

export function toMapById(items = []) {
  return new Map(items.map((item) => [Number(item.id), item]));
}

export function groupBy(items = [], key) {
  return items.reduce((result, item) => {
    const groupKey = typeof key === "function" ? key(item) : item?.[key];
    const normalizedKey = Number.isNaN(Number(groupKey))
      ? groupKey
      : Number(groupKey);

    if (!result.has(normalizedKey)) {
      result.set(normalizedKey, []);
    }

    result.get(normalizedKey).push(item);
    return result;
  }, new Map());
}

export function getProductCurrentPrice(san_pham) {
  const gia_ban = Number(san_pham?.gia_ban || 0);
  const gia_giam = Number(san_pham?.gia_giam || 0);
  return gia_giam > 0 && gia_giam < gia_ban ? gia_giam : gia_ban;
}

export function getProductDiscountPercent(san_pham) {
  const gia_ban = Number(san_pham?.gia_ban || 0);
  const gia_giam = Number(san_pham?.gia_giam || 0);

  if (!gia_ban || !gia_giam || gia_giam >= gia_ban) {
    return 0;
  }

  return Math.round((1 - gia_giam / gia_ban) * 100);
}

function normalizeProductStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getProductMessageLabel(san_pham, includeName = false) {
  const productName = String(san_pham?.ten || "").trim();
  if (includeName && productName) {
    return `Sản phẩm "${productName}"`;
  }

  return "Sản phẩm";
}

export function getProductPurchaseBlockMessage(
  san_pham,
  { quantity = 1, includeName = false } = {},
) {
  const productStatus = normalizeProductStatus(san_pham?.trang_thai);
  const stockQuantity = Math.max(Number(san_pham?.so_luong_ton || 0), 0);
  const requestedQuantity = Math.max(Number(quantity || 0), 0);
  const productLabel = getProductMessageLabel(san_pham, includeName);

  if (productStatus === "ngung_kinh_doanh") {
    return `${productLabel} đã ngừng kinh doanh.`;
  }

  if (productStatus === "dang_nhap_hang") {
    return `${productLabel} đang nhập hàng.`;
  }

  if (stockQuantity <= 0) {
    return `${productLabel} đã hết hàng.`;
  }

  if (requestedQuantity > stockQuantity) {
    return `${productLabel} chỉ còn ${stockQuantity} sản phẩm.`;
  }

  if (!PRODUCT_PURCHASABLE_STATUSES.has(productStatus)) {
    return `${productLabel} hiện chưa thể đặt mua.`;
  }

  return "";
}

export function isProductPurchasable(san_pham) {
  return !getProductPurchaseBlockMessage(san_pham);
}

export function getProductImages(san_pham, imageMap = new Map()) {
  const nestedImages = Array.isArray(san_pham?.hinh_anh_san_pham)
    ? san_pham.hinh_anh_san_pham
    : Array.isArray(san_pham?.hinh_anhs)
      ? san_pham.hinh_anhs
      : Array.isArray(san_pham?.images)
        ? san_pham.images
        : [];
  const productId = Number(san_pham?.id);
  const lookupImages = imageMap.get(productId) || [];

  const images = nestedImages.length ? nestedImages : lookupImages;

  return Array.isArray(images)
    ? [...images].sort((a, b) => {
        return Number(b?.la_anh_chinh || 0) - Number(a?.la_anh_chinh || 0) ||
          Number(a?.thu_tu || 0) - Number(b?.thu_tu || 0) ||
          Number(b?.id || 0) - Number(a?.id || 0);
      })
    : [];
}

export function getProductMainImage(san_pham, imageMap = new Map()) {
  const images = getProductImages(san_pham, imageMap);
  return images[0]?.duong_dan || defaultImageDataUri("Product");
}

export function renderProductCard(san_pham, options = {}) {
  const { thuongHieuMap = new Map(), imageMap = new Map() } = options;
  const currentPrice = getProductCurrentPrice(san_pham);
  const discountPercent = getProductDiscountPercent(san_pham);
  const mainImage = getProductMainImage(san_pham, imageMap);
  const thuong_hieu =
    san_pham?.thuong_hieu ||
    thuongHieuMap.get(Number(san_pham?.thuong_hieu_id));
  const isNew = san_pham?.ngay_tao
    ? (Date.now() - new Date(san_pham.ngay_tao).getTime()) /
        (1000 * 60 * 60 * 24) <=
      30
    : false;
  const canBuy = isProductPurchasable(san_pham);

  return `
        <article class="product-card">
            <div class="product-badge-group">
                ${isNew ? '<span class="product-badge new">Mới</span>' : "<span></span>"}
                ${discountPercent > 0 ? `<span class="product-badge discount">-${discountPercent}%</span>` : ""}
            </div>
            <a class="product-thumb" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: san_pham.id })}">
                <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(san_pham.ten)}">
            </a>
            <div class="product-body">
                <div class="product-brand">${escapeHtml(thuong_hieu?.ten || "Đang cập nhật")}</div>
                <a class="product-title line-clamp-2" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: san_pham.id })}">
                    ${escapeHtml(san_pham.ten)}
                </a>
                <div class="product-meta">
                    <span>Mã: ${escapeHtml(san_pham.ma_san_pham || "N/A")}</span>
                    <span>Tồn: ${Number(san_pham.so_luong_ton || 0)}</span>
                </div>
                <div class="product-price">
                    <span class="product-current-price">${formatCurrency(currentPrice)}</span>
                    ${discountPercent > 0 ? `<span class="product-old-price">${formatCurrency(san_pham.gia_ban)}</span>` : ""}
                </div>
                <div class="product-savings ${canBuy ? "" : "text-primary"}">
                    ${discountPercent > 0 ? `Tiết kiệm ${formatCurrency(Number(san_pham.gia_ban || 0) - currentPrice)}` : "Giá đang áp dụng"}
                </div>
                <div class="product-status">${renderStatus("trang_thai_san_pham", san_pham.trang_thai)}</div>
                <div class="product-card-actions">
                    <a class="btn btn-outline-primary" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: san_pham.id })}">
                        Xem chi tiết
                    </a>
                    <button class="btn btn-primary" type="button" data-add-to-cart="${san_pham.id}">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

export function renderPagination({ currentPage = 1, totalPages = 1 }) {
  if (totalPages <= 1) {
    return "";
  }

  const buttons = [];

  buttons.push(`
        <button class="btn btn-soft" type="button" data-page="${Math.max(currentPage - 1, 1)}" ${currentPage === 1 ? "disabled" : ""}>
            <i class="fa-solid fa-angle-left"></i>
        </button>
    `);

  for (let page = 1; page <= totalPages; page += 1) {
    buttons.push(`
            <button class="btn ${page === currentPage ? "btn-primary" : "btn-soft"}" type="button" data-page="${page}">
                ${page}
            </button>
        `);
  }

  buttons.push(`
        <button class="btn btn-soft" type="button" data-page="${Math.min(currentPage + 1, totalPages)}" ${currentPage === totalPages ? "disabled" : ""}>
            <i class="fa-solid fa-angle-right"></i>
        </button>
    `);

  return `<div class="pagination-list">${buttons.join("")}</div>`;
}

export function renderPageHero({ title, subtitle, breadcrumbs = [] }) {
  return `
        <section class="page-hero">
            <nav class="page-breadcrumb">
                ${breadcrumbs
                  .map((item, index) =>
                    item.url
                      ? `<a href="${item.url}">${escapeHtml(item.label)}</a>`
                      : `<span class="${index === breadcrumbs.length - 1 ? "current" : ""}">${escapeHtml(item.label)}</span>`,
                  )
                  .join("<span>/</span>")}
            </nav>
            <h1 class="mb-3">${escapeHtml(title)}</h1>
            <p class="mb-0">${escapeHtml(subtitle)}</p>
        </section>
    `;
}

export function renderEmptyState({
  icon = "fa-circle-info",
  title,
  message,
  actionLabel = "",
  actionHref = "",
}) {
  return `
        <div class="empty-state">
            <i class="fa-solid ${icon}"></i>
            <h3 class="h5 fw-bold mb-2">${escapeHtml(title)}</h3>
            <p class="text-muted mb-3">${escapeHtml(message)}</p>
            ${actionLabel && actionHref ? `<a class="btn btn-primary" href="${actionHref}">${escapeHtml(actionLabel)}</a>` : ""}
        </div>
    `;
}

export function renderLoadingState(text = "Đang tải dữ liệu...") {
  return `
        <div class="loading-state">
            <div>
                <div class="spinner-border text-danger mb-3" role="status"></div>
                <div class="text-muted">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
}

export function paginateLocally(items = [], currentPage = 1, pageSize = 8) {
  const totalItems = items.length;
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return {
    items: items.slice(startIndex, startIndex + pageSize),
    currentPage: safePage,
    totalPages,
    totalItems,
    pageSize,
  };
}

function ensureToastContainer() {
  let container = document.getElementById("app-toast-container");

  if (!container) {
    container = document.createElement("div");
    container.id = "app-toast-container";
    container.className = "toast-container position-fixed top-0 end-0 p-3";
    document.body.appendChild(container);
  }

  return container;
}

function ensureCenterPopupRoot() {
  let root = document.getElementById("app-center-popup-root");

  if (!root) {
    root = document.createElement("div");
    root.id = "app-center-popup-root";
    root.className = "app-center-popup-root";
    document.body.appendChild(root);
  }

  return root;
}

let activeCenterPopupKind = "";
const centerPopupQueue = [];

function openNextCenterPopupFromQueue() {
  if (activeCenterPopupKind || !centerPopupQueue.length) {
    return;
  }

  const nextPopup = centerPopupQueue.shift();
  nextPopup?.();
}

function getCenterPopupIconMarkup(tone = "success") {
  if (tone === "loading") {
    return `
        <div class="app-center-popup-icon app-center-popup-icon-loading" aria-hidden="true">
            <span class="spinner-border text-danger" role="status"></span>
        </div>
    `;
  }

  if (tone === "danger") {
    return `
        <div class="app-center-popup-icon app-center-popup-icon-danger" aria-hidden="true">
            <i class="fa-solid fa-xmark"></i>
        </div>
    `;
  }

  if (tone === "warning") {
    return `
        <div class="app-center-popup-icon app-center-popup-icon-warning" aria-hidden="true">
            <i class="fa-solid fa-exclamation"></i>
        </div>
    `;
  }

  if (tone === "info") {
    return `
        <div class="app-center-popup-icon app-center-popup-icon-info" aria-hidden="true">
            <i class="fa-solid fa-circle-info"></i>
        </div>
    `;
  }

  return `
      <div class="app-center-popup-icon app-center-popup-icon-success" aria-hidden="true">
          <i class="fa-solid fa-check"></i>
      </div>
  `;
}

export function hideCenterPopup() {
  const root = document.getElementById("app-center-popup-root");
  if (!root) {
    return;
  }

  activeCenterPopupKind = "";
  root.classList.remove("is-active");
  root.innerHTML = "";
  document.body.classList.remove("app-has-center-popup");
  window.setTimeout(openNextCenterPopupFromQueue, 0);
}

export function showProcessingPopup({
  title = "Đang xử lý sản phẩm",
  message = "Hệ thống đang xử lý, vui lòng chờ trong giây lát.",
} = {}) {
  const root = ensureCenterPopupRoot();

  activeCenterPopupKind = "processing";
  root.classList.add("is-active");
  document.body.classList.add("app-has-center-popup");
  root.innerHTML = `
        <div class="app-center-popup-backdrop"></div>
        <div class="app-center-popup-card app-center-popup-card-loading" role="dialog" aria-modal="true" aria-live="assertive">
            ${getCenterPopupIconMarkup("loading")}
            <div class="app-center-popup-title">${escapeHtml(title)}</div>
            <div class="app-center-popup-message">${escapeHtml(message)}</div>
        </div>
    `;
}

export function showCenterPopup({
  title = "Thông báo",
  message = "",
  tone = "success",
  confirmLabel = "OK",
} = {}) {
  return new Promise((resolve) => {
    const openPopup = () => {
      const root = ensureCenterPopupRoot();

      activeCenterPopupKind = "notification";
      root.classList.add("is-active");
      document.body.classList.add("app-has-center-popup");
      root.innerHTML = `
            <div class="app-center-popup-backdrop"></div>
            <div class="app-center-popup-card app-center-popup-card-${escapeHtml(tone)}" role="dialog" aria-modal="true" aria-live="assertive">
                ${getCenterPopupIconMarkup(tone)}
                <div class="app-center-popup-title">${escapeHtml(title)}</div>
                <div class="app-center-popup-message">${escapeHtml(message)}</div>
                <button type="button" class="btn btn-primary app-center-popup-button" data-center-popup-confirm>
                    ${escapeHtml(confirmLabel)}
                </button>
            </div>
        `;

      const confirmButton = root.querySelector("[data-center-popup-confirm]");
      const closePopup = () => {
        hideCenterPopup();
        resolve(true);
      };

      confirmButton?.addEventListener("click", closePopup, { once: true });
      window.setTimeout(() => confirmButton?.focus(), 40);
    };

    if (activeCenterPopupKind) {
      centerPopupQueue.push(openPopup);
      return;
    }

    openPopup();
  });
}

export function showToast(message, tone = "success") {
  const popupTitle =
    tone === "danger"
      ? "Có lỗi xảy ra!"
      : tone === "warning"
        ? "Lưu ý!"
        : tone === "info"
          ? "Thông báo"
          : "Xin cảm ơn!";

  return showCenterPopup({
    title: popupTitle,
    message,
    tone,
    confirmLabel: "OK",
  });
}

export function showConfirmDialog({
  title = "Xác nhận thao tác",
  message = "Bạn có chắc muốn tiếp tục?",
  confirmLabel = "Đồng ý",
  cancelLabel = "Không",
  tone = "danger",
} = {}) {
  if (!window.bootstrap?.Modal) {
    return Promise.resolve(window.confirm(message));
  }

  return new Promise((resolve) => {
    const modalElement = document.createElement("div");
    const confirmClass =
      tone === "warning"
        ? "btn btn-warning"
        : tone === "success"
          ? "btn btn-success"
          : "btn btn-danger";
    let confirmed = false;

    modalElement.className = "modal fade";
    modalElement.tabIndex = -1;
    modalElement.setAttribute("aria-hidden", "true");
    modalElement.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header border-0 pb-0">
                    <h2 class="h5 mb-0">${escapeHtml(title)}</h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
                </div>
                <div class="modal-body pt-3">
                    <p class="text-muted mb-0">${escapeHtml(message)}</p>
                </div>
                <div class="modal-footer border-0 pt-0">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">${escapeHtml(cancelLabel)}</button>
                    <button type="button" class="${confirmClass}" data-confirm-accept>${escapeHtml(confirmLabel)}</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);

    const modal = window.bootstrap.Modal.getOrCreateInstance(modalElement);

    modalElement
      .querySelector("[data-confirm-accept]")
      ?.addEventListener("click", () => {
        confirmed = true;
        modal.hide();
      });

    modalElement.addEventListener(
      "hidden.bs.modal",
      () => {
        modal.dispose();
        modalElement.remove();
        resolve(confirmed);
      },
      { once: true },
    );

    modal.show();
  });
}

export function redirectToLogin(redirect = window.location.href) {
  window.location.href = buildUrl(ROUTES.login, { redirect });
}

function updateHeaderOffset() {
  const topbarHeight =
    document.querySelector(".site-topbar")?.offsetHeight || 0;
  const headerMainHeight =
    document.querySelector(".header-main")?.offsetHeight || 0;
  document.documentElement.style.setProperty(
    "--site-header-offset",
    `${topbarHeight + headerMainHeight}px`,
  );
}

function renderMobileNav(items = []) {
  return items
    .map((item) => {
      if (item.type === "group") {
        return `
                    <li class="nav-item">
                        <a class="nav-link ${item.active ? "active" : ""}" href="${item.url}">
                            ${escapeHtml(item.label)}
                        </a>
                    </li>
                `;
      }

      return `
                <li class="nav-item">
                    <a class="nav-link ${item.active ? "active" : ""}" href="${item.url}">
                        ${escapeHtml(item.label)}
                    </a>
                </li>
            `;
    })
    .join("");
}

function renderDesktopNav(items = []) {
  return items
    .map((item) => {
      if (item.type === "group") {
        return `
                    <div class="site-side-nav-group ${item.open ? "is-open" : ""}" data-nav-group="${item.key}">
                        <button class="site-side-nav-parent ${item.active ? "active" : ""}" type="button" data-nav-toggle="${item.key}">
                            <i class="fa-solid ${item.icon || "fa-box-open"}"></i>
                            <span>${escapeHtml(item.label)}</span>
                            <i class="fa-solid fa-chevron-down site-side-nav-caret"></i>
                        </button>
                        <div class="site-side-nav-children ${item.open ? "is-open" : ""}">
                            ${item.children
                              .map(
                                (child) => `
                                        <a class="site-side-nav-child ${child.active ? "active" : ""}" href="${child.url}">
                                            ${escapeHtml(child.label)}
                                        </a>
                                    `,
                              )
                              .join("")}
                        </div>
                    </div>
                `;
      }

      return `
                <a class="site-side-nav-link ${item.active ? "active" : ""}" href="${item.url}">
                    <i class="fa-solid ${item.icon || "fa-angle-right"}"></i>
                    <span>${escapeHtml(item.label)}</span>
                </a>
            `;
    })
    .join("");
}

function bindNavToggleEvents() {
  document.querySelectorAll("[data-nav-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.navToggle;
      const group = document.querySelector(`[data-nav-group="${key}"]`);
      group?.classList.toggle("is-open");
      group
        ?.querySelector(".site-side-nav-children")
        ?.classList.toggle("is-open");
    });
  });
}

async function safeGetCartCount(currentAccount, adminArea) {
  if (!currentAccount || adminArea) {
    return 0;
  }

  try {
    const { chi_tiet_gio_hang } = await gioHangApi.getCurrentWithDetails({
      tai_khoan_id: currentAccount.id,
    });

    return chi_tiet_gio_hang.reduce(
      (sum, item) => sum + Number(item.so_luong || 0),
      0,
    );
  } catch (error) {
    return 0;
  }
}

function getCartBadgeElements() {
  return Array.from(document.querySelectorAll("[data-cart-count-badge]"));
}

function getCurrentCartBadgeCount() {
  const badge = getCartBadgeElements()[0];
  return Math.max(Number(badge?.textContent || 0) || 0, 0);
}

export function setCartBadgeCount(count = 0) {
  const safeCount = Math.max(Number(count) || 0, 0);

  getCartBadgeElements().forEach((badge) => {
    badge.textContent = String(safeCount);
  });
}

async function safeGetCurrentAccount() {
  try {
    return await getCurrentAccount();
  } catch (error) {
    return null;
  }
}

async function safeResolveAdminArea(area, currentAccount) {
  if (area === "admin") {
    return true;
  }

  if (!currentAccount) {
    return false;
  }

  try {
    return await isAdmin(currentAccount);
  } catch (error) {
    return false;
  }
}

export async function refreshCartBadge({
  currentAccount = null,
  adminArea = false,
} = {}) {
  const account = currentAccount || (await safeGetCurrentAccount());
  const cartCount = await safeGetCartCount(account, adminArea);
  setCartBadgeCount(cartCount);
  return cartCount;
}

async function safeLoadNavigationCategories(adminArea) {
  if (adminArea) {
    return [];
  }

  try {
    const categoriesResponse = await danhMucApi.listAll();
    return Array.isArray(categoriesResponse?.items)
      ? categoriesResponse.items
      : [];
  } catch (error) {
    return [];
  }
}

function buildUserNavigation(currentPage, categories, currentAccount) {
  const currentCategoryId = Number(getQueryParam("danh_muc_id") || 0);

  const items = [
    {
      key: "home",
      label: "Trang chủ",
      url: ROUTES.home,
      icon: "fa-house",
      active: currentPage === "home",
    },
    {
      key: "san-pham",
      label: "Sản phẩm",
      url: ROUTES.san_pham,
      icon: "fa-box-open",
      type: "group",
      active: currentPage === "san-pham" || currentPage === "chi-tiet-san-pham",
      open: currentPage === "san-pham" || currentPage === "chi-tiet-san-pham",
      children: [
        {
          label: "Tất cả sản phẩm",
          url: ROUTES.san_pham,
          active: currentPage === "san-pham" && !currentCategoryId,
        },
        ...categories.map((danh_muc) => ({
          label: danh_muc.ten,
          url: buildUrl(ROUTES.san_pham, { danh_muc_id: danh_muc.id }),
          active:
            currentPage === "san-pham" &&
            currentCategoryId === Number(danh_muc.id),
        })),
      ],
    },
    {
      key: "gio-hang",
      label: "Giỏ hàng",
      url: ROUTES.gio_hang,
      icon: "fa-cart-shopping",
      active: currentPage === "gio-hang",
    },
  ];

  if (currentAccount) {
    items.push(
      {
        key: "don-hang",
        label: "Đơn hàng",
        url: ROUTES.don_hang,
        icon: "fa-receipt",
        active: currentPage === "don-hang",
      },
      {
        key: "tai-khoan",
        label: "Tài khoản",
        url: ROUTES.tai_khoan,
        icon: "fa-user",
        active: currentPage === "tai-khoan",
      },
    );
  }

  return items;
}

function buildAdminNavigation(currentPage) {
  return [
    {
      key: "admin-dashboard",
      label: "Dashboard",
      url: ROUTES.admin_dashboard,
      icon: "fa-chart-line",
      active: currentPage === "admin-dashboard",
    },
    {
      key: "admin-san-pham",
      label: "Sản phẩm",
      url: ROUTES.admin_san_pham,
      icon: "fa-box-open",
      active: currentPage === "admin-san-pham",
    },
    {
      key: "admin-danh-muc",
      label: "Danh mục",
      url: ROUTES.admin_danh_muc,
      icon: "fa-layer-group",
      active: currentPage === "admin-danh-muc",
    },
    {
      key: "admin-thuong-hieu",
      label: "Thương hiệu",
      url: ROUTES.admin_thuong_hieu,
      icon: "fa-copyright",
      active: currentPage === "admin-thuong-hieu",
    },
    {
      key: "admin-don-hang",
      label: "Đơn hàng",
      url: ROUTES.admin_don_hang,
      icon: "fa-receipt",
      active: currentPage === "admin-don-hang",
    },
    {
      key: "admin-tai-khoan",
      label: "Tài khoản",
      url: ROUTES.admin_tai_khoan,
      icon: "fa-users",
      active: currentPage === "admin-tai-khoan",
    },
    {
      key: "admin-vai-tro",
      label: "Vai trò",
      url: ROUTES.admin_vai_tro,
      icon: "fa-shield-halved",
      active: currentPage === "admin-vai-tro",
    },
    {
      key: "back-store",
      label: "Về cửa hàng",
      url: ROUTES.home,
      icon: "fa-store",
      active: false,
    },
  ];
}

function renderFooter() {
  const footerRoot = document.getElementById("site-footer");

  if (!footerRoot) {
    return;
  }

  footerRoot.innerHTML = `
        <footer class="site-footer">
            <div class="container">
                <div class="footer-service-grid">
                    <div class="service-card">
                        <div class="service-icon"><i class="fa-solid fa-truck-fast"></i></div>
                        <div>
                            <h3 class="h6 fw-bold mb-1">Mua sắm nhanh chóng</h3>
                            <p class="text-muted mb-0">Dễ tìm kiếm, so sánh và chọn linh kiện phù hợp cho nhu cầu của bạn.</p>
                        </div>
                    </div>
                    <div class="service-card">
                        <div class="service-icon"><i class="fa-solid fa-code-branch"></i></div>
                        <div>
                            <h3 class="h6 fw-bold mb-1">Sản phẩm rõ thông tin</h3>
                            <p class="text-muted mb-0">Giá bán, hình ảnh, bảo hành và mô tả được hiển thị rõ ràng, dễ theo dõi.</p>
                        </div>
                    </div>
                    <div class="service-card">
                        <div class="service-icon"><i class="fa-solid fa-plug-circle-check"></i></div>
                        <div>
                            <h3 class="h6 fw-bold mb-1">Hỗ trợ tận tình</h3>
                            <p class="text-muted mb-0">Hệ thống tối ưu cho việc theo dõi đơn hàng, thanh toán và chế độ hậu mãi.</p>
                        </div>
                    </div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-4">
                        <div class="footer-brand">
                            <span class="site-logo-mark"><i class="fa-solid fa-microchip"></i></span>
                            <div>
                                <div class="site-logo-title text-white">Linh Kiện Máy Tính</div>
                                <div class="text-muted">Thiết bị và linh kiện chính hãng</div>
                            </div>
                        </div>
                        <p class="mb-0">Chuyên cung cấp linh kiện máy tính với thông tin minh bạch, giá tốt và trải nghiệm mua sắm thuận tiện.</p>
                    </div>
                    <div class="col-lg-3 col-md-4">
                        <h3 class="footer-title">Điều hướng</h3>
                        <a class="footer-link" href="${ROUTES.home}">Trang chủ</a>
                        <a class="footer-link" href="${ROUTES.san_pham}">Sản phẩm</a>
                        <a class="footer-link" href="${ROUTES.gio_hang}">Giỏ hàng</a>
                        <a class="footer-link" href="${ROUTES.don_hang}">Đơn hàng</a>
                    </div>
                    <div class="col-lg-5 col-md-8">
                        <h3 class="footer-title">Cam kết dịch vụ</h3>
                        <div class="footer-link"><i class="fa-solid fa-link"></i> Hình ảnh sản phẩm rõ ràng, dễ theo dõi.</div>
                        <div class="footer-link"><i class="fa-solid fa-table-columns"></i> Giá bán minh bạch, cập nhật nhanh.</div>
                        <div class="footer-link"><i class="fa-solid fa-shield-halved"></i> Hỗ trợ mua hàng an tâm và tiện lợi.</div>
                    </div>
                </div>
                <div class="footer-bottom d-flex flex-wrap justify-content-between gap-2">
                    <span>&copy; 2026 Linh Kiện Máy Tính.</span>
                    <span>Website bán linh kiện máy tính.</span>
                </div>
            </div>
        </footer>
    `;
}

export async function initializeLayout({ currentPage, area = "user" }) {
  const headerRoot = document.getElementById("site-header");
  const currentAccount = await safeGetCurrentAccount();
  const adminArea = await safeResolveAdminArea(area, currentAccount);
  const categories = await safeLoadNavigationCategories(adminArea);
  const navigationItems = adminArea
    ? buildAdminNavigation(currentPage)
    : buildUserNavigation(currentPage, categories, currentAccount);
  const cartCount = await safeGetCartCount(currentAccount, adminArea);

  document.body.classList.toggle("is-admin-area", adminArea);

  if (headerRoot) {
    headerRoot.innerHTML = `
            <header class="site-header">
                <div class="site-topbar py-2">
                    <div class="container d-flex flex-wrap justify-content-between gap-2">
                        <span><i class="fa-solid fa-shield-halved me-2"></i>Linh kiện chính hãng, thông tin rõ ràng</span>
                        <span>Hỗ trợ mua sắm nhanh và tiện lợi</span>
                    </div>
                </div>
                <div class="header-main py-3">
                    <div class="container">
                        <div class="row align-items-center g-3">
                            <div class="col-lg-3 col-md-4 col-7">
                                <a href="${ROUTES.home}" class="site-logo">
                                    <span class="site-logo-mark"><i class="fa-solid fa-microchip"></i></span>
                                    <span>
                                        <span class="site-logo-title">Linh Kiện Máy Tính</span>
                                        <span class="site-logo-subtitle">Thiết bị và linh kiện chính hãng</span>
                                    </span>
                                </a>
                            </div>
                            <div class="col-lg-6 col-md-8 order-md-2 order-3">
                                <form class="site-search" id="global-search-form">
                                    <div class="input-group">
                                        <input class="form-control" id="global-search-input" type="search" placeholder="Tìm sản phẩm theo tên..." value="${escapeHtml(getQueryParam("tu_khoa") || "")}">
                                        <button class="btn btn-primary" type="submit">
                                            <i class="fa-solid fa-magnifying-glass"></i>
                                        </button>
                                    </div>
                                </form>
                            </div>
                            <div class="col-lg-3 col-md-12 col-5 text-end order-md-3 order-2">
                                <div class="header-actions justify-content-end">
                                    ${
                                      adminArea
                                        ? ""
                                        : `
                                        <a class="header-action" href="${ROUTES.gio_hang}" aria-label="Giỏ hàng">
                                            <i class="fa-solid fa-cart-shopping"></i>
                                            <span class="badge bg-primary rounded-pill position-absolute top-0 start-100 translate-middle" data-cart-count-badge>${cartCount}</span>
                                        </a>
                                    `
                                    }
                                    ${
                                      currentAccount
                                        ? `
                                                <div class="dropdown">
                                                    <button class="header-user-toggle dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                        <i class="fa-regular fa-user"></i>
                                                        <span>${escapeHtml(currentAccount.ho_ten || currentAccount.ten_dang_nhap || "Tài khoản")}</span>
                                                    </button>
                                                    <ul class="dropdown-menu dropdown-menu-end shadow border-0 mt-2">
                                                        ${adminArea ? `<li><a class="dropdown-item" href="${ROUTES.admin_dashboard}">Khu quản trị</a></li>` : `<li><a class="dropdown-item" href="${ROUTES.tai_khoan}">Tài khoản của tôi</a></li>`}
                                                        <li><button class="dropdown-item text-danger" type="button" id="logout-action">Đăng xuất</button></li>
                                                    </ul>
                                                </div>
                                            `
                                        : `
                                                <div class="d-flex gap-2">
                                                    <a class="btn btn-outline-primary btn-sm" href="${ROUTES.login}">Đăng nhập</a>
                                                    <a class="btn btn-primary btn-sm" href="${ROUTES.register}">Đăng ký</a>
                                                </div>
                                            `
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <nav class="navbar navbar-expand-lg navbar-dark site-navbar-mobile py-0 d-lg-none">
                    <div class="container">
                        <button class="navbar-toggler my-2" type="button" data-bs-toggle="collapse" data-bs-target="#site-navbar-collapse">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="site-navbar-collapse">
                            <ul class="navbar-nav w-100">
                                ${renderMobileNav(navigationItems)}
                            </ul>
                        </div>
                    </div>
                </nav>
            </header>
            <aside class="site-side-nav d-none d-lg-block" aria-label="Điều hướng chính">
                <div class="site-side-nav-inner">
                    <div class="site-side-nav-label">${adminArea ? "Quản trị" : "Khám phá nhanh"}</div>
                    <nav class="site-side-nav-list">
                        ${renderDesktopNav(navigationItems)}
                    </nav>
                </div>
            </aside>
        `;
  }

  renderFooter();
  bindNavToggleEvents();

  document
    .getElementById("global-search-form")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      const tu_khoa =
        document.getElementById("global-search-input")?.value.trim() || "";
      window.location.href = buildUrl(ROUTES.san_pham, { tu_khoa });
    });

  document
    .getElementById("logout-action")
    ?.addEventListener("click", async () => {
      await logout();
      await showToast("Đã đăng xuất.");
      window.location.href = ROUTES.home;
    });

  updateHeaderOffset();
  window.addEventListener("resize", updateHeaderOffset);

  return {
    currentAccount,
    adminArea,
    categories,
  };
}

export async function ensureLoggedIn() {
  const currentAccount = await getCurrentAccount();

  if (!currentAccount) {
    redirectToLogin(window.location.href);
    return null;
  }

  return currentAccount;
}

export async function ensureAdminPage() {
  const currentAccount = await ensureLoggedIn();

  if (!currentAccount) {
    return null;
  }

  const admin = await isAdmin(currentAccount);

  if (!admin) {
    window.location.href = ROUTES.home;
    return null;
  }

  return currentAccount;
}

export async function loadCatalogLookups() {
  const [danhMucResponse, thuongHieuResponse, hinhAnhResponse] =
    await Promise.all([
      danhMucApi.listAll(),
      thuongHieuApi.listAll(),
      hinhAnhSanPhamApi.listAll(),
    ]);

  return {
    danh_muc: danhMucResponse.items,
    thuong_hieu: thuongHieuResponse.items,
    hinh_anh_san_pham: hinhAnhResponse.items,
    danhMucMap: toMapById(danhMucResponse.items),
    thuongHieuMap: toMapById(thuongHieuResponse.items),
    hinhAnhMap: groupBy(hinhAnhResponse.items, "san_pham_id"),
  };
}

export async function addProductToCart({
  san_pham,
  so_luong = 1,
  currentAccount = null,
}) {
  const account = currentAccount || (await getCurrentAccount());

  if (!account) {
    redirectToLogin(window.location.href);
    return false;
  }

  if (await isAdmin(account)) {
    showToast(
      "Tài khoản quản trị không thể thêm sản phẩm vào giỏ hàng.",
      "warning",
    );
    return false;
  }

  const productBlockMessage = getProductPurchaseBlockMessage(san_pham, {
    quantity: so_luong,
    includeName: true,
  });

  if (productBlockMessage) {
    showToast(productBlockMessage, "warning");
    return false;
  }

  const gio_hang = await gioHangApi.ensureCurrent({
    tai_khoan_id: account.id,
  });

  try {
    await gioHangApi.addProduct({
      gio_hang_id: gio_hang.id,
      san_pham_id: san_pham.id,
      so_luong,
      don_gia: getProductCurrentPrice(san_pham),
      maxQuantity: Number(san_pham?.so_luong_ton || 0),
    });
  } catch (error) {
    showToast(error.message || "Không thể thêm sản phẩm vào giỏ hàng.", "warning");
    return false;
  }

  showToast("Thêm sản phẩm vào giỏ hàng thành công.");
  setCartBadgeCount(getCurrentCartBadgeCount() + Number(so_luong || 0));
  void refreshCartBadge({ currentAccount: account });
  return true;
}
