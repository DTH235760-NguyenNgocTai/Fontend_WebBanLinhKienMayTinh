import { vaiTroApi } from "../api.js";
import {
    ensureAdminPage,
    escapeHtml,
    initializeLayout,
    renderEmptyState,
    renderLoadingState,
    showConfirmDialog,
    showToast
} from "../helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-vai-tro", area: "admin" });

    const tableRoot = document.getElementById("admin-roles-table");
    const form = document.getElementById("admin-role-form");
    const formCard = form?.closest(".admin-card");
    const formTitle = document.getElementById("admin-role-form-title");
    const formSubtitle = formCard?.querySelector(".section-subtitle");
    const submitButton = form?.querySelector('button[type="submit"]');
    const resetButton = document.getElementById("admin-role-reset");
    const nameInput = document.getElementById("role-ten");
    let editingId = 0;
    let roles = [];
    const defaultFormSubtitle = formSubtitle?.textContent?.trim() || "";

    const updateFormMode = ({ isEditing = false, record = null } = {}) => {
        form.dataset.mode = isEditing ? "edit" : "create";
        formTitle.textContent = isEditing ? "Cập nhật vai trò" : "Thêm vai trò";

        if (formSubtitle) {
            formSubtitle.textContent = isEditing
                ? `Đang sửa vai trò: ${record?.ten || "Vai trò đã chọn"}. Bấm "Cập nhật vai trò" để lưu, hoặc "Hủy chỉnh sửa" để quay lại chế độ thêm mới.`
                : defaultFormSubtitle;
        }

        if (submitButton) {
            submitButton.textContent = isEditing ? "Cập nhật vai trò" : "Lưu vai trò";
        }

        if (resetButton) {
            resetButton.textContent = isEditing ? "Hủy chỉnh sửa" : "Tạo mới";
        }
    };

    const focusFormForEditing = () => {
        formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => nameInput?.focus(), 160);
    };

    const highlightRoleRow = (roleId) => {
        const row = tableRoot.querySelector(`[data-role-row="${Number(roleId)}"]`);
        if (!row) {
            return;
        }

        row.classList.add("table-success");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => row.classList.remove("table-success"), 2400);
    };

    const loadRoles = async ({ highlightId = 0 } = {}) => {
        tableRoot.innerHTML = `<tr><td colspan="3">${renderLoadingState("Đang tải vai trò...")}</td></tr>`;
        roles = (await vaiTroApi.listAll()).items;
        tableRoot.innerHTML = roles.length
            ? roles
                  .map(
                      (item) => `
                        <tr data-role-row="${Number(item.id)}">
                            <td>${item.id}</td>
                            <td>${escapeHtml(item.ten || "")}</td>
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

        if (highlightId) {
            window.requestAnimationFrame(() => highlightRoleRow(highlightId));
        }
    };

    const resetForm = () => {
        editingId = 0;
        form.reset();
        updateFormMode();
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
            updateFormMode({ isEditing: true, record });
            nameInput.value = record.ten || "";
            focusFormForEditing();
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.deleteRole);
            const confirmed = await showConfirmDialog({
                title: "Xác nhận xóa vai trò",
                message: "Bạn có chắc muốn xóa vai trò này không?",
                confirmLabel: "Đồng ý xóa",
                cancelLabel: "Không"
            });
            if (!confirmed) {
                return;
            }

            try {
                await vaiTroApi.remove(id);
                showToast("Xóa vai trò thành công.");
                await loadRoles();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa vai trò.", "danger");
            }
        }
    });

    resetButton?.addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const payload = {
                ten: nameInput.value.trim()
            };
            const currentEditingId = editingId;
            const savedRecord = currentEditingId
                ? await vaiTroApi.update(currentEditingId, payload)
                : await vaiTroApi.create(payload);

            showToast(currentEditingId ? "Cập nhật vai trò thành công." : "Thêm vai trò thành công.");
            await loadRoles({ highlightId: savedRecord?.id || currentEditingId });
            resetForm();
        } catch (error) {
            showToast(error.message || "Không thể lưu vai trò.", "danger");
        }
    });

    await loadRoles();
    resetForm();
});
