import { danhMucApi, donHangApi, sanPhamApi, taiKhoanApi, thuongHieuApi } from "../api.js";
import {
    ensureAdminPage,
    formatCurrency,
    formatDateTime,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderStatus
} from "../helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-dashboard", area: "admin" });

    const statsRoot = document.getElementById("admin-dashboard-stats");
    const latestOrdersRoot = document.getElementById("admin-dashboard-orders");
    const latestProductsRoot = document.getElementById("admin-dashboard-products");

    try {
        const [sanPhamResponse, donHangResponse, danhMucResponse, thuongHieuResponse, taiKhoanResponse, catalog] = await Promise.all([
            sanPhamApi.listAll(),
            donHangApi.list(),
            danhMucApi.list(),
            thuongHieuApi.list(),
            taiKhoanApi.list(),
            loadCatalogLookups()
        ]);

        const sanPhamItems = sanPhamResponse.items;
        const donHangItems = donHangResponse.items;
        const pendingOrders = donHangItems.filter((item) => ["cho_xac_nhan", "dang_xu_ly"].includes(item.trang_thai));
        const revenue = donHangItems
            .filter((item) => item.trang_thai === "hoan_thanh")
            .reduce((sum, item) => sum + Number(item.tong_thanh_toan || 0), 0);

        statsRoot.innerHTML = `
            <div class="stats-card">
                <div class="text-muted small mb-2">Sản phẩm</div>
                <div class="h3 fw-bold mb-1">${sanPhamItems.length}</div>
                <div class="small text-muted">${danhMucResponse.items.length} danh mục / ${thuongHieuResponse.items.length} thương hiệu</div>
            </div>
            <div class="stats-card">
                <div class="text-muted small mb-2">Đơn đang xử lý</div>
                <div class="h3 fw-bold mb-1">${pendingOrders.length}</div>
                <div class="small text-muted">Chờ xác nhận hoặc đang xử lý</div>
            </div>
            <div class="stats-card">
                <div class="text-muted small mb-2">Tài khoản</div>
                <div class="h3 fw-bold mb-1">${taiKhoanResponse.items.length}</div>
                <div class="small text-muted">Đọc từ bảng tai_khoan</div>
            </div>
            <div class="stats-card">
                <div class="text-muted small mb-2">Doanh thu hoàn thành</div>
                <div class="h3 fw-bold mb-1">${formatCurrency(revenue)}</div>
                <div class="small text-muted">Tính trên đơn hoàn thành</div>
            </div>
        `;

        latestOrdersRoot.innerHTML = donHangItems.length
            ? donHangItems
                  .sort((a, b) => new Date(b.ngay_dat || 0) - new Date(a.ngay_dat || 0))
                  .slice(0, 5)
                  .map(
                      (item) => `
                        <div class="admin-list-card">
                            <div class="d-flex flex-wrap justify-content-between gap-3 mb-2">
                                <div>
                                    <div class="fw-bold">${item.ma_don_hang || `Đơn #${item.id}`}</div>
                                    <div class="small text-muted">${formatDateTime(item.ngay_dat)}</div>
                                </div>
                                <div>${renderStatus("trang_thai_don_hang", item.trang_thai)}</div>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span class="text-muted">Tổng thanh toán</span>
                                <strong>${formatCurrency(item.tong_thanh_toan)}</strong>
                            </div>
                        </div>
                    `
                  )
                  .join("")
            : renderEmptyState({
                  icon: "fa-receipt",
                  title: "Chưa có đơn hàng",
                  message: "Danh sách đơn hàng sẽ hiển thị tại đây khi có dữ liệu."
              });

        latestProductsRoot.innerHTML = sanPhamItems.length
            ? sanPhamItems
                  .slice(0, 5)
                  .map(
                      (item) => `
                        <div class="admin-list-card">
                            <div class="mini-product">
                                <div class="mini-product-thumb">
                                    <img src="${catalog.hinhAnhMap.get(Number(item.id))?.[0]?.duong_dan || ""}" alt="${item.ten}">
                                </div>
                                <div class="flex-grow-1">
                                    <div class="fw-bold">${item.ten}</div>
                                    <div class="small text-muted">${item.ma_san_pham || "N/A"}</div>
                                </div>
                                <div>
                                    <div class="fw-bold">${formatCurrency(item.gia_giam || item.gia_ban)}</div>
                                    <div class="small">${renderStatus("trang_thai_san_pham", item.trang_thai)}</div>
                                </div>
                            </div>
                        </div>
                    `
                  )
                  .join("")
            : renderEmptyState({
                  icon: "fa-box-open",
                  title: "Chưa có sản phẩm",
                  message: "Danh sách sản phẩm sẽ hiển thị tại đây khi có dữ liệu."
              });
    } catch (error) {
        statsRoot.innerHTML = renderEmptyState({
            icon: "fa-triangle-exclamation",
            title: "Không thể tải dashboard",
            message: "Không thể tải dữ liệu dashboard lúc này. Vui lòng thử lại sau."
        });
        latestOrdersRoot.innerHTML = "";
        latestProductsRoot.innerHTML = "";
    }
});
