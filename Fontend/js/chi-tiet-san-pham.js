import { sanPhamApi } from "./api.js";
import {
    addProductToCart,
    buildUrl,
    escapeHtml,
    formatCurrency,
    getProductCurrentPrice,
    getProductDiscountPercent,
    getProductImages,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderPageHero,
    renderProductCard,
    ROUTES
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const detailRoot = document.getElementById("product-detail-content");
    const relatedRoot = document.getElementById("related-products-grid");
    const productId = Number(new URLSearchParams(window.location.search).get("id") || 0);

    detailRoot.innerHTML = renderLoadingState("Đang tải chi tiết sản phẩm...");
    relatedRoot.innerHTML = renderLoadingState("Đang tải sản phẩm liên quan...");

    const { currentAccount, adminArea } = await initializeLayout({ currentPage: "chi-tiet-san-pham", area: "user" });

    if (!productId) {
        detailRoot.innerHTML = renderEmptyState({
            icon: "fa-circle-exclamation",
            title: "Thiếu mã sản phẩm",
            message: "Đường dẫn hiện tại chưa có `id` sản phẩm hợp lệ.",
            actionLabel: "Quay lại danh sách",
            actionHref: ROUTES.san_pham
        });
        relatedRoot.innerHTML = "";
        return;
    }

    try {
        const [san_pham, sanPhamResponse, catalog] = await Promise.all([
            sanPhamApi.get(productId),
            sanPhamApi.list(),
            loadCatalogLookups()
        ]);

        if (!san_pham) {
            detailRoot.innerHTML = renderEmptyState({
                icon: "fa-box-open",
                title: "Không tìm thấy sản phẩm",
                message: "Sản phẩm này chưa tồn tại hoặc API không trả về dữ liệu.",
                actionLabel: "Quay lại danh sách",
                actionHref: ROUTES.san_pham
            });
            relatedRoot.innerHTML = "";
            return;
        }

        const imageList = getProductImages(san_pham, catalog.hinhAnhMap);
        const currentPrice = getProductCurrentPrice(san_pham);
        const discountPercent = getProductDiscountPercent(san_pham);
        const relatedProducts = sanPhamResponse.items.filter(
            (item) =>
                Number(item.id) !== Number(san_pham.id) &&
                Number(item.danh_muc_id) === Number(san_pham.danh_muc_id) &&
                item.trang_thai !== "ngung_kinh_doanh"
        );
        const relatedMap = new Map(relatedProducts.map((item) => [Number(item.id), item]));

        detailRoot.innerHTML = `
            ${renderPageHero({
                title: san_pham.ten,
                subtitle: "Chi tiết sản phẩm đã được tách riêng, chỉ hiển thị field bám theo CSDL và dữ liệu lấy qua API thật.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Sản phẩm", url: ROUTES.san_pham },
                    { label: san_pham.ten }
                ]
            })}
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="detail-gallery">
                        <div class="detail-main-image">
                            <img id="detail-main-image" src="${escapeHtml(imageList[0]?.duong_dan || "")}" alt="${escapeHtml(san_pham.ten)}">
                        </div>
                        <div class="detail-thumbs" id="detail-thumbs">
                            ${imageList
                                .map(
                                    (image, index) => `
                                        <button class="detail-thumb ${index === 0 ? "active" : ""}" type="button" data-detail-image="${escapeHtml(image.duong_dan)}">
                                            <img src="${escapeHtml(image.duong_dan)}" alt="${escapeHtml(san_pham.ten)}">
                                        </button>
                                    `
                                )
                                .join("")}
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="surface-card p-4 h-100">
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                            ${catalog.thuongHieuMap.get(Number(san_pham.thuong_hieu_id)) ? `<span class="small-caps">${escapeHtml(catalog.thuongHieuMap.get(Number(san_pham.thuong_hieu_id)).ten)}</span>` : ""}
                            <div>${san_pham.trang_thai ? `<span class="status-pill ${san_pham.trang_thai === "hoat_dong" ? "success" : san_pham.trang_thai === "sap_het_hang" ? "warning" : san_pham.trang_thai === "dang_nhap_hang" ? "info" : "danger"}">${escapeHtml(san_pham.trang_thai)}</span>` : ""}</div>
                        </div>
                        <h1 class="h3 fw-bold mb-3">${escapeHtml(san_pham.ten)}</h1>
                        <div class="detail-price-box mb-4">
                            <div class="product-price mb-2">
                                <span class="product-current-price">${formatCurrency(currentPrice)}</span>
                                ${discountPercent > 0 ? `<span class="product-old-price">${formatCurrency(san_pham.gia_ban)}</span>` : ""}
                            </div>
                            <div class="product-savings">
                                ${discountPercent > 0 ? `Giảm ${discountPercent}% từ giá bán` : "Sản phẩm đang dùng giá bán hiện tại"}
                            </div>
                        </div>
                        <p class="text-muted mb-4">${escapeHtml(san_pham.mo_ta_ngan || "Chưa có mô tả ngắn.")}</p>
                        <div class="product-info-grid mb-4">
                            <div class="info-card p-3">
                                <div class="text-muted small mb-1">Mã sản phẩm</div>
                                <div class="fw-bold">${escapeHtml(san_pham.ma_san_pham || "N/A")}</div>
                            </div>
                            <div class="info-card p-3">
                                <div class="text-muted small mb-1">Danh mục</div>
                                <div class="fw-bold">${escapeHtml(catalog.danhMucMap.get(Number(san_pham.danh_muc_id))?.ten || "Chưa cập nhật")}</div>
                            </div>
                            <div class="info-card p-3">
                                <div class="text-muted small mb-1">Bảo hành</div>
                                <div class="fw-bold">${Number(san_pham.thoi_gian_bao_hanh_thang || 0)} tháng</div>
                            </div>
                            <div class="info-card p-3">
                                <div class="text-muted small mb-1">Tồn kho</div>
                                <div class="fw-bold">${Number(san_pham.so_luong_ton || 0)} sản phẩm</div>
                            </div>
                        </div>
                        <div class="d-flex flex-wrap align-items-center gap-3 mb-4">
                            <div class="quantity-control">
                                <button type="button" id="detail-qty-minus" ${adminArea ? "disabled" : ""}>-</button>
                                <input id="detail-quantity" type="text" value="1" readonly>
                                <button type="button" id="detail-qty-plus" ${adminArea ? "disabled" : ""}>+</button>
                            </div>
                            <button class="btn btn-primary" type="button" id="detail-add-to-cart" ${adminArea || san_pham.trang_thai !== "hoat_dong" || Number(san_pham.so_luong_ton || 0) <= 0 ? "disabled" : ""}>
                                Thêm vào giỏ hàng
                            </button>
                        </div>
                        <div class="text-muted small">Frontend ưu tiên giữ nguyên field dữ liệu của CSDL: `ten`, `gia_ban`, `gia_giam`, `mo_ta_ngan`, `mo_ta_chi_tiet`, `thoi_gian_bao_hanh_thang`, `so_luong_ton`, `trang_thai`.</div>
                    </div>
                </div>
            </div>
            <div class="surface-card p-4 mt-4">
                <div class="section-heading">
                    <h2 class="section-title">Mô tả chi tiết</h2>
                </div>
                <p class="mb-0 text-muted">${escapeHtml(san_pham.mo_ta_chi_tiet || "Chưa có mô tả chi tiết.")}</p>
            </div>
        `;

        relatedRoot.innerHTML = relatedProducts.length
            ? relatedProducts.slice(0, 4).map((item) => renderProductCard(item, catalog)).join("")
            : renderEmptyState({
                  icon: "fa-link",
                  title: "Chưa có sản phẩm liên quan",
                  message: "Danh sách sản phẩm cùng danh mục sẽ xuất hiện tại đây khi API trả dữ liệu."
              });

        detailRoot.addEventListener("click", async (event) => {
            const thumb = event.target.closest("[data-detail-image]");
            if (thumb) {
                document.getElementById("detail-main-image").src = thumb.dataset.detailImage;
                document.querySelectorAll("[data-detail-image]").forEach((item) => item.classList.remove("active"));
                thumb.classList.add("active");
            }

            if (event.target.closest("#detail-qty-minus")) {
                const input = document.getElementById("detail-quantity");
                input.value = String(Math.max(Number(input.value) - 1, 1));
            }

            if (event.target.closest("#detail-qty-plus")) {
                const input = document.getElementById("detail-quantity");
                input.value = String(Math.min(Number(input.value) + 1, Number(san_pham.so_luong_ton || 1)));
            }

            if (event.target.closest("#detail-add-to-cart")) {
                await addProductToCart({
                    san_pham,
                    so_luong: Number(document.getElementById("detail-quantity").value || 1),
                    currentAccount
                });
            }
        });

        document.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-add-to-cart]");
            if (!button) {
                return;
            }

            const relatedProduct = relatedMap.get(Number(button.dataset.addToCart));
            if (!relatedProduct) {
                return;
            }

            await addProductToCart({
                san_pham: relatedProduct,
                currentAccount
            });
        });
    } catch (error) {
        detailRoot.innerHTML = renderEmptyState({
            icon: "fa-triangle-exclamation",
            title: "Không thể tải chi tiết sản phẩm",
            message: error.message || "Vui lòng kiểm tra API và thử lại."
        });
        relatedRoot.innerHTML = "";
    }
});
