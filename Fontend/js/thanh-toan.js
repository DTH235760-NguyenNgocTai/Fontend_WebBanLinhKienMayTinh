import {
    chiTietDonHangApi,
    diaChiGiaoHangApi,
    donHangApi,
    gioHangApi,
    sanPhamApi,
    thanhToanApi
} from "./api.js";
import {
    formatCurrency,
    getProductCurrentPrice,
    initializeLayout,
    renderEmptyState,
    renderLoadingState,
    renderPageHero,
    ROUTES,
    showToast
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const pageRoot = document.getElementById("checkout-page");
    const form = document.getElementById("checkout-form");
    const summaryRoot = document.getElementById("checkout-summary-items");
    const totalRoot = document.getElementById("checkout-total");
    const addressSelect = document.getElementById("checkout-address-select");

    summaryRoot.innerHTML = renderLoadingState("Đang chuẩn bị dữ liệu thanh toán...");

    const { currentAccount, adminArea } = await initializeLayout({ currentPage: "thanh-toan", area: "user" });

    if (!currentAccount) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Thanh toán",
                subtitle: "Bạn cần đăng nhập để tạo đơn hàng thật từ API.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Thanh toán" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-credit-card",
                title: "Bạn chưa đăng nhập",
                message: "Luồng thanh toán dùng dữ liệu người dùng thật nên cần đăng nhập trước.",
                actionLabel: "Đăng nhập",
                actionHref: `${ROUTES.login}?redirect=${encodeURIComponent(window.location.href)}`
            })}
        `;
        return;
    }

    if (adminArea) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Thanh toán",
                subtitle: "Khu vực này chỉ dành cho tài khoản mua hàng.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Thanh toán" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-user-shield",
                title: "Tài khoản quản trị không tạo đơn mua",
                message: "Bạn có thể quay lại khu vực quản trị để làm việc với sản phẩm và đơn hàng.",
                actionLabel: "Về quản trị",
                actionHref: ROUTES.admin_dashboard
            })}
        `;
        return;
    }

    try {
        const [cartData, sanPhamResponse, diaChiResponse] = await Promise.all([
            gioHangApi.getCurrentWithDetails({ khach_hang_id: currentAccount.id }),
            sanPhamApi.list(),
            diaChiGiaoHangApi.list({ khach_hang_id: currentAccount.id })
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
                    don_gia_thuc_te: Number(item.don_gia || getProductCurrentPrice(san_pham)),
                    thanh_tien: Number(item.so_luong || 0) * Number(item.don_gia || getProductCurrentPrice(san_pham))
                };
            })
            .filter(Boolean);

        if (!items.length) {
            pageRoot.innerHTML = `
                ${renderPageHero({
                    title: "Thanh toán",
                    subtitle: "Giỏ hàng đang trống nên chưa thể tạo đơn.",
                    breadcrumbs: [
                        { label: "Trang chủ", url: ROUTES.home },
                        { label: "Thanh toán" }
                    ]
                })}
                ${renderEmptyState({
                    icon: "fa-bag-shopping",
                    title: "Chưa có sản phẩm để thanh toán",
                    message: "Hãy thêm sản phẩm vào giỏ trước khi tạo đơn hàng.",
                    actionLabel: "Xem sản phẩm",
                    actionHref: ROUTES.san_pham
                })}
            `;
            return;
        }

        const tongThanhToan = items.reduce((sum, item) => sum + item.thanh_tien, 0);
        const diaChiList = diaChiResponse.items;
        let editingAddressId = Number(diaChiList.find((item) => item.la_mac_dinh)?.id || diaChiList[0]?.id || 0);

        const fillAddressForm = (record) => {
            document.getElementById("checkout-ten-nguoi-nhan").value = record?.ten_nguoi_nhan || currentAccount.ho_ten || "";
            document.getElementById("checkout-so-dien-thoai").value = record?.so_dien_thoai || currentAccount.so_dien_thoai || "";
            document.getElementById("checkout-dia-chi").value = record?.dia_chi || "";
            document.getElementById("checkout-la-mac-dinh").checked = Boolean(record?.la_mac_dinh);
        };

        addressSelect.innerHTML = `
            <option value="0">Nhập địa chỉ mới</option>
            ${diaChiList
                .map(
                    (item) => `
                        <option value="${item.id}" ${Number(item.id) === editingAddressId ? "selected" : ""}>
                            ${item.ten_nguoi_nhan} - ${item.dia_chi}
                        </option>
                    `
                )
                .join("")}
        `;

        fillAddressForm(diaChiList.find((item) => Number(item.id) === editingAddressId) || null);

        summaryRoot.innerHTML = items
            .map(
                (item) => `
                    <div class="d-flex justify-content-between gap-3 mb-3">
                        <div>
                            <div class="fw-bold">${item.san_pham.ten}</div>
                            <div class="small text-muted">SL: ${item.so_luong}</div>
                        </div>
                        <div class="fw-bold">${formatCurrency(item.thanh_tien)}</div>
                    </div>
                `
            )
            .join("");

        totalRoot.textContent = formatCurrency(tongThanhToan);

        addressSelect.addEventListener("change", () => {
            editingAddressId = Number(addressSelect.value || 0);
            fillAddressForm(diaChiList.find((item) => Number(item.id) === editingAddressId) || null);
        });

        const persistAddress = async () => {
            const payload = {
                khach_hang_id: currentAccount.id,
                ten_nguoi_nhan: document.getElementById("checkout-ten-nguoi-nhan").value.trim(),
                so_dien_thoai: document.getElementById("checkout-so-dien-thoai").value.trim(),
                dia_chi: document.getElementById("checkout-dia-chi").value.trim(),
                la_mac_dinh: document.getElementById("checkout-la-mac-dinh").checked
            };

            if (payload.la_mac_dinh) {
                await Promise.all(
                    diaChiList
                        .filter((item) => item.la_mac_dinh && Number(item.id) !== editingAddressId)
                        .map((item) =>
                            diaChiGiaoHangApi.update(item.id, {
                                ...item,
                                la_mac_dinh: false
                            })
                        )
                );
            }

            if (editingAddressId) {
                return diaChiGiaoHangApi.update(editingAddressId, payload);
            }

            return diaChiGiaoHangApi.create(payload);
        };

        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            try {
                const diaChiRecord = await persistAddress();
                const don_hang = await donHangApi.create({
                    khach_hang_id: currentAccount.id,
                    trang_thai: "cho_xac_nhan",
                    nguoi_nhan: diaChiRecord.ten_nguoi_nhan,
                    so_dien_thoai: diaChiRecord.so_dien_thoai,
                    phi_van_chuyen: 0,
                    tien_giam: 0,
                    tong_thanh_toan: tongThanhToan,
                    ghi_chu: document.getElementById("checkout-ghi-chu").value.trim()
                });

                await Promise.all(
                    items.map((item) =>
                        chiTietDonHangApi.create({
                            don_hang_id: don_hang.id,
                            san_pham_id: item.san_pham_id,
                            so_luong: item.so_luong,
                            don_gia: item.don_gia_thuc_te,
                            thanh_tien: item.thanh_tien
                        })
                    )
                );

                await thanhToanApi.create({
                    don_hang_id: don_hang.id,
                    phuong_thuc: document.getElementById("checkout-phuong-thuc").value.trim(),
                    so_tien: tongThanhToan,
                    trang_thai: "chua_thanh_toan",
                    ma_giao_dich: ""
                });

                await Promise.all(items.map((item) => gioHangApi.removeItem(item.id)));

                showToast("Đã tạo đơn hàng thành công.");
                setTimeout(() => {
                    window.location.href = `${ROUTES.don_hang}?id=${don_hang.id}`;
                }, 300);
            } catch (error) {
                showToast(error.message || "Không thể tạo đơn hàng.", "danger");
            }
        });
    } catch (error) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Thanh toán",
                subtitle: "Có lỗi khi tải dữ liệu checkout.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Thanh toán" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-triangle-exclamation",
                title: "Không thể chuẩn bị dữ liệu thanh toán",
                message: error.message || "Vui lòng kiểm tra API và thử lại."
            })}
        `;
    }
});
