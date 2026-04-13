import { taiKhoanApi, vaiTroApi } from "../api.js";
import {
    ensureAdminPage,
    formatDateTime,
    initializeLayout,
    renderEmptyState,
    renderLoadingState,
    renderStatus,
    showToast
} from "../helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-tai-khoan", area: "admin" });

    const tableRoot = document.getElementById("admin-accounts-table");
    const searchInput = document.getElementById("admin-account-search");
    let accounts = [];
    let roles = [];

    const renderAccounts = () => {
        const keyword = (searchInput.value || "").trim().toLowerCase();
        const roleMap = new Map(roles.map((item) => [Number(item.id), item]));
        const filtered = accounts.filter((item) => {
            const target = [item.ho_ten, item.email, item.ten_dang_nhap].filter(Boolean).join(" ").toLowerCase();
            return !keyword || target.includes(keyword);
        });

        tableRoot.innerHTML = filtered.length
            ? filtered
                  .map(
                      (item) => `
                        <tr>
                            <td>
                                <div class="fw-bold">${item.ho_ten || ""}</div>
                                <div class="small text-muted">${item.email || ""}</div>
                            </td>
                            <td>${item.ten_dang_nhap || ""}</td>
                            <td>${item.so_dien_thoai || ""}</td>
                            <td>
                                <select class="form-select form-select-sm" data-account-role="${item.id}">
                                    <option value="">Chọn vai trò</option>
                                    ${roles
                                        .map((role) => `<option value="${role.id}" ${Number(role.id) === Number(item.vai_tro_id) ? "selected" : ""}>${role.ten}</option>`)
                                        .join("")}
                                </select>
                            </td>
                            <td>
                                <select class="form-select form-select-sm" data-account-status="${item.id}">
                                    <option value="hoat_dong" ${item.trang_thai === "hoat_dong" ? "selected" : ""}>hoat_dong</option>
                                    <option value="bi_khoa" ${item.trang_thai === "bi_khoa" ? "selected" : ""}>bi_khoa</option>
                                </select>
                            </td>
                            <td>${formatDateTime(item.ngay_tao)}</td>
                            <td class="text-end">
                                <button class="btn btn-primary btn-sm" type="button" data-save-account="${item.id}">
                                    Lưu
                                </button>
                            </td>
                        </tr>
                    `
                  )
                  .join("")
            : `<tr><td colspan="7">${renderEmptyState({
                  icon: "fa-users",
                  title: "Không có tài khoản phù hợp",
                  message: "Hãy thử lại với từ khóa khác."
              })}</td></tr>`;
    };

    const loadData = async () => {
        tableRoot.innerHTML = `<tr><td colspan="7">${renderLoadingState("Đang tải tài khoản...")}</td></tr>`;
        const [accountResponse, roleResponse] = await Promise.all([taiKhoanApi.list(), vaiTroApi.list()]);
        accounts = accountResponse.items;
        roles = roleResponse.items;
        renderAccounts();
    };

    searchInput.addEventListener("input", renderAccounts);

    tableRoot.addEventListener("click", async (event) => {
        const saveButton = event.target.closest("[data-save-account]");
        if (!saveButton) {
            return;
        }

        const accountId = Number(saveButton.dataset.saveAccount);
        const record = accounts.find((item) => Number(item.id) === accountId);
        if (!record) {
            return;
        }

        try {
            await taiKhoanApi.update(accountId, {
                ...record,
                vai_tro_id: Number(tableRoot.querySelector(`[data-account-role="${accountId}"]`).value || 0) || null,
                trang_thai: tableRoot.querySelector(`[data-account-status="${accountId}"]`).value
            });
            showToast("Đã cập nhật tài khoản.");
            await loadData();
        } catch (error) {
            showToast(error.message || "Không thể cập nhật tài khoản.", "danger");
        }
    });

    await loadData();
});
