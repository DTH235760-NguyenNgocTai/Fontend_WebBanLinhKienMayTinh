import { danhMucApi, gioHangApi, hinhAnhSanPhamApi, thuongHieuApi } from "./api.js";
import { getCurrentAccount, isAdmin, logout } from "./auth.js";

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0
});

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short"
});

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
    admin_vai_tro: `${basePath}pages/admin/vai-tro.html`
};

const statusMaps = {
    trang_thai_san_pham: {
        hoat_dong: { label: "Hoạt động", tone: "success" },
        sap_het_hang: { label: "Sắp hết hàng", tone: "warning" },
        dang_nhap_hang: { label: "Đang nhập hàng", tone: "info" },
        ngung_kinh_doanh: { label: "Ngừng kinh doanh", tone: "danger" }
    },
    trang_thai_tai_khoan: {
        hoat_dong: { label: "Hoạt động", tone: "success" },
        bi_khoa: { label: "Bị khóa", tone: "danger" }
    },
    trang_thai_don_hang: {
        cho_xac_nhan: { label: "Chờ xác nhận", tone: "warning" },
        dang_xu_ly: { label: "Đang xử lý", tone: "info" },
        dang_giao: { label: "Đang giao", tone: "info" },
        hoan_thanh: { label: "Hoàn thành", tone: "success" },
        da_huy: { label: "Đã hủy", tone: "danger" }
    },
    trang_thai_thanh_toan: {
        chua_thanh_toan: { label: "Chưa thanh toán", tone: "warning" },
        da_thanh_toan: { label: "Đã thanh toán", tone: "success" },
        that_bai: { label: "Thất bại", tone: "danger" }
    }
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

export function renderStatus(type, value) {
    const config = statusMaps[type]?.[value] || {
        label: value || "Chưa cập nhật",
        tone: "info"
    };

    return `<span class="status-pill ${config.tone}">${escapeHtml(config.label)}</span>`;
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

    imageElement.addEventListener("error", (event) => handleImageError(event, label));
}

export function toMapById(items = []) {
    return new Map(items.map((item) => [Number(item.id), item]));
}

export function groupBy(items = [], key) {
    return items.reduce((result, item) => {
        const groupKey = typeof key === "function" ? key(item) : item?.[key];
        const normalizedKey = Number.isNaN(Number(groupKey)) ? groupKey : Number(groupKey);

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

export function getProductImages(san_pham, imageMap = new Map()) {
    const nestedImages = Array.isArray(san_pham?.hinh_anh_san_pham) ? san_pham.hinh_anh_san_pham : [];
    const lookupImages = imageMap.get(Number(san_pham?.id)) || [];
    const images = nestedImages.length ? nestedImages : lookupImages;

    return [...images].sort((first, second) => {
        if (Boolean(second.la_anh_chinh) !== Boolean(first.la_anh_chinh)) {
            return Number(second.la_anh_chinh) - Number(first.la_anh_chinh);
        }

        return Number(first.thu_tu || 0) - Number(second.thu_tu || 0);
    });
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
    const thuong_hieu = san_pham?.thuong_hieu || thuongHieuMap.get(Number(san_pham?.thuong_hieu_id));
    const isNew = san_pham?.ngay_tao
        ? (Date.now() - new Date(san_pham.ngay_tao).getTime()) / (1000 * 60 * 60 * 24) <= 30
        : false;
    const canBuy = san_pham?.trang_thai === "hoat_dong" && Number(san_pham?.so_luong_ton || 0) > 0;

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
                <div>${renderStatus("trang_thai_san_pham", san_pham.trang_thai)}</div>
                <div class="product-card-actions">
                    <a class="btn btn-outline-primary" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: san_pham.id })}">
                        Xem chi tiết
                    </a>
                    <button class="btn btn-primary" type="button" data-add-to-cart="${san_pham.id}" ${canBuy ? "" : "disabled"}>
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
                            : `<span class="${index === breadcrumbs.length - 1 ? "current" : ""}">${escapeHtml(item.label)}</span>`
                    )
                    .join('<span>/</span>')}
            </nav>
            <h1 class="mb-3">${escapeHtml(title)}</h1>
            <p class="mb-0">${escapeHtml(subtitle)}</p>
        </section>
    `;
}

export function renderEmptyState({ icon = "fa-circle-info", title, message, actionLabel = "", actionHref = "" }) {
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
        pageSize
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

export function showToast(message, tone = "success") {
    const container = ensureToastContainer();
    const toastElement = document.createElement("div");
    const bgClass = tone === "danger" ? "bg-dark" : tone === "warning" ? "bg-warning" : "bg-primary";
    const textClass = tone === "warning" ? "text-dark" : "text-white";

    toastElement.className = "toast align-items-center border-0";
    toastElement.setAttribute("role", "alert");
    toastElement.innerHTML = `
        <div class="d-flex">
            <div class="toast-body ${bgClass} ${textClass} rounded">
                ${escapeHtml(message)}
            </div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

    container.appendChild(toastElement);

    const toast = window.bootstrap?.Toast.getOrCreateInstance(toastElement, { delay: 2400 });
    toast?.show();
    toastElement.addEventListener("hidden.bs.toast", () => toastElement.remove());
}

export function redirectToLogin(redirect = window.location.href) {
    window.location.href = buildUrl(ROUTES.login, { redirect });
}

function updateHeaderOffset() {
    const topbarHeight = document.querySelector(".site-topbar")?.offsetHeight || 0;
    const headerMainHeight = document.querySelector(".header-main")?.offsetHeight || 0;
    document.documentElement.style.setProperty("--site-header-offset", `${topbarHeight + headerMainHeight}px`);
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
                                    `
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
            group?.querySelector(".site-side-nav-children")?.classList.toggle("is-open");
        });
    });
}

async function safeGetCartCount(currentAccount, adminArea) {
    if (!currentAccount || adminArea) {
        return 0;
    }

    try {
        const { chi_tiet_gio_hang } = await gioHangApi.getCurrentWithDetails({
            khach_hang_id: currentAccount.id
        });

        return chi_tiet_gio_hang.reduce((sum, item) => sum + Number(item.so_luong || 0), 0);
    } catch (error) {
        return 0;
    }
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

async function safeLoadNavigationCategories(adminArea) {
    if (adminArea) {
        return [];
    }

    try {
        const categoriesResponse = await danhMucApi.list();
        return Array.isArray(categoriesResponse?.items) ? categoriesResponse.items : [];
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
            active: currentPage === "home"
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
                    active: currentPage === "san-pham" && !currentCategoryId
                },
                ...categories.map((danh_muc) => ({
                    label: danh_muc.ten,
                    url: buildUrl(ROUTES.san_pham, { danh_muc_id: danh_muc.id }),
                    active: currentPage === "san-pham" && currentCategoryId === Number(danh_muc.id)
                }))
            ]
        },
        {
            key: "gio-hang",
            label: "Giỏ hàng",
            url: ROUTES.gio_hang,
            icon: "fa-cart-shopping",
            active: currentPage === "gio-hang"
        }
    ];

    if (currentAccount) {
        items.push(
            {
                key: "don-hang",
                label: "Đơn hàng",
                url: ROUTES.don_hang,
                icon: "fa-receipt",
                active: currentPage === "don-hang"
            },
            {
                key: "tai-khoan",
                label: "Tài khoản",
                url: ROUTES.tai_khoan,
                icon: "fa-user",
                active: currentPage === "tai-khoan"
            }
        );
    }

    return items;
}

function buildAdminNavigation(currentPage) {
    return [
        { key: "admin-dashboard", label: "Dashboard", url: ROUTES.admin_dashboard, icon: "fa-chart-line", active: currentPage === "admin-dashboard" },
        { key: "admin-san-pham", label: "Sản phẩm", url: ROUTES.admin_san_pham, icon: "fa-box-open", active: currentPage === "admin-san-pham" },
        { key: "admin-danh-muc", label: "Danh mục", url: ROUTES.admin_danh_muc, icon: "fa-layer-group", active: currentPage === "admin-danh-muc" },
        { key: "admin-thuong-hieu", label: "Thương hiệu", url: ROUTES.admin_thuong_hieu, icon: "fa-copyright", active: currentPage === "admin-thuong-hieu" },
        { key: "admin-don-hang", label: "Đơn hàng", url: ROUTES.admin_don_hang, icon: "fa-receipt", active: currentPage === "admin-don-hang" },
        { key: "admin-tai-khoan", label: "Tài khoản", url: ROUTES.admin_tai_khoan, icon: "fa-users", active: currentPage === "admin-tai-khoan" },
        { key: "admin-vai-tro", label: "Vai trò", url: ROUTES.admin_vai_tro, icon: "fa-shield-halved", active: currentPage === "admin-vai-tro" },
        { key: "back-store", label: "Về cửa hàng", url: ROUTES.home, icon: "fa-store", active: false }
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
                            <h3 class="h6 fw-bold mb-1">Luồng mua hàng rõ ràng</h3>
                            <p class="text-muted mb-0">Tách riêng sản phẩm, giỏ hàng, thanh toán và đơn hàng để dễ nối backend thật.</p>
                        </div>
                    </div>
                    <div class="service-card">
                        <div class="service-icon"><i class="fa-solid fa-code-branch"></i></div>
                        <div>
                            <h3 class="h6 fw-bold mb-1">Dữ liệu bám theo CSDL</h3>
                            <p class="text-muted mb-0">Giữ nguyên tên field theo schema để giảm mapper khi tích hợp API.</p>
                        </div>
                    </div>
                    <div class="service-card">
                        <div class="service-icon"><i class="fa-solid fa-plug-circle-check"></i></div>
                        <div>
                            <h3 class="h6 fw-bold mb-1">Dễ thay backend</h3>
                            <p class="text-muted mb-0">Đổi \`BASE_URL\` trong \`js/api.js\` và cập nhật \`API_PATHS\` nếu backend khác route.</p>
                        </div>
                    </div>
                </div>
                <div class="row g-4">
                    <div class="col-lg-4">
                        <div class="footer-brand">
                            <span class="site-logo-mark"><i class="fa-solid fa-microchip"></i></span>
                            <div>
                                <div class="site-logo-title text-white">Frontend Linh Kiện</div>
                                <div class="text-muted">Website bán linh kiện máy tính</div>
                            </div>
                        </div>
                        <p class="mb-0">Project đã được làm sạch cấu trúc thư mục, tách logic trang và bỏ hoàn toàn fake JSON/mock data hiển thị.</p>
                    </div>
                    <div class="col-lg-3 col-md-4">
                        <h3 class="footer-title">Điều hướng</h3>
                        <a class="footer-link" href="${ROUTES.home}">Trang chủ</a>
                        <a class="footer-link" href="${ROUTES.san_pham}">Sản phẩm</a>
                        <a class="footer-link" href="${ROUTES.gio_hang}">Giỏ hàng</a>
                        <a class="footer-link" href="${ROUTES.don_hang}">Đơn hàng</a>
                    </div>
                    <div class="col-lg-5 col-md-8">
                        <h3 class="footer-title">Ghi chú tích hợp</h3>
                        <div class="footer-link"><i class="fa-solid fa-link"></i> Đổi \`BASE_URL\` để trỏ sang backend thật.</div>
                        <div class="footer-link"><i class="fa-solid fa-table-columns"></i> Field dữ liệu bám theo tên trong CSDL.</div>
                        <div class="footer-link"><i class="fa-solid fa-shield-halved"></i> Token đăng nhập được gắn qua header Authorization.</div>
                    </div>
                </div>
                <div class="footer-bottom d-flex flex-wrap justify-content-between gap-2">
                    <span>&copy; 2026 Frontend Linh Kiện.</span>
                    <span>Static HTML + CSS + JavaScript module + fetch API.</span>
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
                        <span><i class="fa-solid fa-shield-halved me-2"></i>Frontend đã sẵn sàng nối API thật</span>
                        <span><strong>BASE_URL:</strong> thay trong <code>js/api.js</code></span>
                    </div>
                </div>
                <div class="header-main py-3">
                    <div class="container">
                        <div class="row align-items-center g-3">
                            <div class="col-lg-3 col-md-4 col-7">
                                <a href="${ROUTES.home}" class="site-logo">
                                    <span class="site-logo-mark"><i class="fa-solid fa-microchip"></i></span>
                                    <span>
                                        <span class="site-logo-title">Frontend Linh Kiện</span>
                                        <span class="site-logo-subtitle">Bán linh kiện máy tính</span>
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
                                    ${adminArea ? "" : `
                                        <a class="header-action" href="${ROUTES.gio_hang}" aria-label="Giỏ hàng">
                                            <i class="fa-solid fa-cart-shopping"></i>
                                            <span class="badge bg-primary rounded-pill position-absolute top-0 start-100 translate-middle">${cartCount}</span>
                                        </a>
                                    `}
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

    document.getElementById("global-search-form")?.addEventListener("submit", (event) => {
        event.preventDefault();
        const tu_khoa = document.getElementById("global-search-input")?.value.trim() || "";
        window.location.href = buildUrl(ROUTES.san_pham, { tu_khoa });
    });

    document.getElementById("logout-action")?.addEventListener("click", async () => {
        await logout();
        showToast("Đã đăng xuất.");
        setTimeout(() => {
            window.location.href = ROUTES.home;
        }, 250);
    });

    updateHeaderOffset();
    window.addEventListener("resize", updateHeaderOffset);

    return {
        currentAccount,
        adminArea,
        categories
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
    const [danhMucResponse, thuongHieuResponse, hinhAnhResponse] = await Promise.all([
        danhMucApi.list(),
        thuongHieuApi.list(),
        hinhAnhSanPhamApi.list()
    ]);

    return {
        danh_muc: danhMucResponse.items,
        thuong_hieu: thuongHieuResponse.items,
        hinh_anh_san_pham: hinhAnhResponse.items,
        danhMucMap: toMapById(danhMucResponse.items),
        thuongHieuMap: toMapById(thuongHieuResponse.items),
        hinhAnhMap: groupBy(hinhAnhResponse.items, "san_pham_id")
    };
}

export async function addProductToCart({ san_pham, so_luong = 1, currentAccount = null }) {
    const account = currentAccount || (await getCurrentAccount());

    if (!account) {
        redirectToLogin(window.location.href);
        return false;
    }

    if (await isAdmin(account)) {
        showToast("Tài khoản quản trị không thể thêm sản phẩm vào giỏ hàng.", "warning");
        return false;
    }

    const gio_hang = await gioHangApi.ensureCurrent({
        khach_hang_id: account.id
    });

    await gioHangApi.addProduct({
        gio_hang_id: gio_hang.id,
        san_pham_id: san_pham.id,
        so_luong,
        don_gia: getProductCurrentPrice(san_pham)
    });

    showToast("Đã thêm sản phẩm vào giỏ hàng.");
    return true;
}
