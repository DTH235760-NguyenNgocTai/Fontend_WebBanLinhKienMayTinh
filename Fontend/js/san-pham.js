import { sanPhamApi } from "./api.js";
import {
    addProductToCart,
    buildUrl,
    debounce,
    initializeLayout,
    loadCatalogLookups,
    paginateLocally,
    renderEmptyState,
    renderLoadingState,
    renderPagination,
    renderProductCard,
    ROUTES
} from "./helpers.js";

const PAGE_SIZE = 8;

function sortProducts(items = [], sortKey = "ngay_tao_desc") {
    const sorted = [...items];

    switch (sortKey) {
        case "gia_ban_asc":
            sorted.sort((a, b) => Number(a.gia_giam || a.gia_ban || 0) - Number(b.gia_giam || b.gia_ban || 0));
            break;
        case "gia_ban_desc":
            sorted.sort((a, b) => Number(b.gia_giam || b.gia_ban || 0) - Number(a.gia_giam || a.gia_ban || 0));
            break;
        case "ten_asc":
            sorted.sort((a, b) => (a.ten || "").localeCompare(b.ten || "", "vi"));
            break;
        case "ten_desc":
            sorted.sort((a, b) => (b.ten || "").localeCompare(a.ten || "", "vi"));
            break;
        default:
            sorted.sort((a, b) => new Date(b.ngay_tao || 0) - new Date(a.ngay_tao || 0));
            break;
    }

    return sorted;
}

document.addEventListener("DOMContentLoaded", async () => {
    const filtersForm = document.getElementById("products-filters-form");
    const keywordInput = document.getElementById("filter-tu-khoa");
    const categorySelect = document.getElementById("filter-danh-muc");
    const brandSelect = document.getElementById("filter-thuong-hieu");
    const statusSelect = document.getElementById("filter-trang-thai");
    const sortSelect = document.getElementById("filter-sap-xep");
    const gridRoot = document.getElementById("products-grid");
    const countRoot = document.getElementById("products-result-count");
    const paginationRoot = document.getElementById("products-pagination");

    gridRoot.innerHTML = renderLoadingState("Đang tải danh sách sản phẩm...");

    const { currentAccount } = await initializeLayout({ currentPage: "san-pham", area: "user" });

    try {
        const [catalog, sanPhamResponse] = await Promise.all([
            loadCatalogLookups(),
            sanPhamApi.list({
                tu_khoa: keywordInput.value.trim() || undefined,
                danh_muc_id: categorySelect.value || undefined,
                thuong_hieu_id: brandSelect.value || undefined,
                trang_thai: statusSelect.value || undefined,
                sap_xep: sortSelect.value || undefined
            })
        ]);

        const currentPage = Number(new URLSearchParams(window.location.search).get("trang") || 1);
        const params = new URLSearchParams(window.location.search);

        categorySelect.innerHTML += catalog.danh_muc
            .map((item) => `<option value="${item.id}">${item.ten}</option>`)
            .join("");
        brandSelect.innerHTML += catalog.thuong_hieu
            .map((item) => `<option value="${item.id}">${item.ten}</option>`)
            .join("");

        keywordInput.value = params.get("tu_khoa") || "";
        categorySelect.value = params.get("danh_muc_id") || "";
        brandSelect.value = params.get("thuong_hieu_id") || "";
        statusSelect.value = params.get("trang_thai") || "";
        sortSelect.value = params.get("sap_xep") || "ngay_tao_desc";

        const productMap = new Map();

        const renderPage = async (page = 1) => {
            gridRoot.innerHTML = renderLoadingState("Đang lọc sản phẩm...");

            const response = await sanPhamApi.list({
                tu_khoa: keywordInput.value.trim() || undefined,
                danh_muc_id: categorySelect.value || undefined,
                thuong_hieu_id: brandSelect.value || undefined,
                trang_thai: statusSelect.value || undefined,
                sap_xep: sortSelect.value || undefined
            });

            const filteredProducts = sortProducts(
                response.items.filter((item) => item.trang_thai !== "ngung_kinh_doanh"),
                sortSelect.value
            );

            filteredProducts.forEach((item) => productMap.set(Number(item.id), item));

            const localPagination = paginateLocally(filteredProducts, page, PAGE_SIZE);

            countRoot.textContent = `${localPagination.totalItems} sản phẩm`;
            gridRoot.innerHTML = localPagination.items.length
                ? localPagination.items.map((item) => renderProductCard(item, catalog)).join("")
                : renderEmptyState({
                      icon: "fa-box-open",
                      title: "Không có sản phẩm phù hợp",
                      message: "Hãy thử thay đổi bộ lọc hoặc từ khóa tìm kiếm."
                  });

            paginationRoot.innerHTML = renderPagination({
                currentPage: localPagination.currentPage,
                totalPages: localPagination.totalPages
            });

            window.history.replaceState(
                {},
                "",
                buildUrl(ROUTES.san_pham, {
                    tu_khoa: keywordInput.value.trim() || undefined,
                    danh_muc_id: categorySelect.value || undefined,
                    thuong_hieu_id: brandSelect.value || undefined,
                    trang_thai: statusSelect.value || undefined,
                    sap_xep: sortSelect.value || undefined,
                    trang: localPagination.currentPage !== 1 ? localPagination.currentPage : undefined
                })
            );
        };

        filtersForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await renderPage(1);
        });

        document.getElementById("reset-filters-btn")?.addEventListener("click", async () => {
            filtersForm.reset();
            sortSelect.value = "ngay_tao_desc";
            await renderPage(1);
        });

        keywordInput.addEventListener(
            "input",
            debounce(async () => {
                await renderPage(1);
            }, 350)
        );

        [categorySelect, brandSelect, statusSelect, sortSelect].forEach((field) => {
            field.addEventListener("change", async () => {
                await renderPage(1);
            });
        });

        paginationRoot.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-page]");
            if (!button) {
                return;
            }

            await renderPage(Number(button.dataset.page));
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

        await renderPage(currentPage);
    } catch (error) {
        gridRoot.innerHTML = renderEmptyState({
            icon: "fa-triangle-exclamation",
            title: "Không thể tải danh sách sản phẩm",
            message: error.message || "Vui lòng kiểm tra API và thử lại."
        });
    }
});
