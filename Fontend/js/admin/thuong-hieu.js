import { thuongHieuApi } from "../api.js";
import { ensureAdminPage, initializeLayout, renderEmptyState, renderLoadingState, showToast } from "../helpers.js";

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-thuong-hieu", area: "admin" });

    const tableRoot = document.getElementById("admin-brands-table");
    const form = document.getElementById("admin-brand-form");
    let editingId = 0;
    let brands = [];

    const loadBrands = async () => {
        tableRoot.innerHTML = `<tr><td colspan="4">${renderLoadingState("Đang tải thương hiệu...")}</td></tr>`;
        brands = (await thuongHieuApi.list()).items;
        tableRoot.innerHTML = brands.length
            ? brands
                  .map(
                      (item) => `
                        <tr>
                            <td>${item.id}</td>
                            <td>${item.ten}</td>
                            <td>${item.logo || ""}</td>
                            <td class="text-end">
                                <div class="d-flex justify-content-end gap-2">
                                    <button class="btn btn-outline-primary btn-sm" type="button" data-edit-brand="${item.id}">Sửa</button>
                                    <button class="btn btn-outline-danger btn-sm" type="button" data-delete-brand="${item.id}">Xóa</button>
                                </div>
                            </td>
                        </tr>
                    `
                  )
                  .join("")
            : `<tr><td colspan="4">${renderEmptyState({
                  icon: "fa-copyright",
                  title: "Chưa có thương hiệu",
                  message: "Thương hiệu mới sẽ hiển thị tại đây."
              })}</td></tr>`;
    };

    const resetForm = () => {
        editingId = 0;
        form.reset();
        document.getElementById("admin-brand-form-title").textContent = "Thêm thương hiệu";
    };

    tableRoot.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-brand]");
        const deleteButton = event.target.closest("[data-delete-brand]");

        if (editButton) {
            const record = brands.find((item) => Number(item.id) === Number(editButton.dataset.editBrand));
            if (!record) {
                return;
            }

            editingId = record.id;
            document.getElementById("admin-brand-form-title").textContent = "Cập nhật thương hiệu";
            document.getElementById("brand-ten").value = record.ten || "";
            document.getElementById("brand-logo").value = record.logo || "";
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.deleteBrand);
            if (!window.confirm("Xóa thương hiệu này?")) {
                return;
            }

            try {
                await thuongHieuApi.remove(id);
                showToast("Đã xóa thương hiệu.");
                await loadBrands();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa thương hiệu.", "danger");
            }
        }
    });

    document.getElementById("admin-brand-reset")?.addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const payload = {
                ten: document.getElementById("brand-ten").value.trim(),
                logo: document.getElementById("brand-logo").value.trim() || null
            };

            if (editingId) {
                await thuongHieuApi.update(editingId, payload);
            } else {
                await thuongHieuApi.create(payload);
            }

            showToast(editingId ? "Đã cập nhật thương hiệu." : "Đã thêm thương hiệu.");
            await loadBrands();
            resetForm();
        } catch (error) {
            showToast(error.message || "Không thể lưu thương hiệu.", "danger");
        }
    });

    await loadBrands();
    resetForm();
});
