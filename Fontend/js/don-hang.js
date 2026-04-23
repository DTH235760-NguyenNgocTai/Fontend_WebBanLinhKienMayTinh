import { chiTietDonHangApi, diaChiGiaoHangApi, donHangApi, sanPhamApi, thanhToanApi } from "./api.js";
import {
    escapeHtml,
    formatCurrency,
    formatDateTime,
    formatPaymentMethod,
    getProductMainImage,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderPageHero,
    renderStatus,
    ROUTES
} from "./helpers.js";

function getTimelineMarkup(trangThai) {
    const steps = [
        { key: "cho_xac_nhan", label: "Chờ xác nhận" },
        { key: "dang_xu_ly", label: "Đang xử lý" },
        { key: "dang_giao", label: "Đang giao" },
        { key: "hoan_thanh", label: "Hoàn thành" }
    ];
    const currentIndex = Math.max(steps.findIndex((step) => step.key === trangThai), 0);

    return `
        <div class="timeline">
            ${steps
                .map(
                    (step, index) => `
                        <div class="timeline-step ${index <= currentIndex ? "is-active" : ""}">
                            <div class="fw-bold mb-1">${step.label}</div>
                            <div class="text-muted small">Trạng thái hiện tại của đơn hàng.</div>
                        </div>
                    `
                )
                .join("")}
            ${trangThai === "da_huy" ? `
                <div class="timeline-step is-cancelled">
                    <div class="fw-bold mb-1">Đã hủy</div>
                    <div class="text-muted small">Đơn hàng đã được hủy.</div>
                </div>
            ` : ""}
        </div>
    `;
}

function getOrderShippingAddress(order, fallbackAddress = null) {
    const nestedAddress =
        typeof order?.dia_chi_giao_hang === "object" && order?.dia_chi_giao_hang
            ? order.dia_chi_giao_hang.dia_chi || ""
            : "";

    return (
        order?.dia_chi ||
        nestedAddress ||
        fallbackAddress?.dia_chi ||
        "Địa chỉ giao hàng sẽ được cập nhật khi đơn hàng có đầy đủ thông tin."
    );
}

function getPaymentMethodLabel(payment, order = null) {
    return formatPaymentMethod(
        payment?.phuong_thuc_thanh_toan ||
        payment?.phuong_thuc ||
        order?.phuong_thuc_thanh_toan ||
        order?.phuong_thuc ||
        "Chưa cập nhật"
    );
}

document.addEventListener("DOMContentLoaded", async () => {
    const pageRoot = document.getElementById("orders-page");
    const ordersRoot = document.getElementById("orders-list");

    ordersRoot.innerHTML = renderLoadingState("Đang tải đơn hàng...");

    const { currentAccount, adminArea } = await initializeLayout({ currentPage: "don-hang", area: "user" });

    if (!currentAccount) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Đơn hàng",
                subtitle: "Đăng nhập để theo dõi các đơn hàng của bạn.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Đơn hàng" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-receipt",
                title: "Bạn chưa đăng nhập",
                message: "Đơn hàng sẽ được đồng bộ theo tài khoản hiện tại.",
                actionLabel: "Đăng nhập",
                actionHref: `${ROUTES.login}?redirect=${encodeURIComponent(window.location.href)}`
            })}
        `;
        return;
    }

    if (adminArea) {
        window.location.href = ROUTES.admin_don_hang;
        return;
    }

    try {
        const [donHangResponse, sanPhamResponse, catalog, diaChiResponse] = await Promise.all([
            donHangApi.listByCustomer(currentAccount.id),
            sanPhamApi.listAll(),
            loadCatalogLookups(),
            diaChiGiaoHangApi.listByCustomer(currentAccount.id)
        ]);

        const selectedOrderId = Number(new URLSearchParams(window.location.search).get("id") || 0);
        const productMap = new Map(sanPhamResponse.items.map((item) => [Number(item.id), item]));
        const defaultAddress = diaChiResponse.items.find((item) => item.la_mac_dinh) || diaChiResponse.items[0] || null;
        const orders = (donHangResponse.items || [])
            .filter((item) => Number(item.tai_khoan_id) === Number(currentAccount.id))
            .sort((a, b) => new Date(b.ngay_dat || 0) - new Date(a.ngay_dat || 0));

        if (!orders.length) {
            ordersRoot.innerHTML = renderEmptyState({
                icon: "fa-receipt",
                title: "Chưa có đơn hàng nào",
                message: "Sau khi tạo đơn từ trang thanh toán, dữ liệu sẽ hiển thị tại đây.",
                actionLabel: "Mua sắm ngay",
                actionHref: ROUTES.san_pham
            });
            return;
        }

        const renderOrders = async () => {
            ordersRoot.innerHTML = renderLoadingState("Đang tải chi tiết đơn hàng...");

            const htmlParts = [];

            for (const order of orders) {
                const [chiTietResponse, thanhToanResponse] = await Promise.all([
                    chiTietDonHangApi.listByOrder(order.id),
                    thanhToanApi.listByOrder(order.id)
                ]);

                const details = chiTietResponse.items.map((detail) => ({
                    ...detail,
                    san_pham: productMap.get(Number(detail.san_pham_id))
                }));
                const payment = thanhToanResponse.items[0] || null;
                const isOpen = selectedOrderId ? Number(order.id) === selectedOrderId : false;

                htmlParts.push(`
                    <article class="order-card">
                        <div class="d-flex flex-wrap justify-content-between gap-3 mb-3">
                            <div>
                                <div class="small-caps mb-2">${order.ma_don_hang || `Đơn #${order.id}`}</div>
                                <h2 class="h5 fw-bold mb-1">${details.length} sản phẩm</h2>
                                <div class="text-muted">${formatDateTime(order.ngay_dat)}</div>
                            </div>
                            <div>${renderStatus("trang_thai_don_hang", order.trang_thai)}</div>
                        </div>
                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
                            <div>
                                <div class="text-muted small">Người nhận: ${order.nguoi_nhan || currentAccount.ho_ten}</div>
                                <strong>Tổng thanh toán: ${formatCurrency(order.tong_thanh_toan)}</strong>
                            </div>
                            <button class="btn btn-outline-primary" type="button" data-order-toggle="${order.id}">
                                ${isOpen ? "Ẩn chi tiết" : "Xem chi tiết"}
                            </button>
                        </div>
                        <div class="${isOpen ? "" : "d-none"}" id="order-detail-${order.id}">
                            <div class="row g-4">
                                <div class="col-lg-7">
                                    <div class="order-items-list mb-4">
                                        ${details
                                            .map((detail) => {
                                                const productImage = getProductMainImage(detail.san_pham, catalog.hinhAnhMap);

                                                return `
                                                    <div class="mini-product">
                                                        <div class="mini-product-thumb mini-product-thumb-compact">
                                                            <img src="${escapeHtml(productImage)}" alt="${escapeHtml(detail.san_pham?.ten || "Sản phẩm")}">
                                                        </div>
                                                        <div class="flex-grow-1">
                                                            <div class="fw-bold">${escapeHtml(detail.san_pham?.ten || "Sản phẩm")}</div>
                                                            <div class="small text-muted">SL: ${detail.so_luong}</div>
                                                        </div>
                                                        <div class="fw-bold">${formatCurrency(detail.thanh_tien)}</div>
                                                    </div>
                                                `;
                                            })
                                            .join("")}
                                    </div>
                                    ${getTimelineMarkup(order.trang_thai)}
                                </div>
                                <div class="col-lg-5">
                                    <div class="order-summary mb-3">
                                        <div class="fw-bold mb-3">Thông tin giao hàng</div>
                                        <div class="small text-muted mb-1">Người nhận</div>
                                        <div class="mb-2">${order.nguoi_nhan || currentAccount.ho_ten}</div>
                                        <div class="small text-muted mb-1">Số điện thoại</div>
                                        <div class="mb-2">${order.so_dien_thoai || currentAccount.so_dien_thoai || ""}</div>
                                        <div class="small text-muted mb-1">Địa chỉ đang hiển thị</div>
                                        <div>${getOrderShippingAddress(order, defaultAddress)}</div>
                                    </div>
                                    <div class="order-summary">
                                        <div class="fw-bold mb-3">Thanh toán</div>
                                        <div class="d-flex justify-content-between mb-2">
                                            <span class="text-muted">Phương thức</span>
                                            <strong class="text-end">${escapeHtml(getPaymentMethodLabel(payment, order))}</strong>
                                        </div>
                                        <div class="d-flex justify-content-between mb-2">
                                            <span class="text-muted">Trạng thái</span>
                                            <span>${payment ? renderStatus("trang_thai_thanh_toan", payment.trang_thai) : "Chưa cập nhật"}</span>
                                        </div>
                                        <div class="d-flex justify-content-between">
                                            <span class="text-muted">Tổng cộng</span>
                                            <strong>${formatCurrency(order.tong_thanh_toan)}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </article>
                `);
            }

            ordersRoot.innerHTML = htmlParts.join("");
        };

        ordersRoot.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-order-toggle]");
            if (!button) {
                return;
            }

            const orderId = Number(button.dataset.orderToggle);
            const nextParams = new URLSearchParams(window.location.search);

            if (Number(nextParams.get("id") || 0) === orderId) {
                nextParams.delete("id");
            } else {
                nextParams.set("id", orderId);
            }

            window.history.replaceState({}, "", `${ROUTES.don_hang}${nextParams.toString() ? `?${nextParams.toString()}` : ""}`);
            window.location.reload();
        });

        await renderOrders();
    } catch (error) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Đơn hàng",
                subtitle: "Không thể tải danh sách đơn hàng lúc này.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Đơn hàng" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-triangle-exclamation",
                title: "Không thể tải đơn hàng",
                message: error.message || "Vui lòng thử lại sau."
            })}
        `;
    }
});
