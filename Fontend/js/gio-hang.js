import { gioHangApi, sanPhamApi } from "./api.js";
import {
    buildUrl,
    escapeHtml,
    formatCurrency,
    getProductCurrentPrice,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderPageHero,
    ROUTES,
    setCartBadgeCount
} from "./helpers.js";

function calculateCartSummary(items = []) {
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.so_luong || 0), 0);
    const totalAmount = items.reduce((sum, item) => sum + Number(item.thanh_tien || 0), 0);

    return {
        totalQuantity,
        totalAmount
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    const pageRoot = document.getElementById("cart-page");
    const tableRoot = document.getElementById("cart-table-body");
    const summaryRoot = document.getElementById("cart-summary");

    tableRoot.innerHTML = `<tr><td colspan="5">${renderLoadingState("Đang tải giỏ hàng...")}</td></tr>`;

    const { currentAccount, adminArea } = await initializeLayout({ currentPage: "gio-hang", area: "user" });

    if (!currentAccount) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Giỏ hàng",
                subtitle: "Đăng nhập để xem và quản lý giỏ hàng của bạn.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Giỏ hàng" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-cart-shopping",
                title: "Bạn chưa đăng nhập",
                message: "Vui lòng đăng nhập để đồng bộ giỏ hàng theo tài khoản của bạn.",
                actionLabel: "Đăng nhập",
                actionHref: buildUrl(ROUTES.login, { redirect: window.location.href })
            })}
        `;
        return;
    }

    if (adminArea) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Giỏ hàng",
                subtitle: "Khu vực này chỉ dành cho tài khoản mua hàng.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Giỏ hàng" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-user-shield",
                title: "Tài khoản quản trị không dùng giỏ hàng",
                message: "Bạn có thể quay lại khu vực quản trị để làm việc với sản phẩm và đơn hàng.",
                actionLabel: "Về quản trị",
                actionHref: ROUTES.admin_dashboard
            })}
        `;
        return;
    }

    try {
        const renderCart = async () => {
            const [cartData, sanPhamResponse, catalog] = await Promise.all([
                gioHangApi.getCurrentWithDetails({ khach_hang_id: currentAccount.id }),
                sanPhamApi.listAll(),
                loadCatalogLookups()
            ]);

            const productMap = new Map(sanPhamResponse.items.map((item) => [Number(item.id), item]));
            const items = cartData.chi_tiet_gio_hang
                .map((item) => {
                    const san_pham = productMap.get(Number(item.san_pham_id));
                    if (!san_pham) {
                        return null;
                    }

                    return {
                        ...item,
                        san_pham,
                        gia_hien_tai: Number(item.don_gia || getProductCurrentPrice(san_pham)),
                        thanh_tien: Number(item.so_luong || 0) * Number(item.don_gia || getProductCurrentPrice(san_pham))
                    };
                })
                .filter(Boolean);

            const summary = calculateCartSummary(items);

            if (!items.length) {
                tableRoot.innerHTML = `
                    <tr>
                        <td colspan="5">
                            ${renderEmptyState({
                                icon: "fa-cart-shopping",
                                title: "Giỏ hàng đang trống",
                                message: "Chọn sản phẩm từ trang danh sách để thêm vào giỏ.",
                                actionLabel: "Mua sắm ngay",
                                actionHref: ROUTES.san_pham
                            })}
                        </td>
                    </tr>
                `;
                summaryRoot.innerHTML = "";
                setCartBadgeCount(0);
                return;
            }

            tableRoot.innerHTML = items
                .map(
                    (item) => `
                        <tr>
                            <td>
                                <div class="mini-product">
                                    <div class="mini-product-thumb">
                                        <img src="${escapeHtml(catalog.hinhAnhMap.get(Number(item.san_pham.id))?.[0]?.duong_dan || "")}" alt="${escapeHtml(item.san_pham.ten)}">
                                    </div>
                                    <div>
                                        <a class="fw-bold d-block mb-1" href="${buildUrl(ROUTES.chi_tiet_san_pham, { id: item.san_pham.id })}">
                                            ${escapeHtml(item.san_pham.ten)}
                                        </a>
                                        <div class="text-muted small">Mã: ${escapeHtml(item.san_pham.ma_san_pham || "N/A")}</div>
                                        <div class="text-muted small">Tồn kho: ${Number(item.san_pham.so_luong_ton || 0)}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${formatCurrency(item.gia_hien_tai)}</td>
                            <td>
                                <div class="quantity-control">
                                    <button type="button" data-cart-action="decrease" data-item-id="${item.id}">-</button>
                                    <input type="text" readonly value="${Number(item.so_luong || 0)}">
                                    <button type="button" data-cart-action="increase" data-item-id="${item.id}" ${Number(item.so_luong || 0) >= Number(item.san_pham.so_luong_ton || 0) ? "disabled" : ""}>+</button>
                                </div>
                            </td>
                            <td class="fw-bold">${formatCurrency(item.thanh_tien)}</td>
                            <td class="text-end">
                                <button class="btn btn-link text-danger p-0" type="button" data-cart-action="remove" data-item-id="${item.id}">
                                    Xóa
                                </button>
                            </td>
                        </tr>
                    `
                )
                .join("");

            setCartBadgeCount(summary.totalQuantity);

            summaryRoot.innerHTML = `
                <div class="cart-summary">
                    <h3 class="h5 fw-bold mb-4">Tóm tắt đơn hàng</h3>
                    <div class="d-flex justify-content-between mb-3">
                        <span class="text-muted">Số lượng</span>
                        <strong>${summary.totalQuantity}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-3">
                        <span class="text-muted">Tạm tính</span>
                        <strong>${formatCurrency(summary.totalAmount)}</strong>
                    </div>
                    <div class="d-flex justify-content-between mb-4">
                        <span class="text-muted">Phí vận chuyển</span>
                        <strong>${formatCurrency(0)}</strong>
                    </div>
                    <hr>
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <span class="fw-bold">Tổng cộng</span>
                        <span class="h4 mb-0 text-primary">${formatCurrency(summary.totalAmount)}</span>
                    </div>
                    <a class="btn btn-primary w-100" href="${ROUTES.thanh_toan}">Tiến hành thanh toán</a>
                </div>
            `;

            tableRoot.onclick = async (event) => {
                const button = event.target.closest("[data-cart-action]");
                if (!button) {
                    return;
                }

                const item = items.find((entry) => Number(entry.id) === Number(button.dataset.itemId));
                if (!item) {
                    return;
                }

                if (button.dataset.cartAction === "remove") {
                    await gioHangApi.removeItem(item.id);
                    await renderCart();
                    return;
                }

                const nextQuantity =
                    button.dataset.cartAction === "increase"
                        ? Number(item.so_luong || 0) + 1
                        : Number(item.so_luong || 0) - 1;

                if (nextQuantity <= 0) {
                    await gioHangApi.removeItem(item.id);
                    await renderCart();
                    return;
                }

                await gioHangApi.updateItem(item.id, {
                    gio_hang_id: cartData.gio_hang.id,
                    san_pham_id: item.san_pham_id,
                    so_luong: nextQuantity,
                    don_gia: item.don_gia
                });

                await renderCart();
            };
        };

        await renderCart();
    } catch (error) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Giỏ hàng",
                subtitle: "Không thể tải dữ liệu giỏ hàng lúc này.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Giỏ hàng" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-triangle-exclamation",
                title: "Không thể tải giỏ hàng",
                message: error.message || "Vui lòng thử lại sau."
            })}
        `;
    }
});
