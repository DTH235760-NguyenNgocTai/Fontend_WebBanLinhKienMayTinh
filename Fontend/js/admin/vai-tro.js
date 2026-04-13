import { vaiTroApi } from "../api.js";
import { ensureAdminPage, initializeLayout, renderEmptyState, renderLoadingState, showToast } from "../helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-vai-tro", area: "admin" });

    const tableRoot = document.getElementById("admin-roles-table");
    const form = document.getElementById("admin-role-form");
    let editingId = 0;
    let roles = [];

    const loadRoles = async () => {
        tableRoot.innerHTML = `<tr><td colspan="3">${renderLoadingState("Đang tải vai trò...")}</td></tr>`;
        roles = (await vaiTroApi.list()).items;
        tableRoot.innerHTML = roles.length
            ? roles
                  .map(
                      (item) => `
                        <tr>
                            <td>${item.id}</td>
                            <td>${item.ten}</td>
                            <td class="text-end">
                                <div class="d-flex justify-content-end gap-2">
                                    <button class="btn btn-outline-primary btn-sm" type="button" data-edit-role="${item.id}">Sửa</button>
                                    <button class="btn btn-outline-danger btn-sm" type="button" data-delete-role="${item.id}">Xóa</button>
                                </div>
                            </td>
                        </tr>
                    `
                  )
                  .join("")
            : `<tr><td colspan="3">${renderEmptyState({
                  icon: "fa-shield-halved",
                  title: "Chưa có vai trò",
                  message: "Vai trò mới sẽ hiển thị tại đây."
              })}</td></tr>`;
    };

    const resetForm = () => {
        editingId = 0;
        form.reset();
        document.getElementById("admin-role-form-title").textContent = "Thêm vai trò";
    };

    tableRoot.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-role]");
        const deleteButton = event.target.closest("[data-delete-role]");

        if (editButton) {
            const record = roles.find((item) => Number(item.id) === Number(editButton.dataset.editRole));
            if (!record) {
                return;
            }

            editingId = record.id;
            document.getElementById("admin-role-form-title").textContent = "Cập nhật vai trò";
            document.getElementById("role-ten").value = record.ten || "";
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.deleteRole);
            if (!window.confirm("Xóa vai trò này?")) {
                return;
            }

            try {
                await vaiTroApi.remove(id);
                showToast("Đã xóa vai trò.");
                await loadRoles();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa vai trò.", "danger");
            }
        }
    });

    document.getElementById("admin-role-reset")?.addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const payload = {
                ten: document.getElementById("role-ten").value.trim()
            };
            if (editingId) {
                await vaiTroApi.update(editingId, payload);
            } else {
                await vaiTroApi.create(payload);
            }

            showToast(editingId ? "Đã cập nhật vai trò." : "Đã thêm vai trò.");
            await loadRoles();
            resetForm();
        } catch (error) {
            showToast(error.message || "Không thể lưu vai trò.", "danger");
        }
    });

    await loadRoles();
    resetForm();
});
