import { danhMucApi } from "../api.js";
import { ensureAdminPage, initializeLayout, renderEmptyState, renderLoadingState, showToast } from "../helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-danh-muc", area: "admin" });

    const tableRoot = document.getElementById("admin-categories-table");
    const form = document.getElementById("admin-category-form");
    let editingId = 0;
    let categories = [];

    const loadCategories = async () => {
        tableRoot.innerHTML = `<tr><td colspan="3">${renderLoadingState("Đang tải danh mục...")}</td></tr>`;
        categories = (await danhMucApi.list()).items;
        tableRoot.innerHTML = categories.length
            ? categories
                  .map(
                      (item) => `
                        <tr>
                            <td>${item.id}</td>
                            <td>${item.ten}</td>
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
    };

    const resetForm = () => {
        editingId = 0;
        form.reset();
        document.getElementById("admin-category-form-title").textContent = "Thêm danh mục";
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
            document.getElementById("admin-category-form-title").textContent = "Cập nhật danh mục";
            document.getElementById("category-ten").value = record.ten || "";
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.deleteCategory);
            if (!window.confirm("Xóa danh mục này?")) {
                return;
            }

            try {
                await danhMucApi.remove(id);
                showToast("Đã xóa danh mục.");
                await loadCategories();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa danh mục.", "danger");
            }
        }
    });

    document.getElementById("admin-category-reset")?.addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const payload = {
                ten: document.getElementById("category-ten").value.trim()
            };
            if (editingId) {
                await danhMucApi.update(editingId, payload);
            } else {
                await danhMucApi.create(payload);
            }

            showToast(editingId ? "Đã cập nhật danh mục." : "Đã thêm danh mục.");
            await loadCategories();
            resetForm();
        } catch (error) {
            showToast(error.message || "Không thể lưu danh mục.", "danger");
        }
    });

    await loadCategories();
    resetForm();
});
