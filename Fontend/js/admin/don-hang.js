import { chiTietDonHangApi, donHangApi, sanPhamApi, thanhToanApi } from "../api.js";
import {
    ensureAdminPage,
    formatCurrency,
    formatDateTime,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderStatus,
    showToast
} from "../helpers.js";

const orderStatuses = ["cho_xac_nhan", "dang_xu_ly", "dang_giao", "hoan_thanh", "da_huy"];

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-don-hang", area: "admin" });

    const tableRoot = document.getElementById("admin-orders-table");
    const detailRoot = document.getElementById("admin-order-detail");
    const searchInput = document.getElementById("admin-order-search");
    let orders = [];
    let selectedOrderId = 0;
    let productMap = new Map();
    let catalog;

    const renderOrderDetail = async () => {
        if (!selectedOrderId) {
            detailRoot.innerHTML = renderEmptyState({
                icon: "fa-receipt",
                title: "Chọn một đơn hàng",
                message: "Chi tiết đơn sẽ hiển thị tại đây."
            });
            return;
        }

        const order = orders.find((item) => Number(item.id) === Number(selectedOrderId));
        if (!order) {
            return;
        }

        detailRoot.innerHTML = renderLoadingState("Đang tải chi tiết đơn hàng...");

        const [chiTietResponse, thanhToanResponse] = await Promise.all([
            chiTietDonHangApi.listByOrder(order.id),
            thanhToanApi.listByOrder(order.id)
        ]);

        const payment = thanhToanResponse.items[0] || null;

        detailRoot.innerHTML = `
            <div class="section-heading">
                <div>
                    <h2 class="section-title">${order.ma_don_hang || `Đơn #${order.id}`}</h2>
                    <p class="section-subtitle">${formatDateTime(order.ngay_dat)}</p>
                </div>
                <div>${renderStatus("trang_thai_don_hang", order.trang_thai)}</div>
            </div>
            <div class="admin-list mb-4">
                ${chiTietResponse.items
                    .map((detail) => {
                        const san_pham = productMap.get(Number(detail.san_pham_id));
                        return `
                            <div class="admin-list-card">
                                <div class="mini-product">
                                    <div class="mini-product-thumb">
                                        <img src="${catalog.hinhAnhMap.get(Number(detail.san_pham_id))?.[0]?.duong_dan || ""}" alt="${san_pham?.ten || "Sản phẩm"}">
                                    </div>
                                    <div class="flex-grow-1">
                                        <div class="fw-bold">${san_pham?.ten || "Sản phẩm"}</div>
                                        <div class="small text-muted">SL: ${detail.so_luong}</div>
                                    </div>
                                    <div class="fw-bold">${formatCurrency(detail.thanh_tien)}</div>
                                </div>
                            </div>
                        `;
                    })
                    .join("")}
            </div>
            <div class="row g-4">
                <div class="col-lg-6">
                    <div class="info-card p-3 h-100">
                        <div class="text-muted small mb-1">Người nhận</div>
                        <div class="fw-bold mb-2">${order.nguoi_nhan || ""}</div>
                        <div class="text-muted small mb-1">Số điện thoại</div>
                        <div>${order.so_dien_thoai || ""}</div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="info-card p-3 h-100">
                        <div class="text-muted small mb-1">Thanh toán</div>
                        <div class="fw-bold mb-2">${payment?.phuong_thuc || "Chưa cập nhật"}</div>
                        <div>${payment ? renderStatus("trang_thai_thanh_toan", payment.trang_thai) : "Chưa có thanh toán"}</div>
                    </div>
                </div>
            </div>
        `;
    };

    const renderOrders = () => {
        const keyword = (searchInput.value || "").trim().toLowerCase();
        const filteredOrders = orders.filter((item) => {
            const searchTarget = [item.ma_don_hang, item.nguoi_nhan, item.so_dien_thoai].filter(Boolean).join(" ").toLowerCase();
            return !keyword || searchTarget.includes(keyword);
        });

        tableRoot.innerHTML = filteredOrders.length
            ? filteredOrders
                  .map(
                      (item) => `
                        <tr>
                            <td>
                                <div class="fw-bold">${item.ma_don_hang || `Đơn #${item.id}`}</div>
                                <div class="small text-muted">${formatDateTime(item.ngay_dat)}</div>
                            </td>
                            <td>${item.nguoi_nhan || ""}</td>
                            <td>${formatCurrency(item.tong_thanh_toan)}</td>
                            <td>${renderStatus("trang_thai_don_hang", item.trang_thai)}</td>
                            <td>
                                <select class="form-select form-select-sm" data-order-status="${item.id}">
                                    ${orderStatuses
                                        .map((status) => `<option value="${status}" ${status === item.trang_thai ? "selected" : ""}>${status}</option>`)
                                        .join("")}
                                </select>
                            </td>
                            <td class="text-end">
                                <div class="d-flex justify-content-end gap-2">
                                    <button class="btn btn-outline-primary btn-sm" type="button" data-view-order="${item.id}">Chi tiết</button>
                                    <button class="btn btn-primary btn-sm" type="button" data-save-order="${item.id}">Lưu</button>
                                </div>
                            </td>
                        </tr>
                    `
                  )
                  .join("")
            : `<tr><td colspan="6">${renderEmptyState({
                  icon: "fa-receipt",
                  title: "Không có đơn hàng phù hợp",
                  message: "Hãy thử lại với từ khóa khác."
              })}</td></tr>`;
    };

    const loadOrders = async () => {
        tableRoot.innerHTML = `<tr><td colspan="6">${renderLoadingState("Đang tải đơn hàng...")}</td></tr>`;
        const [orderResponse, sanPhamResponse, lookups] = await Promise.all([
            donHangApi.list(),
            sanPhamApi.listAll(),
            loadCatalogLookups()
        ]);
        orders = orderResponse.items.sort((a, b) => new Date(b.ngay_dat || 0) - new Date(a.ngay_dat || 0));
        productMap = new Map(sanPhamResponse.items.map((item) => [Number(item.id), item]));
        catalog = lookups;
        selectedOrderId = selectedOrderId || orders[0]?.id || 0;
        renderOrders();
        await renderOrderDetail();
    };

    searchInput.addEventListener("input", renderOrders);

    tableRoot.addEventListener("click", async (event) => {
        const viewButton = event.target.closest("[data-view-order]");
        const saveButton = event.target.closest("[data-save-order]");

        if (viewButton) {
            selectedOrderId = Number(viewButton.dataset.viewOrder);
            await renderOrderDetail();
        }

        if (saveButton) {
            const orderId = Number(saveButton.dataset.saveOrder);
            const select = tableRoot.querySelector(`[data-order-status="${orderId}"]`);
            try {
                await donHangApi.update(orderId, {
                    trang_thai: select.value
                });
                showToast("Cập nhật trạng thái đơn hàng thành công.");
                await loadOrders();
            } catch (error) {
                showToast(error.message || "Không thể cập nhật đơn hàng.", "danger");
            }
        }
    });

    await loadOrders();
});
