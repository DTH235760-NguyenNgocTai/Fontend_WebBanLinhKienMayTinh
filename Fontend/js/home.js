import { sanPhamApi } from "./api.js";
import {
    addProductToCart,
    buildUrl,
    escapeHtml,
    formatCurrency,
    getProductMainImage,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderProductCard,
    ROUTES
} from "./helpers.js";

function sortByNewest(items = []) {
    return [...items].sort((first, second) => new Date(second.ngay_tao || 0) - new Date(first.ngay_tao || 0));
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
            sanPhamApi.list({ sap_xep: "ngay_tao_desc" }),
            loadCatalogLookups()
        ]);

        const newestProducts = sortByNewest(sanPhamResponse.items).filter((item) => item.trang_thai !== "ngung_kinh_doanh");
        const discountedProducts = newestProducts.filter((item) => Number(item.gia_giam || 0) > 0).slice(0, 4);
        const heroProduct = newestProducts[0] || null;
        const productMap = new Map(newestProducts.map((item) => [Number(item.id), item]));

        heroRoot.innerHTML = heroProduct
            ? `
                <div class="hero-banner">
                    <div class="hero-banner-content">
                        <div class="small-caps mb-3">Trang chủ</div>
                        <h1 class="display-6 fw-bold mb-3">${escapeHtml(heroProduct.ten)}</h1>
                        <p class="mb-0">
                            ${escapeHtml(heroProduct.mo_ta_ngan || "Giao diện đã được refactor để hiển thị dữ liệu thật từ API, giữ nguyên phong cách và tách sạch cấu trúc source code.")}
                        </p>
                        <div class="hero-banner-actions">
                            <a class="btn btn-primary" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: heroProduct.id })}">Xem chi tiết</a>
                            <a class="btn btn-outline-light btn-light" href="${ROUTES.san_pham}">Xem toàn bộ sản phẩm</a>
                        </div>
                        <div class="d-flex flex-wrap gap-4 mt-4">
                            <div>
                                <div class="small text-white-50">Giá hiện tại</div>
                                <div class="fw-bold">${formatCurrency(heroProduct.gia_giam || heroProduct.gia_ban)}</div>
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
                  message: "Khi API sản phẩm có dữ liệu, banner và danh sách trang chủ sẽ tự động đổ ra tại đây."
              });

        categoryRoot.innerHTML = catalog.danh_muc.length
            ? catalog.danh_muc
                  .map(
                      (danh_muc) => `
                        <a class="category-card" href="${buildUrl(ROUTES.san_pham, { danh_muc_id: danh_muc.id })}">
                            <div class="category-icon mb-3"><i class="fa-solid fa-layer-group"></i></div>
                            <h3 class="h5 fw-bold mb-2">${escapeHtml(danh_muc.ten)}</h3>
                            <p class="text-muted mb-0">Lọc nhanh theo danh mục sản phẩm từ API.</p>
                        </a>
                    `
                  )
                  .join("")
            : renderEmptyState({
                  icon: "fa-layer-group",
                  title: "Chưa có danh mục",
                  message: "Danh mục sẽ xuất hiện tại đây khi backend trả dữ liệu."
              });

        newestRoot.innerHTML = newestProducts.length
            ? newestProducts
                  .slice(0, 8)
                  .map((item) => renderProductCard(item, catalog))
                  .join("")
            : renderEmptyState({
                  icon: "fa-box-open",
                  title: "Chưa có sản phẩm mới",
                  message: "API sản phẩm hiện chưa trả dữ liệu cho trang chủ."
              });

        discountRoot.innerHTML = discountedProducts.length
            ? discountedProducts.map((item) => renderProductCard(item, catalog)).join("")
            : renderEmptyState({
                  icon: "fa-tags",
                  title: "Chưa có sản phẩm giảm giá",
                  message: "Khi `gia_giam` có dữ liệu từ backend, khu vực giá tốt sẽ hiển thị tại đây."
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
            message: error.message || "Vui lòng kiểm tra API và thử lại."
        });
        heroRoot.innerHTML = fallback;
        categoryRoot.innerHTML = fallback;
        newestRoot.innerHTML = fallback;
        discountRoot.innerHTML = fallback;
    }
});
