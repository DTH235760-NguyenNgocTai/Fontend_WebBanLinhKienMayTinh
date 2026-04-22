import { taiKhoanApi, vaiTroApi } from "../api.js";
import {
    ensureAdminPage,
    formatDateTime,
    initializeLayout,
    renderEmptyState,
    renderLoadingState,
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
                  .map((item) => {
                      const roleName = roleMap.get(Number(item.vai_tro_id))?.ten || "Khong xac dinh";

                      return `
                        <tr>
                            <td>
                                <div class="fw-bold">${item.ho_ten || ""}</div>
                                <div class="small text-muted">${item.email || ""}</div>
                            </td>
                            <td>${item.ten_dang_nhap || ""}</td>
                            <td>${item.so_dien_thoai || ""}</td>
                            <td>
                                <div class="fw-semibold">${roleName}</div>
                                <div class="small text-muted">Vai tro chi doc o man hinh nay</div>
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
                                    Luu trang thai
                                </button>
                            </td>
                        </tr>
                    `;
                  })
                  .join("")
            : `<tr><td colspan="7">${renderEmptyState({
                  icon: "fa-users",
                  title: "Khong co tai khoan phu hop",
                  message: "Hay thu lai voi tu khoa khac."
              })}</td></tr>`;
    };

    const loadData = async () => {
        tableRoot.innerHTML = `<tr><td colspan="7">${renderLoadingState("Dang tai tai khoan...")}</td></tr>`;
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
                trang_thai: tableRoot.querySelector(`[data-account-status="${accountId}"]`).value
            });
            showToast("Cập nhật trạng thái tài khoản thành công.");
            await loadData();
        } catch (error) {
            showToast(error.message || "Khong the cap nhat trang thai tai khoan.", "danger");
        }
    });

    await loadData();
});
