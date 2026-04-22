import {
    escapeHtml,
    formatCurrency,
    getProductCurrentPrice,
    getProductDiscountPercent,
    getProductMainImage,
    renderStatus
} from "./helpers.js";
import { sanitizeRichTextHtml } from "./rich-text.js";

const PREVIEW_MODAL_ID = "product-preview-modal";
const PREVIEW_STYLE_ID = "product-preview-style";

function ensurePreviewStyles() {
    if (document.getElementById(PREVIEW_STYLE_ID)) {
        return;
    }

    const style = document.createElement("style");
    style.id = PREVIEW_STYLE_ID;
    style.textContent = `
        .product-preview-enabled .product-card {
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .product-preview-enabled .product-card:hover {
            transform: translateY(-4px);
        }

        .product-preview-enabled .product-card .product-card-actions .btn,
        .product-preview-enabled .product-card [data-add-to-cart] {
            cursor: pointer;
        }

        .product-preview-modal .modal-content {
            border: 0;
            border-radius: 28px;
            overflow: hidden;
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.18);
        }

        .product-preview-media {
            border-radius: 24px;
            overflow: hidden;
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
        }

        .product-preview-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .product-preview-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
        }

        .product-preview-meta-item {
            border-radius: 18px;
            background: #f8fafc;
            padding: 12px 14px;
        }

        .product-preview-meta-item .label {
            display: block;
            color: #64748b;
            font-size: 0.8rem;
            margin-bottom: 4px;
        }

        .product-preview-double-click {
            color: #64748b;
            font-size: 0.9rem;
        }
    `;

    document.head.appendChild(style);
}

function ensurePreviewModal() {
    let modalElement = document.getElementById(PREVIEW_MODAL_ID);

    if (modalElement) {
        return modalElement;
    }

    modalElement = document.createElement("div");
    modalElement.className = "modal fade product-preview-modal";
    modalElement.id = PREVIEW_MODAL_ID;
    modalElement.tabIndex = -1;
    modalElement.setAttribute("aria-labelledby", "product-preview-modal-title");
    modalElement.setAttribute("aria-hidden", "true");
    modalElement.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div class="modal-content">
                <div class="modal-header border-0 pb-0">
                    <div>
                        <div class="small-caps mb-2">Xem nhanh sản phẩm</div>
                        <h2 class="h4 mb-0" id="product-preview-modal-title">Sản phẩm</h2>
                    </div>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button>
                </div>
                <div class="modal-body pt-3" id="product-preview-modal-body"></div>
            </div>
        </div>
    `;

    document.body.appendChild(modalElement);
    return modalElement;
}

function resolveCatalog(catalog) {
    return typeof catalog === "function" ? catalog() : catalog;
}

function getDetailUrl(card) {
    return (
        card.querySelector(".product-card-actions .btn-outline-primary[href]")?.getAttribute("href") ||
        card.querySelector(".product-title[href]")?.getAttribute("href") ||
        card.querySelector(".product-thumb[href]")?.getAttribute("href") ||
        ""
    );
}

function getProductId(card, detailUrl) {
    const buttonProductId = Number(card.querySelector("[data-add-to-cart]")?.dataset.addToCart || 0);

    if (buttonProductId) {
        return buttonProductId;
    }

    try {
        return Number(new URL(detailUrl, window.location.href).searchParams.get("id") || 0);
    } catch (error) {
        return 0;
    }
}

function buildFallbackProduct(card, productId) {
    return {
        id: productId,
        ten: card.querySelector(".product-title")?.textContent?.trim() || "Sản phẩm",
        mo_ta_ngan: "",
        trang_thai: "",
        so_luong_ton: "",
        ma_san_pham: "",
        _previewImage: card.querySelector(".product-thumb img")?.getAttribute("src") || "",
        _previewCurrentPriceText: card.querySelector(".product-current-price")?.textContent?.trim() || "",
        _previewOldPriceText: card.querySelector(".product-old-price")?.textContent?.trim() || "",
        _previewBrandText: card.querySelector(".product-brand")?.textContent?.trim() || ""
    };
}

function renderPrice(product) {
    const currentPrice = getProductCurrentPrice(product);
    const discountPercent = getProductDiscountPercent(product);
    const hasNumericPrice = Number(product?.gia_ban || 0) > 0 || Number(product?.gia_giam || 0) > 0;

    if (!hasNumericPrice) {
        return `
            <div class="d-flex flex-wrap align-items-center gap-3">
                <span class="h3 fw-bold mb-0">${escapeHtml(product._previewCurrentPriceText || "Liên hệ")}</span>
                ${product._previewOldPriceText ? `<span class="text-muted text-decoration-line-through">${escapeHtml(product._previewOldPriceText)}</span>` : ""}
            </div>
        `;
    }

    return `
        <div class="d-flex flex-wrap align-items-center gap-3">
            <span class="h3 fw-bold mb-0">${formatCurrency(currentPrice)}</span>
            ${discountPercent > 0 ? `<span class="text-muted text-decoration-line-through">${formatCurrency(product.gia_ban)}</span>` : ""}
            ${discountPercent > 0 ? `<span class="badge text-bg-danger">-${discountPercent}%</span>` : ""}
        </div>
    `;
}

function renderMetaItem(label, value) {
    if (!value && value !== 0) {
        return "";
    }

    return `
        <div class="product-preview-meta-item">
            <span class="label">${escapeHtml(label)}</span>
            <strong>${escapeHtml(String(value))}</strong>
        </div>
    `;
}

function openPreview({ product, catalog, detailUrl }) {
    const modalElement = ensurePreviewModal();
    const modalTitle = modalElement.querySelector("#product-preview-modal-title");
    const modalBody = modalElement.querySelector("#product-preview-modal-body");
    const modal = window.bootstrap?.Modal.getOrCreateInstance(modalElement);
    const thuongHieu =
        product?.thuong_hieu?.ten ||
        catalog?.thuongHieuMap?.get(Number(product?.thuong_hieu_id))?.ten ||
        product?._previewBrandText ||
        "Đang cập nhật";
    const mainImage = product?._previewImage || getProductMainImage(product, catalog?.hinhAnhMap);
    const shortDescriptionHtml = sanitizeRichTextHtml(product?.mo_ta_ngan || "");

    modalTitle.textContent = product?.ten || "Sản phẩm";
    modalBody.innerHTML = `
        <div class="row g-4 align-items-start">
            <div class="col-md-5">
                <div class="product-preview-media ratio ratio-1x1">
                    <img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product?.ten || "Sản phẩm")}">
                </div>
            </div>
            <div class="col-md-7">
                <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                    <span class="small-caps">${escapeHtml(thuongHieu)}</span>
                    ${product?.trang_thai ? renderStatus("trang_thai_san_pham", product.trang_thai) : ""}
                </div>
                <h3 class="h3 fw-bold mb-3">${escapeHtml(product?.ten || "Sản phẩm")}</h3>
                <div class="mb-3">
                    ${renderPrice(product)}
                </div>
                <div class="rich-content rich-content-compact mb-4">
                    ${shortDescriptionHtml || `<p class="text-muted mb-0">Sản phẩm này hiện chưa có mô tả ngắn.</p>`}
                </div>
                <div class="product-preview-meta mb-4">
                    ${renderMetaItem("Mã sản phẩm", product?.ma_san_pham || "N/A")}
                    ${renderMetaItem("Tồn kho", product?.so_luong_ton !== "" ? `${Number(product?.so_luong_ton || 0)} sản phẩm` : "")}
                    ${renderMetaItem("Bảo hành", Number(product?.thoi_gian_bao_hanh_thang || 0) > 0 ? `${Number(product?.thoi_gian_bao_hanh_thang)} tháng` : "")}
                </div>
                <div class="d-flex flex-wrap gap-3 align-items-center">
                    <a class="btn btn-primary" href="${escapeHtml(detailUrl)}">Xem chi tiết</a>
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Đóng</button>
                </div>
                <div class="product-preview-double-click mt-3">Nhấp đúp vào card sản phẩm để mở thẳng trang chi tiết.</div>
            </div>
        </div>
    `;

    modal?.show();
}

function hidePreviewIfOpen() {
    const modalElement = document.getElementById(PREVIEW_MODAL_ID);
    if (!modalElement) {
        return;
    }

    const modal = window.bootstrap?.Modal.getInstance(modalElement);
    modal?.hide();
}

export function enableProductCardPreview({ root, catalog, resolveProduct }) {
    if (!root || root.dataset.productPreviewBound === "true") {
        return;
    }

    ensurePreviewStyles();
    ensurePreviewModal();

    root.dataset.productPreviewBound = "true";
    root.classList.add("product-preview-enabled");

    let clickTimer = 0;

    const clearPendingPreview = () => {
        if (!clickTimer) {
            return;
        }

        window.clearTimeout(clickTimer);
        clickTimer = 0;
    };

    root.addEventListener("click", (event) => {
        if (event.target.closest("[data-add-to-cart]")) {
            return;
        }

        const card = event.target.closest(".product-card");
        if (!card || !root.contains(card)) {
            return;
        }

        if (event.target.closest(".product-card-actions .btn-outline-primary[href]")) {
            clearPendingPreview();
            return;
        }

        const detailUrl = getDetailUrl(card);
        const productId = getProductId(card, detailUrl);

        if (!detailUrl || !productId) {
            return;
        }

        event.preventDefault();
        clearPendingPreview();

        clickTimer = window.setTimeout(() => {
            const catalogData = resolveCatalog(catalog);
            const product = resolveProduct(productId) || buildFallbackProduct(card, productId);

            openPreview({
                product,
                catalog: catalogData,
                detailUrl
            });

            clickTimer = 0;
        }, 220);
    });

    root.addEventListener("dblclick", (event) => {
        if (event.target.closest("[data-add-to-cart]")) {
            return;
        }

        const card = event.target.closest(".product-card");
        if (!card || !root.contains(card)) {
            return;
        }

        const detailUrl = getDetailUrl(card);

        if (!detailUrl) {
            return;
        }

        event.preventDefault();
        clearPendingPreview();
        hidePreviewIfOpen();
        window.location.href = detailUrl;
    });
}
