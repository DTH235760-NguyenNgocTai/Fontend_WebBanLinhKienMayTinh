import { danhMucApi } from "../api.js";
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

    await initializeLayout({ currentPage: "admin-danh-muc", area: "admin" });

    const tableRoot = document.getElementById("admin-categories-table");
    const form = document.getElementById("admin-category-form");
    const formCard = form?.closest(".admin-card");
    const formTitle = document.getElementById("admin-category-form-title");
    const formSubtitle = formCard?.querySelector(".section-subtitle");
    const submitButton = form?.querySelector('button[type="submit"]');
    const resetButton = document.getElementById("admin-category-reset");
    const nameInput = document.getElementById("category-ten");
    let editingId = 0;
    let categories = [];
    const defaultFormSubtitle = formSubtitle?.textContent?.trim() || "";

    const updateFormMode = ({ isEditing = false, record = null } = {}) => {
        form.dataset.mode = isEditing ? "edit" : "create";
        formTitle.textContent = isEditing ? "Cập nhật danh mục" : "Thêm danh mục";

        if (formSubtitle) {
            formSubtitle.textContent = isEditing
                ? `Đang sửa danh mục: ${record?.ten || "Danh mục đã chọn"}. Bấm "Cập nhật danh mục" để lưu, hoặc "Hủy chỉnh sửa" để quay lại chế độ thêm mới.`
                : defaultFormSubtitle;
        }

        if (submitButton) {
            submitButton.textContent = isEditing ? "Cập nhật danh mục" : "Lưu danh mục";
        }

        if (resetButton) {
            resetButton.textContent = isEditing ? "Hủy chỉnh sửa" : "Tạo mới";
        }
    };

    const focusFormForEditing = () => {
        formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => nameInput?.focus(), 160);
    };

    const highlightCategoryRow = (categoryId) => {
        const row = tableRoot.querySelector(`[data-category-row="${Number(categoryId)}"]`);
        if (!row) {
            return;
        }

        row.classList.add("table-success");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => row.classList.remove("table-success"), 2400);
    };

    const loadCategories = async ({ highlightId = 0 } = {}) => {
        tableRoot.innerHTML = `<tr><td colspan="3">${renderLoadingState("Đang tải danh mục...")}</td></tr>`;
        categories = (await danhMucApi.listAll()).items;
        tableRoot.innerHTML = categories.length
            ? categories
                  .map(
                      (item) => `
                        <tr data-category-row="${Number(item.id)}">
                            <td>${item.id}</td>
                            <td>${escapeHtml(item.ten || "")}</td>
                            <td class="text-end">
                                <div class="d-flex justify-content-end gap-2">
                                    <button class="btn btn-outline-primary btn-sm" type="button" data-edit-category="${item.id}">Sửa</button>
                                    <button class="btn btn-outline-danger btn-sm" type="button" data-delete-category="${item.id}">Xóa</button>
                                </div>
                            </td>
                        </tr>
                    `
                  )
                  .join("")
            : `<tr><td colspan="3">${renderEmptyState({
                  icon: "fa-layer-group",
                  title: "Chưa có danh mục",
                  message: "Danh mục mới sẽ hiển thị tại đây."
              })}</td></tr>`;

        if (highlightId) {
            window.requestAnimationFrame(() => highlightCategoryRow(highlightId));
        }
    };

    const resetForm = () => {
        editingId = 0;
        form.reset();
        updateFormMode();
    };

    tableRoot.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-category]");
        const deleteButton = event.target.closest("[data-delete-category]");

        if (editButton) {
            const record = categories.find((item) => Number(item.id) === Number(editButton.dataset.editCategory));
            if (!record) {
                return;
            }

            editingId = record.id;
            updateFormMode({ isEditing: true, record });
            nameInput.value = record.ten || "";
            focusFormForEditing();
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.deleteCategory);
            const confirmed = await showConfirmDialog({
                title: "Xác nhận xóa danh mục",
                message: "Bạn có chắc muốn xóa danh mục này không?",
                confirmLabel: "Đồng ý xóa",
                cancelLabel: "Không"
            });
            if (!confirmed) {
                return;
            }

            try {
                await danhMucApi.remove(id);
                showToast("Xóa danh mục thành công.");
                await loadCategories();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa danh mục.", "danger");
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
                ? await danhMucApi.update(currentEditingId, payload)
                : await danhMucApi.create(payload);

            showToast(currentEditingId ? "Cập nhật danh mục thành công." : "Thêm danh mục thành công.");
            await loadCategories({ highlightId: savedRecord?.id || currentEditingId });
            resetForm();
        } catch (error) {
            showToast(error.message || "Không thể lưu danh mục.", "danger");
        }
    });

    await loadCategories();
    resetForm();
});
