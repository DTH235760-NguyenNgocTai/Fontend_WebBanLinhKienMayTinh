import { sanPhamApi } from "./api.js";
import { enableProductCardPreview } from "./product-preview.js";
import { stripRichTextHtml } from "./rich-text.js";
import {
    addProductToCart,
    buildUrl,
    escapeHtml,
    formatCurrency,
    getProductCurrentPrice,
    getProductDiscountPercent,
    getProductMainImage,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderProductCard,
    ROUTES
} from "./helpers.js";

function sortByNewest(items = []) {
    return [...items].sort(
        (first, second) => new Date(second.ngay_tao || second.created_at || 0) - new Date(first.ngay_tao || first.created_at || 0)
    );
}

document.addEventListener("DOMContentLoaded", async () => {
    const heroRoot = document.getElementById("home-hero");
    const newestRoot = document.getElementById("home-newest-products");
    const discountRoot = document.getElementById("home-discount-products");
    const categoryRoot = document.getElementById("home-category-list");

    heroRoot.innerHTML = renderLoadingState("Đang tải banner trang chủ...");
    newestRoot.innerHTML = renderLoadingState("Đang tải sản phẩm mới...");
    discountRoot.innerHTML = renderLoadingState("Đang tải sản phẩm giá tốt...");

    const { currentAccount } = await initializeLayout({ currentPage: "home", area: "user" });

    try {
        const [sanPhamResponse, catalog] = await Promise.all([
            sanPhamApi.listAll({ sort: "moi_nhat" }),
            loadCatalogLookups()
        ]);

        const newestProducts = sortByNewest(sanPhamResponse.items).filter((item) => item.trang_thai !== "ngung_kinh_doanh");
        const discountedProducts = newestProducts.filter((item) => getProductDiscountPercent(item) > 0).slice(0, 4);
        const heroProduct = newestProducts[0] || null;
        const productMap = new Map(newestProducts.map((item) => [Number(item.id), item]));
        const heroDescription =
            stripRichTextHtml(heroProduct?.mo_ta_ngan || "") ||
            "Sản phẩm nổi bật đang được nhiều khách hàng quan tâm.";

        heroRoot.innerHTML = heroProduct
            ? `
                <div class="hero-banner">
                    <div class="hero-banner-content">
                        <div class="small-caps mb-3">Trang chủ</div>
                        <h1 class="display-6 fw-bold mb-3">${escapeHtml(heroProduct.ten)}</h1>
                        <p class="mb-0">
                            ${escapeHtml(heroDescription)}
                        </p>
                        <div class="hero-banner-actions">
                            <a class="btn btn-primary" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: heroProduct.id })}">Xem chi tiết</a>
                            <a class="btn btn-outline-light btn-light" href="${ROUTES.san_pham}">Xem toàn bộ sản phẩm</a>
                        </div>
                        <div class="d-flex flex-wrap gap-4 mt-4">
                            <div>
                                <div class="small text-white-50">Giá hiện tại</div>
                                <div class="fw-bold">${formatCurrency(getProductCurrentPrice(heroProduct))}</div>
                            </div>
                            <div>
                                <div class="small text-white-50">Tồn kho</div>
                                <div class="fw-bold">${Number(heroProduct.so_luong_ton || 0)} sản phẩm</div>
                            </div>
                        </div>
                    </div>
                    <div class="hero-banner-media">
                        <div class="hero-banner-image">
                            <img src="${escapeHtml(getProductMainImage(heroProduct, catalog.hinhAnhMap))}" alt="${escapeHtml(heroProduct.ten)}">
                        </div>
                    </div>
                </div>
            `
            : renderEmptyState({
              icon: "fa-box-open",
                  title: "Chưa có sản phẩm để hiển thị",
                  message: "Sản phẩm nổi bật sẽ xuất hiện tại đây khi cửa hàng cập nhật dữ liệu."
              });

        categoryRoot.innerHTML = catalog.danh_muc.length
            ? catalog.danh_muc
                  .map(
                      (danh_muc) => `
                        <a class="category-card" href="${buildUrl(ROUTES.san_pham, { danh_muc_id: danh_muc.id })}">
                            <div class="category-icon mb-3"><i class="fa-solid fa-layer-group"></i></div>
                            <h3 class="h5 fw-bold mb-2">${escapeHtml(danh_muc.ten)}</h3>
                            <p class="text-muted mb-0">Khám phá nhanh các sản phẩm cùng nhóm.</p>
                        </a>
                    `
                  )
                  .join("")
            : renderEmptyState({
                  icon: "fa-layer-group",
                  title: "Chưa có danh mục",
                  message: "Danh mục sẽ xuất hiện tại đây khi cửa hàng cập nhật dữ liệu."
              });

        newestRoot.innerHTML = newestProducts.length
            ? newestProducts
                  .slice(0, 8)
                  .map((item) => renderProductCard(item, catalog))
                  .join("")
            : renderEmptyState({
                  icon: "fa-box-open",
                  title: "Chưa có sản phẩm mới",
                  message: "Sản phẩm mới sẽ xuất hiện tại đây khi cửa hàng cập nhật dữ liệu."
              });

        discountRoot.innerHTML = discountedProducts.length
            ? discountedProducts.map((item) => renderProductCard(item, catalog)).join("")
            : renderEmptyState({
                  icon: "fa-tags",
                  title: "Chưa có sản phẩm giảm giá",
                  message: "Các ưu đãi mới sẽ xuất hiện tại đây khi có chương trình giảm giá."
              });

        enableProductCardPreview({
            root: newestRoot,
            catalog,
            resolveProduct: (productId) => productMap.get(Number(productId)) || null
        });

        enableProductCardPreview({
            root: discountRoot,
            catalog,
            resolveProduct: (productId) => productMap.get(Number(productId)) || null
        });

        document.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-add-to-cart]");
            if (!button) {
                return;
            }

            const san_pham = productMap.get(Number(button.dataset.addToCart));
            if (!san_pham) {
                return;
            }

            await addProductToCart({
                san_pham,
                currentAccount
            });
        });
    } catch (error) {
        const fallback = renderEmptyState({
            icon: "fa-triangle-exclamation",
            title: "Không thể tải dữ liệu trang chủ",
            message: error.message || "Vui lòng thử lại sau."
        });
        heroRoot.innerHTML = fallback;
        categoryRoot.innerHTML = fallback;
        newestRoot.innerHTML = fallback;
        discountRoot.innerHTML = fallback;
    }
});
