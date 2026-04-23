import { diaChiGiaoHangApi, donHangApi, taiKhoanApi } from "./api.js";
import { getCurrentAccount, updateCurrentAccount } from "./auth.js";
import {
    escapeHtml,
    formatCurrency,
    formatDateTime,
    initializeLayout,
    renderEmptyState,
    renderPageHero,
    renderStatus,
    ROUTES,
    showToast
} from "./helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const pageRoot = document.getElementById("account-page");
    const summaryRoot = document.getElementById("account-summary");
    const addressListRoot = document.getElementById("account-address-list");
    const ordersPreviewRoot = document.getElementById("account-order-preview");
    const profileForm = document.getElementById("account-profile-form");
    const passwordForm = document.getElementById("account-password-form");
    const addressForm = document.getElementById("account-address-form");

    const { currentAccount, adminArea } = await initializeLayout({ currentPage: "tai-khoan", area: "user" });

    if (!currentAccount) {
        pageRoot.innerHTML = `
            ${renderPageHero({
                title: "Tài khoản",
                subtitle: "Bạn cần đăng nhập để xem và cập nhật thông tin tài khoản.",
                breadcrumbs: [
                    { label: "Trang chủ", url: ROUTES.home },
                    { label: "Tài khoản" }
                ]
            })}
            ${renderEmptyState({
                icon: "fa-user",
                title: "Bạn chưa đăng nhập",
                message: "Thông tin tài khoản và địa chỉ giao hàng sẽ đồng bộ theo người dùng hiện tại.",
                actionLabel: "Đăng nhập",
                actionHref: `${ROUTES.login}?redirect=${encodeURIComponent(window.location.href)}`
            })}
        `;
        return;
    }

    if (adminArea) {
        window.location.href = ROUTES.admin_dashboard;
        return;
    }

    const freshAccount = await getCurrentAccount();
    const [diaChiResponse, donHangResponse] = await Promise.all([
        diaChiGiaoHangApi.listByCustomer(currentAccount.id),
        donHangApi.listByCustomer(currentAccount.id)
    ]);

    let addressEditingId = 0;
    let addresses = diaChiResponse.items;
    const recentOrders = donHangResponse.items
        .filter((item) => Number(item.tai_khoan_id) === Number(currentAccount.id))
        .sort((a, b) => new Date(b.ngay_dat || 0) - new Date(a.ngay_dat || 0));

    const renderAccount = () => {
        const totalSpent = recentOrders.reduce((sum, item) => sum + Number(item.tong_thanh_toan || 0), 0);

        summaryRoot.innerHTML = `
            <div class="profile-summary">
                <div class="summary-icon mb-3"><i class="fa-regular fa-user"></i></div>
                <h2 class="h4 fw-bold mb-2">${escapeHtml(freshAccount.ho_ten || "Tài khoản")}</h2>
                <p class="text-muted mb-3">${escapeHtml(freshAccount.email || "")}</p>
                <div class="d-grid gap-3">
                    <div class="info-card p-3">
                        <div class="text-muted small mb-1">Tên đăng nhập</div>
                        <div class="fw-bold">${escapeHtml(freshAccount.ten_dang_nhap || "")}</div>
                    </div>
                    <div class="info-card p-3">
                        <div class="text-muted small mb-1">Trạng thái</div>
                        <div>${renderStatus("trang_thai_tai_khoan", freshAccount.trang_thai)}</div>
                    </div>
                    <div class="info-card p-3">
                        <div class="text-muted small mb-1">Tổng chi tiêu</div>
                        <div class="fw-bold">${formatCurrency(totalSpent)}</div>
                    </div>
                    <div class="info-card p-3">
                        <div class="text-muted small mb-1">Ngày cập nhật</div>
                        <div class="fw-bold">${formatDateTime(freshAccount.ngay_cap_nhat)}</div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById("account-ho-ten").value = freshAccount.ho_ten || "";
        document.getElementById("account-email").value = freshAccount.email || "";
        document.getElementById("account-ten-dang-nhap").value = freshAccount.ten_dang_nhap || "";
        document.getElementById("account-so-dien-thoai").value = freshAccount.so_dien_thoai || "";
        document.getElementById("account-gioi-tinh").value = freshAccount.gioi_tinh || "";
        document.getElementById("account-ngay-sinh").value = freshAccount.ngay_sinh || "";

        addressListRoot.innerHTML = addresses.length
            ? addresses
                  .map(
                      (item) => `
                        <div class="address-card">
                            <div class="d-flex flex-wrap justify-content-between gap-2 mb-2">
                                <strong>${escapeHtml(item.ten_nguoi_nhan)}</strong>
                                ${item.la_mac_dinh ? '<span class="status-pill info">Mặc định</span>' : ""}
                            </div>
                            <div class="small text-muted mb-2">${escapeHtml(item.so_dien_thoai || "")}</div>
                            <div class="mb-3">${escapeHtml(item.dia_chi || "")}</div>
                            <button class="btn btn-outline-primary btn-sm" type="button" data-edit-address="${item.id}">Chỉnh sửa</button>
                        </div>
                    `
                  )
                  .join("")
            : renderEmptyState({
                  icon: "fa-location-dot",
                  title: "Chưa có địa chỉ giao hàng",
                  message: "Bạn có thể thêm địa chỉ mới ngay bên dưới."
              });

        ordersPreviewRoot.innerHTML = recentOrders.length
            ? recentOrders
                  .slice(0, 3)
                  .map(
                      (item) => `
                        <a class="order-card d-block" href="${ROUTES.don_hang}?id=${item.id}">
                            <div class="d-flex flex-wrap justify-content-between gap-3 mb-2">
                                <strong>${escapeHtml(item.ma_don_hang || `Đơn #${item.id}`)}</strong>
                                ${renderStatus("trang_thai_don_hang", item.trang_thai)}
                            </div>
                            <div class="small text-muted mb-2">${formatDateTime(item.ngay_dat)}</div>
                            <div class="fw-bold">${formatCurrency(item.tong_thanh_toan)}</div>
                        </a>
                    `
                  )
                  .join("")
            : renderEmptyState({
                  icon: "fa-receipt",
                  title: "Chưa có đơn hàng gần đây",
                  message: "Đơn hàng mới sẽ xuất hiện tại đây sau khi thanh toán."
              });
    };

    renderAccount();

    profileForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const updated = await updateCurrentAccount(currentAccount.id, {
                ho_ten: document.getElementById("account-ho-ten").value.trim(),
                so_dien_thoai: document.getElementById("account-so-dien-thoai").value.trim(),
                gioi_tinh: document.getElementById("account-gioi-tinh").value,
                ngay_sinh: document.getElementById("account-ngay-sinh").value
            });

            Object.assign(freshAccount, updated);
            renderAccount();
            showToast("Cập nhật thông tin tài khoản thành công.");
        } catch (error) {
            showToast(error.message || "Không thể cập nhật tài khoản.", "danger");
        }
    });

    passwordForm?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const oldPasswordInput = document.getElementById("account-old-password");
        const newPasswordInput = document.getElementById("account-new-password");
        const confirmPasswordInput = document.getElementById("account-confirm-password");

        const oldPassword = oldPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            showToast("Vui lòng nhập đầy đủ thông tin đổi mật khẩu.", "warning");
            return;
        }

        if (newPassword !== confirmPassword) {
            showToast("Xác nhận mật khẩu mới không khớp.", "warning");
            confirmPasswordInput.focus();
            return;
        }

        try {
            await taiKhoanApi.changePassword({
                id: Number(currentAccount.id),
                oldpass: oldPassword,
                newpass: newPassword,
                confirmpass: confirmPassword
            });

            passwordForm.reset();
            showToast("Đổi mật khẩu thành công.");
        } catch (error) {
            showToast(error.message || "Không thể đổi mật khẩu.", "danger");
        }
    });

    addressListRoot.addEventListener("click", (event) => {
        const button = event.target.closest("[data-edit-address]");
        if (!button) {
            return;
        }

        const record = addresses.find((item) => Number(item.id) === Number(button.dataset.editAddress));
        if (!record) {
            return;
        }

        addressEditingId = record.id;
        document.getElementById("address-ten-nguoi-nhan").value = record.ten_nguoi_nhan || "";
        document.getElementById("address-so-dien-thoai").value = record.so_dien_thoai || "";
        document.getElementById("address-dia-chi").value = record.dia_chi || "";
        document.getElementById("address-la-mac-dinh").checked = Boolean(record.la_mac_dinh);
    });

    document.getElementById("address-reset-btn")?.addEventListener("click", () => {
        addressEditingId = 0;
        addressForm.reset();
    });

    addressForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const payload = {
            tai_khoan_id: currentAccount.id,
            ten_nguoi_nhan: document.getElementById("address-ten-nguoi-nhan").value.trim(),
            so_dien_thoai: document.getElementById("address-so-dien-thoai").value.trim(),
            dia_chi: document.getElementById("address-dia-chi").value.trim(),
            la_mac_dinh: document.getElementById("address-la-mac-dinh").checked
        };

        try {
            if (payload.la_mac_dinh) {
                await Promise.all(
                    addresses
                        .filter((item) => item.la_mac_dinh && Number(item.id) !== Number(addressEditingId))
                        .map((item) =>
                            diaChiGiaoHangApi.update(item.id, {
                                ...item,
                                la_mac_dinh: false
                            })
                        )
                );
            }

            if (addressEditingId) {
                await diaChiGiaoHangApi.update(addressEditingId, payload);
            } else {
                await diaChiGiaoHangApi.create(payload);
            }

            addresses = (await diaChiGiaoHangApi.listByCustomer(currentAccount.id)).items;
            addressEditingId = 0;
            addressForm.reset();
            renderAccount();
            showToast("Lưu địa chỉ giao hàng thành công.");
        } catch (error) {
            showToast(error.message || "Không thể lưu địa chỉ.", "danger");
        }
    });
});
