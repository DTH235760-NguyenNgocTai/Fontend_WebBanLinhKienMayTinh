import {
    API_PATHS,
    apiPostMultipart,
    normalizeRecordResponse,
    thuongHieuApi
} from "../api.js";
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

    await initializeLayout({ currentPage: "admin-thuong-hieu", area: "admin" });

    const tableRoot = document.getElementById("admin-brands-table");
    const form = document.getElementById("admin-brand-form");
    const formCard = form?.closest(".admin-card");
    const formTitle = document.getElementById("admin-brand-form-title");
    const formSubtitle = formCard?.querySelector(".section-subtitle");
    const submitButton = form?.querySelector('button[type="submit"]');
    const resetButton = document.getElementById("admin-brand-reset");
    const brandNameInput = document.getElementById("brand-ten");
    const brandLogoInput = document.getElementById("brand-logo");
    const brandLogoFileInput = document.getElementById("brand-logo-file");
    const brandLogoPreviewWrap = document.getElementById("brand-logo-preview-wrap");
    const brandLogoPreview = document.getElementById("brand-logo-preview");
    const brandLogoPreviewLabel = document.getElementById("brand-logo-preview-label");
    const brandLogoClearButton = document.getElementById("brand-logo-selection-clear");
    let editingId = 0;
    let brands = [];
    let existingLogoValue = "";
    let pendingLogoFile = null;
    let pendingLogoPreviewUrl = "";
    const defaultFormSubtitle = formSubtitle?.textContent?.trim() || "";

    const updateFormMode = ({ isEditing = false, record = null } = {}) => {
        form.dataset.mode = isEditing ? "edit" : "create";
        formTitle.textContent = isEditing ? "Cập nhật thương hiệu" : "Thêm thương hiệu";

        if (formSubtitle) {
            formSubtitle.textContent = isEditing
                ? `Đang sửa thương hiệu: ${record?.ten || "Thương hiệu đã chọn"}. Bấm "Cập nhật thương hiệu" để lưu, hoặc "Hủy chỉnh sửa" để quay lại chế độ thêm mới.`
                : defaultFormSubtitle;
        }

        if (submitButton) {
            submitButton.textContent = isEditing ? "Cập nhật thương hiệu" : "Lưu thương hiệu";
        }

        if (resetButton) {
            resetButton.textContent = isEditing ? "Hủy chỉnh sửa" : "Tạo mới";
        }
    };

    const focusFormForEditing = () => {
        formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => brandNameInput?.focus(), 160);
    };

    const highlightBrandRow = (brandId) => {
        const row = tableRoot.querySelector(`[data-brand-row="${Number(brandId)}"]`);
        if (!row) {
            return;
        }

        row.classList.add("table-success");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => row.classList.remove("table-success"), 2400);
    };

    const setLogoPreview = ({ src = "", label = "", showClearAction = false } = {}) => {
        brandLogoPreviewWrap?.classList.toggle("d-none", !src);
        brandLogoClearButton?.classList.toggle("d-none", !showClearAction);

        if (!src) {
            brandLogoPreview?.removeAttribute("src");
            if (brandLogoPreviewLabel) {
                brandLogoPreviewLabel.textContent = "Chưa có logo";
            }
            return;
        }

        brandLogoPreview.src = src;
        if (brandLogoPreviewLabel) {
            brandLogoPreviewLabel.textContent = label || "Logo thương hiệu";
        }
    };

    const revokePendingLogoPreviewUrl = () => {
        if (!pendingLogoPreviewUrl) {
            return;
        }

        URL.revokeObjectURL(pendingLogoPreviewUrl);
        pendingLogoPreviewUrl = "";
    };

    const setPendingLogoFile = (file = null) => {
        revokePendingLogoPreviewUrl();
        pendingLogoFile = file || null;
    };

    const getPendingLogoFile = () => pendingLogoFile;

    const getLogoSummaryText = (logo = "") => {
        const trimmedLogo = String(logo || "").trim();
        if (!trimmedLogo) {
            return "";
        }

        if (trimmedLogo.startsWith("data:image/")) {
            return "Logo cũ đang lưu theo dữ liệu nội tuyến.";
        }

        return trimmedLogo.length > 64 ? `${trimmedLogo.slice(0, 64)}...` : trimmedLogo;
    };

    const syncLogoPreview = () => {
        const selectedFile = getPendingLogoFile();
        const logoValue = brandLogoInput.value.trim();

        if (selectedFile) {
            if (!pendingLogoPreviewUrl) {
                pendingLogoPreviewUrl = URL.createObjectURL(selectedFile);
            }
            setLogoPreview({
                src: pendingLogoPreviewUrl,
                label: `Logo mới sẽ được tải lên từ file: ${selectedFile.name}`,
                showClearAction: true
            });
            return;
        }

        if (!logoValue) {
            setLogoPreview();
            return;
        }

        setLogoPreview({
            src: logoValue,
            label: editingId ? "Logo hiện tại của thương hiệu." : "Logo thương hiệu đã chọn.",
            showClearAction: Boolean(!editingId && logoValue)
        });
    };

    const saveBrand = async ({ brandId = 0, name = "", logoValue = "", logoFile = null } = {}) => {
        if (logoFile) {
            const formData = new FormData();
            formData.append("ten", name);
            formData.append("logo", logoFile, logoFile.name);

            if (brandId) {
                formData.append("_method", "PUT");
                return normalizeRecordResponse(
                    await apiPostMultipart(`${API_PATHS.thuong_hieu}/${brandId}`, formData)
                );
            }

            return normalizeRecordResponse(await apiPostMultipart(API_PATHS.thuong_hieu, formData));
        }

        const payload = {
            ten: name,
            logo: logoValue
        };

        return brandId
            ? await thuongHieuApi.update(brandId, payload)
            : await thuongHieuApi.create(payload);
    };

    const loadBrands = async ({ highlightId = 0 } = {}) => {
        tableRoot.innerHTML = `<tr><td colspan="4">${renderLoadingState("Đang tải thương hiệu...")}</td></tr>`;
        brands = (await thuongHieuApi.listAll()).items;
        tableRoot.innerHTML = brands.length
            ? brands
                  .map(
                      (item) => `
                        <tr data-brand-row="${Number(item.id)}">
                            <td>${item.id}</td>
                            <td>${escapeHtml(item.ten || "")}</td>
                            <td>
                                ${
                                    item.logo
                                        ? `
                                            <div class="d-flex align-items-center gap-3">
                                                <div class="product-image-preview-frame" style="width: 72px; min-width: 72px; aspect-ratio: 1 / 1;">
                                                    <img src="${escapeHtml(item.logo)}" alt="${escapeHtml(item.ten || "Logo thương hiệu")}">
                                                </div>
                                                <div class="small text-muted">${escapeHtml(getLogoSummaryText(item.logo))}</div>
                                            </div>
                                        `
                                        : `<span class="small text-muted">Chưa có logo</span>`
                                }
                            </td>
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

        if (highlightId) {
            window.requestAnimationFrame(() => highlightBrandRow(highlightId));
        }
    };

    const resetForm = () => {
        editingId = 0;
        existingLogoValue = "";
        form.reset();
        brandLogoInput.value = "";
        brandLogoFileInput.value = "";
        setPendingLogoFile();
        setLogoPreview();
        updateFormMode();
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
            existingLogoValue = record.logo || "";
            updateFormMode({ isEditing: true, record });
            brandNameInput.value = record.ten || "";
            brandLogoInput.value = existingLogoValue;
            brandLogoFileInput.value = "";
            setPendingLogoFile();
            syncLogoPreview();
            focusFormForEditing();
        }

        if (deleteButton) {
            const id = Number(deleteButton.dataset.deleteBrand);
            const confirmed = await showConfirmDialog({
                title: "Xác nhận xóa thương hiệu",
                message: "Bạn có chắc muốn xóa thương hiệu này không?",
                confirmLabel: "Đồng ý xóa",
                cancelLabel: "Không"
            });
            if (!confirmed) {
                return;
            }

            try {
                await thuongHieuApi.remove(id);
                showToast("Xóa thương hiệu thành công.");
                await loadBrands();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa thương hiệu.", "danger");
            }
        }
    });

    brandLogoFileInput?.addEventListener("change", async () => {
        const selectedFile = brandLogoFileInput.files?.[0] || null;
        if (!selectedFile) {
            syncLogoPreview();
            return;
        }

        if (!selectedFile.type.startsWith("image/")) {
            brandLogoFileInput.value = "";
            showToast("Vui lòng chọn đúng file ảnh cho logo.", "warning");
            syncLogoPreview();
            return;
        }

        setPendingLogoFile(selectedFile);
        brandLogoFileInput.value = "";
        syncLogoPreview();
    });

    brandLogoClearButton?.addEventListener("click", () => {
        brandLogoFileInput.value = "";
        setPendingLogoFile();

        if (editingId && existingLogoValue) {
            brandLogoInput.value = existingLogoValue;
            syncLogoPreview();
            showToast("Đã bỏ logo mới, giữ lại logo hiện tại.", "info");
            return;
        }

        brandLogoInput.value = "";
        syncLogoPreview();
        showToast("Đã xóa logo đã chọn.", "success");
    });

    resetButton?.addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const selectedLogoFile = getPendingLogoFile();
            const logo = brandLogoInput.value.trim();
            if (!logo && !selectedLogoFile) {
                showToast("Vui lòng chọn 1 file logo cho thương hiệu.", "warning");
                brandLogoFileInput?.focus();
                return;
            }

            const currentEditingId = editingId;
            const savedRecord = await saveBrand({
                brandId: currentEditingId,
                name: brandNameInput.value.trim(),
                logoValue: logo,
                logoFile: selectedLogoFile
            });

            showToast(currentEditingId ? "Cập nhật thương hiệu thành công." : "Thêm thương hiệu thành công.");
            await loadBrands({ highlightId: savedRecord?.id || currentEditingId });
            resetForm();
        } catch (error) {
            showToast(error.message || "Không thể lưu thương hiệu.", "danger");
        }
    });

    await loadBrands();
    resetForm();
});
