import {
    API_PATHS,
    apiPostMultipart,
    hinhAnhSanPhamApi,
    normalizeRecordResponse,
    sanPhamApi
} from "../api.js";
import {
    ensureAdminPage,
    escapeHtml,
    formatCurrency,
    getProductMainImage as resolveProductMainImage,
    hideCenterPopup,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderStatus,
    showCenterPopup,
    showConfirmDialog,
    showProcessingPopup,
    showToast
} from "../helpers.js";
import { createProductDescriptionEditor } from "../ckeditor.js";
import { sanitizeRichTextHtml, stripRichTextHtml } from "../rich-text.js";

const productStatuses = ["hoat_dong", "sap_het_hang", "dang_nhap_hang", "ngung_kinh_doanh"];
const productStatusLabels = {
    hoat_dong: "Hoạt động",
    sap_het_hang: "Sắp hết hàng",
    dang_nhap_hang: "Đang nhập hàng",
    ngung_kinh_doanh: "Ngừng kinh doanh"
};
const PRODUCT_IMAGE_FILE_FIELD = "image";
const descriptionMeta = {
    mo_ta_ngan: {
        title: "Mô tả ngắn gọn",
        subtitle: "Nhập phần mô tả ngắn để hiển thị nhanh ở thẻ sản phẩm, popup và phần mở đầu.",
        emptyMessage: "Chưa có mô tả ngắn. Bấm để nhập trong popup.",
        maxPreviewLength: 180
    },
    mo_ta_chi_tiet: {
        title: "Mô tả chi tiết",
        subtitle: "Nhập nội dung chi tiết, có thể dùng tiêu đề, danh sách, trích dẫn, bảng và liên kết.",
        emptyMessage: "Chưa có mô tả chi tiết. Bấm để nhập trong popup.",
        maxPreviewLength: 320
    }
};

document.addEventListener("DOMContentLoaded", async () => {
    const account = await ensureAdminPage();
    if (!account) {
        return;
    }

    await initializeLayout({ currentPage: "admin-san-pham", area: "admin" });

    const tableRoot = document.getElementById("admin-products-table");
    const form = document.getElementById("admin-product-form");
    const searchInput = document.getElementById("admin-product-search");
    const formTitle = document.getElementById("admin-product-form-title");
    const formCard = form?.closest(".admin-card");
    const formSubtitle = formCard?.querySelector(".section-subtitle");
    const submitButton = form?.querySelector('button[type="submit"]');
    const resetButton = document.getElementById("admin-product-reset");
    const imagePreviewWrap = document.getElementById("product-image-preview-wrap");
    const imagePreviewList = document.getElementById("product-image-preview-list");
    const imagePreviewLabel = document.getElementById("product-image-preview-label");
    const imageSelectionClearButton = document.getElementById("product-image-selection-clear");
    const descriptionModalElement = document.getElementById("product-description-modal");
    const descriptionModalTitle = document.getElementById("product-description-modal-title");
    const descriptionModalSubtitle = document.getElementById("product-description-modal-subtitle");
    const descriptionModalSaveButton = document.getElementById("product-description-modal-save");
    // CKEditor renders some floating inputs/panels outside the modal subtree.
    // Bootstrap's default focus trap will steal focus from those inputs, making them impossible to type into.
    const descriptionModal = window.bootstrap?.Modal.getOrCreateInstance(descriptionModalElement, { focus: false });
    const bypassBootstrapFocusTrapForCkEditor = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }

        if (
            target.closest(
                ".ck.ck-body-wrapper, .ck.ck-balloon-panel, .ck.ck-dropdown__panel, .ck.ck-dialog, .ck.ck-tooltip"
            )
        ) {
            event.stopImmediatePropagation();
        }
    };

    // Extra guard for Bootstrap modal integrations: some CKEditor floating panels
    // live outside the modal DOM tree, so we stop the bubbling `focusin` event
    // before Bootstrap tries to pull focus back into the modal.
    document.addEventListener("focusin", bypassBootstrapFocusTrapForCkEditor, true);

    let currentEditId = 0;
    let products = [];
    let catalog;
    let imagePreviewObjectUrls = [];
    let pendingImageFiles = [];
    let activeDescriptionKey = "mo_ta_ngan";
    let descriptionEditor = null;
    let descriptionEditorPromise = null;
    let isSubmitting = false;
    const defaultFormSubtitle = formSubtitle?.textContent?.trim() || "";

    const MAX_PRODUCT_IMAGE_COUNT = 5;
    const MAX_SECONDARY_IMAGE_COUNT = 4;
    const MAX_PRICE_VALUE = 2147483647;
    const MAX_WARRANTY_MONTHS = 120;
    const MAX_STOCK_QUANTITY = 1000000;
    const MAX_PRODUCT_CODE_LENGTH = 64;
    const MAX_PRODUCT_NAME_LENGTH = 255;
    const PRODUCT_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
    const INVALID_INTEGER_KEYS = new Set(["e", "E", "+", "-", ".", ","]);
    const getSubmitButtonLabel = ({ isEditing = false } = {}) =>
        isEditing ? "Cập nhật sản phẩm" : "Lưu sản phẩm";
    const getResetButtonLabel = ({ isEditing = false } = {}) =>
        isEditing ? "Hủy chỉnh sửa" : "Tạo mới";

    const setFormSubmitting = ({ isLoading = false, isEditing = false, hasImageUpload = false } = {}) => {
        isSubmitting = isLoading;
        form.dataset.submitting = isLoading ? "true" : "false";

        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.setAttribute("aria-busy", isLoading ? "true" : "false");

            if (isLoading) {
                const loadingLabel = hasImageUpload
                    ? isEditing
                        ? "Đang cập nhật và tải ảnh..."
                        : "Đang lưu và tải ảnh..."
                    : isEditing
                        ? "Đang cập nhật..."
                        : "Đang lưu...";
                submitButton.innerHTML = `
                    <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                    <span>${loadingLabel}</span>
                `;
            } else {
                submitButton.textContent = getSubmitButtonLabel({ isEditing });
            }
        }

        if (resetButton) {
            resetButton.disabled = isLoading;
            resetButton.textContent = isLoading ? "Vui lòng chờ..." : getResetButtonLabel({ isEditing });
        }
    };

    const fields = {
        ma_san_pham: document.getElementById("product-ma-san-pham"),
        ten: document.getElementById("product-ten"),
        danh_muc_id: document.getElementById("product-danh-muc-id"),
        thuong_hieu_id: document.getElementById("product-thuong-hieu-id"),
        gia_nhap: document.getElementById("product-gia-nhap"),
        gia_ban: document.getElementById("product-gia-ban"),
        gia_giam: document.getElementById("product-gia-giam"),
        thoi_gian_bao_hanh_thang: document.getElementById("product-bao-hanh"),
        mo_ta_ngan: document.getElementById("product-mo-ta-ngan"),
        mo_ta_chi_tiet: document.getElementById("product-mo-ta-chi-tiet"),
        so_luong_ton: document.getElementById("product-so-luong-ton"),
        trang_thai: document.getElementById("product-trang-thai"),
        duong_dan_anh: document.getElementById("product-duong-dan-anh"),
        anh_file: document.getElementById("product-anh-file")
    };
    const descriptionPreviewElements = {
        mo_ta_ngan: document.getElementById("product-mo-ta-ngan-preview"),
        mo_ta_chi_tiet: document.getElementById("product-mo-ta-chi-tiet-preview")
    };

    const clearFieldValidation = (input) => {
        input?.setCustomValidity("");
    };

    const reportFieldValidation = (input, message) => {
        if (input) {
            input.setCustomValidity(message);
            input.reportValidity();
            input.focus();
            input.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        showToast(message, "warning");
        return null;
    };

    const bindIntegerInputConstraints = (input, { max } = {}) => {
        if (!input) {
            return;
        }

        input.inputMode = "numeric";
        input.step = "1";
        input.min = "0";
        if (Number.isFinite(max)) {
            input.max = String(max);
        }

        input.addEventListener("keydown", (event) => {
            if (INVALID_INTEGER_KEYS.has(event.key)) {
                event.preventDefault();
            }
        });

        input.addEventListener("paste", (event) => {
            const pastedText = event.clipboardData?.getData("text") || "";
            if (pastedText && !/^\d+$/.test(pastedText.trim())) {
                event.preventDefault();
                showToast("Chỉ được nhập số nguyên không âm.", "warning");
            }
        });

        input.addEventListener("input", () => {
            clearFieldValidation(input);
            const normalizedValue = String(input.value || "").trim();

            if (!normalizedValue) {
                return;
            }

            if (!/^\d+$/.test(normalizedValue)) {
                input.value = "";
                return;
            }

            if (Number.isFinite(max) && Number(normalizedValue) > max) {
                input.value = String(max);
            }
        });
    };

    const validateRequiredSelect = (input, label) => {
        clearFieldValidation(input);
        const value = Number(input?.value || 0);
        if (!Number.isInteger(value) || value <= 0) {
            return reportFieldValidation(input, `${label} không được để trống.`);
        }

        return value;
    };

    const validateBoundedInteger = (
        input,
        { label, min = 0, max = MAX_PRICE_VALUE, required = true, mustBeGreaterThanZero = false } = {}
    ) => {
        clearFieldValidation(input);
        const rawValue = String(input?.value ?? "").trim();

        if (!rawValue) {
            if (!required) {
                return 0;
            }

            return reportFieldValidation(input, `${label} không được để trống.`);
        }

        if (!/^\d+$/.test(rawValue)) {
            return reportFieldValidation(input, `${label} chỉ được nhập số nguyên không âm.`);
        }

        const value = Number(rawValue);
        if (!Number.isSafeInteger(value)) {
            return reportFieldValidation(input, `${label} không hợp lệ.`);
        }

        if (mustBeGreaterThanZero && value <= 0) {
            return reportFieldValidation(input, `${label} phải lớn hơn 0.`);
        }

        if (value < min) {
            return reportFieldValidation(input, `${label} không được nhỏ hơn ${min}.`);
        }

        if (value > max) {
            return reportFieldValidation(input, `${label} không được lớn hơn ${max.toLocaleString("vi-VN")}.`);
        }

        return value;
    };

    const validateProductTextFields = () => {
        const productCode = fields.ma_san_pham.value.trim();
        const productName = fields.ten.value.trim();

        clearFieldValidation(fields.ma_san_pham);
        clearFieldValidation(fields.ten);

        if (!productCode) {
            return reportFieldValidation(fields.ma_san_pham, "Mã sản phẩm không được để trống.");
        }

        if (productCode.length > MAX_PRODUCT_CODE_LENGTH) {
            return reportFieldValidation(
                fields.ma_san_pham,
                `Mã sản phẩm không được vượt quá ${MAX_PRODUCT_CODE_LENGTH} ký tự.`
            );
        }

        if (!PRODUCT_CODE_PATTERN.test(productCode)) {
            return reportFieldValidation(
                fields.ma_san_pham,
                "Mã sản phẩm chỉ được chứa chữ, số, dấu chấm, gạch dưới hoặc gạch ngang."
            );
        }

        if (!productName) {
            return reportFieldValidation(fields.ten, "Tên sản phẩm không được để trống.");
        }

        if (productName.length > MAX_PRODUCT_NAME_LENGTH) {
            return reportFieldValidation(
                fields.ten,
                `Tên sản phẩm không được vượt quá ${MAX_PRODUCT_NAME_LENGTH} ký tự.`
            );
        }

        return {
            productCode,
            productName
        };
    };

    [
        { input: fields.gia_nhap, max: MAX_PRICE_VALUE },
        { input: fields.gia_ban, max: MAX_PRICE_VALUE },
        { input: fields.gia_giam, max: MAX_PRICE_VALUE },
        { input: fields.thoi_gian_bao_hanh_thang, max: MAX_WARRANTY_MONTHS },
        { input: fields.so_luong_ton, max: MAX_STOCK_QUANTITY }
    ].forEach(({ input, max }) => bindIntegerInputConstraints(input, { max }));

    Object.values(fields).forEach((input) => {
        if (!input) {
            return;
        }

        input.addEventListener("input", () => clearFieldValidation(input));
        input.addEventListener("change", () => clearFieldValidation(input));
    });

    const ensureDescriptionEditor = async () => {
        if (descriptionEditor) {
            return descriptionEditor;
        }

        if (descriptionEditorPromise) {
            return descriptionEditorPromise;
        }

        descriptionEditorPromise = createProductDescriptionEditor(
            document.getElementById("product-description-modal-editor"),
            {
                placeholder: "Nhập nội dung mô tả sản phẩm...",
                size: "full"
            }
        )
            .then((instance) => {
                descriptionEditor = instance;
                return instance;
            })
            .catch((error) => {
                descriptionEditorPromise = null;
                throw error;
            });

        return descriptionEditorPromise;
    };

    const buildDescriptionPreview = (key) => {
        const text = stripRichTextHtml(fields[key].value || "");
        if (!text) {
            return descriptionMeta[key].emptyMessage;
        }

        return text.length > descriptionMeta[key].maxPreviewLength
            ? `${text.slice(0, descriptionMeta[key].maxPreviewLength).trim()}...`
            : text;
    };

    const renderDescriptionPreview = (key) => {
        const previewElement = descriptionPreviewElements[key];
        if (!previewElement) {
            return;
        }

        const previewText = buildDescriptionPreview(key);
        previewElement.textContent = previewText;
        previewElement.classList.toggle("is-empty", !stripRichTextHtml(fields[key].value || ""));
    };

    const renderAllDescriptionPreviews = () => {
        renderDescriptionPreview("mo_ta_ngan");
        renderDescriptionPreview("mo_ta_chi_tiet");
    };

    const sortProductImages = (images = []) =>
        [...images].sort(
            (left, right) =>
                Number(right?.la_anh_chinh || 0) - Number(left?.la_anh_chinh || 0) ||
                Number(left?.thu_tu || 0) - Number(right?.thu_tu || 0) ||
                Number(right?.id || 0) - Number(left?.id || 0)
        );

    const getProductImageList = (productId) => {
        if (!catalog || !productId) {
            return [];
        }

        const productRecord =
            products.find((item) => Number(item.id) === Number(productId)) || null;
        const nestedImages = Array.isArray(productRecord?.hinh_anh_san_pham)
            ? productRecord.hinh_anh_san_pham
            : Array.isArray(productRecord?.hinh_anhs)
                ? productRecord.hinh_anhs
                : [];

        if (nestedImages.length) {
            return sortProductImages(nestedImages);
        }

        return sortProductImages(catalog.hinhAnhMap.get(Number(productId)) || []);
    };

    const getProductMainImage = (productId) => getProductImageList(productId)[0] || null;

    const openDescriptionEditor = async (key) => {
        activeDescriptionKey = key in descriptionMeta ? key : "mo_ta_ngan";
        descriptionModalTitle.textContent = descriptionMeta[activeDescriptionKey].title;
        descriptionModalSubtitle.textContent = descriptionMeta[activeDescriptionKey].subtitle;
        descriptionModal.show();

        try {
            const editor = await ensureDescriptionEditor();
            editor.setHTML(fields[activeDescriptionKey].value || "");
            window.setTimeout(() => editor.focus(), 120);
        } catch (error) {
            descriptionModal.hide();
            showToast(error.message || "Khong the mo CKEditor.", "danger");
        }
    };

    const applyDescriptionEditor = async () => {
        try {
            const editor = await ensureDescriptionEditor();
            fields[activeDescriptionKey].value = sanitizeRichTextHtml(editor.getHTML());
            renderDescriptionPreview(activeDescriptionKey);
            descriptionModal.hide();
        } catch (error) {
            showToast(error.message || "Khong the ap dung noi dung mo ta.", "danger");
        }
    };

    const revokePreviewObjectUrls = () => {
        imagePreviewObjectUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
        imagePreviewObjectUrls = [];
    };

    const createImagePreviewCardMarkup = ({ src = "", name = "", meta = "", isMain = false } = {}) => `
        <div class="product-image-preview-card">
            ${isMain ? '<span class="product-image-preview-badge">Ảnh chính</span>' : ""}
            <div class="product-image-preview-frame">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(name || "Ảnh sản phẩm")}">
            </div>
            <div class="product-image-preview-name">${escapeHtml(name || "Ảnh sản phẩm")}</div>
            ${meta ? `<div class="product-image-preview-meta">${escapeHtml(meta)}</div>` : ""}
        </div>
    `;

    const setImagePreview = ({ items = [], label = "", showClearAction = false } = {}) => {
        imagePreviewWrap?.classList.toggle("d-none", !items.length);
        imageSelectionClearButton?.classList.toggle("d-none", !showClearAction);

        if (!items.length) {
            imagePreviewList.innerHTML = "";
            if (imagePreviewLabel) {
                imagePreviewLabel.textContent = "Chưa có ảnh được chọn";
            }
            return;
        }

        imagePreviewList.innerHTML = items
            .filter((item) => item?.src)
            .map((item) => createImagePreviewCardMarkup(item))
            .join("");

        if (imagePreviewLabel) {
            imagePreviewLabel.textContent = label || "Ảnh sản phẩm";
        }
    };

    const getImageFileKey = (file) =>
        [file?.name || "", Number(file?.size || 0), Number(file?.lastModified || 0), file?.type || ""].join("::");

    const getSelectedImageFiles = () => [...pendingImageFiles];

    const clearSelectedImageFiles = () => {
        pendingImageFiles = [];
        if (fields.anh_file) {
            fields.anh_file.value = "";
        }
    };

    const getMaxPendingImageCount = () => MAX_PRODUCT_IMAGE_COUNT;

    const calculateTotalImageCountAfterSave = ({ existingImages = [], selectedFiles = [] } = {}) => {
        if (!selectedFiles.length) {
            return existingImages.length;
        }

        return selectedFiles.length;
    };

    const appendSelectedImageFiles = (files = [], maxPendingCount = MAX_PRODUCT_IMAGE_COUNT) => {
        const nextFiles = Array.from(files || []);
        const existingKeys = new Set(pendingImageFiles.map((file) => getImageFileKey(file)));
        let addedCount = 0;
        let duplicateCount = 0;
        let ignoredCount = 0;

        nextFiles.forEach((file) => {
            const fileKey = getImageFileKey(file);

            if (existingKeys.has(fileKey)) {
                duplicateCount += 1;
                return;
            }

            if (pendingImageFiles.length >= maxPendingCount) {
                ignoredCount += 1;
                return;
            }

            existingKeys.add(fileKey);
            pendingImageFiles.push(file);
            addedCount += 1;
        });

        return { addedCount, duplicateCount, ignoredCount };
    };

    const syncPreviewFromCurrentState = () => {
        const selectedFiles = getSelectedImageFiles();
        if (selectedFiles.length) {
            const existingImages = getProductImageList(currentEditId);
            const willReplaceExistingImages = Boolean(currentEditId && existingImages.length);
            revokePreviewObjectUrls();
            imagePreviewObjectUrls = selectedFiles.map((file) => URL.createObjectURL(file));
            setImagePreview({
                label:
                    selectedFiles.length === 1
                        ? willReplaceExistingImages
                            ? "Đã chọn 1 ảnh mới. Bộ ảnh cũ sẽ bị thay thế khi lưu."
                            : "Đã chọn 1 ảnh mới."
                        : willReplaceExistingImages
                            ? `Đã chọn ${selectedFiles.length} ảnh mới. Bộ ảnh cũ sẽ bị thay thế khi lưu.`
                            : `Đã chọn ${selectedFiles.length} ảnh mới.`,
                showClearAction: true,
                items: selectedFiles.map((file, index) => ({
                    src: imagePreviewObjectUrls[index],
                    name: file.name,
                    meta: index === 0
                        ? "Ảnh đầu tiên sẽ được lưu làm ảnh chính."
                        : `Ảnh phụ ${index} sẽ được lưu vào bộ ảnh mới.`,
                    isMain: index === 0
                }))
            });
            return;
        }

        revokePreviewObjectUrls();

        const existingImages = getProductImageList(currentEditId);
        if (existingImages.length) {
            const hasPrimaryImage = existingImages.some((image) => Number(image.la_anh_chinh || 0) === 1);
            fields.duong_dan_anh.value = existingImages[0]?.duong_dan || "";
            setImagePreview({
                label:
                    existingImages.length === 1
                        ? "Sản phẩm đang có 1 ảnh."
                        : `Sản phẩm đang có ${existingImages.length} ảnh.`,
                items: existingImages.map((image, index) => ({
                    src: image.duong_dan || "",
                    name: `Ảnh hiện tại ${index + 1}`,
                    meta:
                        Number(image.la_anh_chinh || 0) === 1 || (!hasPrimaryImage && index === 0)
                            ? "Ảnh chính hiện tại."
                            : `Ảnh phụ ${index}`,
                    isMain: Number(image.la_anh_chinh || 0) === 1 || (!hasPrimaryImage && index === 0)
                })),
                showClearAction: false
            });
            return;
        }

        if (fields.duong_dan_anh.value.trim()) {
            setImagePreview({
                label: "Ảnh chính hiện tại từ cloud.",
                items: [
                    {
                        src: fields.duong_dan_anh.value.trim(),
                        name: "Ảnh chính hiện tại",
                        meta: "Ảnh chính hiện tại.",
                        isMain: true
                    }
                ],
                showClearAction: false
            });
            return;
        }

        setImagePreview();
    };

    const updateFormMode = ({ isEditing = false, record = null } = {}) => {
        form.dataset.mode = isEditing ? "edit" : "create";
        formTitle.textContent = isEditing ? "Cập nhật sản phẩm" : "Thêm sản phẩm";

        if (formSubtitle) {
            formSubtitle.textContent = isEditing
                ? `Đang sửa sản phẩm: ${record?.ten || record?.ma_san_pham || "Sản phẩm đã chọn"}. Bấm "Cập nhật sản phẩm" để lưu, hoặc "Hủy chỉnh sửa" để quay lại chế độ thêm mới.`
                : defaultFormSubtitle;
        }

        if (submitButton && !isSubmitting) {
            submitButton.textContent = getSubmitButtonLabel({ isEditing });
        }

        if (resetButton && !isSubmitting) {
            resetButton.textContent = getResetButtonLabel({ isEditing });
        }
    };

    const focusFormForEditing = () => {
        formCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        window.setTimeout(() => fields.ten?.focus(), 160);
    };

    const highlightProductRow = (productId) => {
        const row = tableRoot.querySelector(`[data-product-row="${Number(productId)}"]`);
        if (!row) {
            return;
        }

        row.classList.add("table-success");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        window.setTimeout(() => row.classList.remove("table-success"), 2400);
    };

    const resetForm = () => {
        currentEditId = 0;
        form.reset();
        Object.values(fields).forEach((input) => clearFieldValidation(input));
        fields.trang_thai.value = "hoat_dong";
        fields.duong_dan_anh.value = "";
        fields.mo_ta_ngan.value = "";
        fields.mo_ta_chi_tiet.value = "";
        clearSelectedImageFiles();
        renderAllDescriptionPreviews();

        if (descriptionEditor) {
            descriptionEditor.clear();
        }

        revokePreviewObjectUrls();
        setImagePreview();
        updateFormMode();
    };

    const populateLookups = () => {
        fields.danh_muc_id.innerHTML = `<option value="">Chọn danh mục</option>${catalog.danh_muc
            .map((item) => `<option value="${item.id}">${item.ten}</option>`)
            .join("")}`;
        fields.thuong_hieu_id.innerHTML = `<option value="">Chọn thương hiệu</option>${catalog.thuong_hieu
            .map((item) => `<option value="${item.id}">${item.ten}</option>`)
            .join("")}`;
        fields.trang_thai.innerHTML = productStatuses
            .map((status) => `<option value="${status}">${productStatusLabels[status] || status}</option>`)
            .join("");
    };

    const renderTable = () => {
        const keyword = (searchInput.value || "").trim().toLowerCase();
        const filteredProducts = products.filter(
            (item) =>
                !keyword ||
                (item.ten || "").toLowerCase().includes(keyword) ||
                (item.ma_san_pham || "").toLowerCase().includes(keyword)
        );

        tableRoot.innerHTML = filteredProducts.length
            ? filteredProducts
                .map(
                    (item) => `
                        <tr data-product-row="${Number(item.id)}">
                            <td>
                                <div class="mini-product">
                                    <div class="mini-product-thumb">
                                        <img src="${escapeHtml(resolveProductMainImage(item, catalog.hinhAnhMap))}" alt="${escapeHtml(item.ten || "Sản phẩm")}">
                                    </div>
                                    <div>
                                        <div class="fw-bold">${item.ten}</div>
                                        <div class="small text-muted">${item.ma_san_pham || "N/A"}</div>
                                    </div>
                                </div>
                            </td>
                            <td>${catalog.danhMucMap.get(Number(item.danh_muc_id))?.ten || ""}</td>
                            <td>${catalog.thuongHieuMap.get(Number(item.thuong_hieu_id))?.ten || ""}</td>
                            <td>${formatCurrency(item.gia_giam || item.gia_ban)}</td>
                            <td>${Number(item.so_luong_ton || 0)}</td>
                            <td>${renderStatus("trang_thai_san_pham", item.trang_thai)}</td>
                            <td class="text-end">
                                <div class="d-flex justify-content-end gap-2">
                                    <button class="btn btn-outline-primary btn-sm" type="button" data-edit-product="${item.id}">Sửa</button>
                                    <button class="btn btn-outline-danger btn-sm" type="button" data-delete-product="${item.id}">Xóa</button>
                                </div>
                            </td>
                        </tr>
                    `
                )
                .join("")
            : `
                <tr>
                    <td colspan="7">${renderEmptyState({
                icon: "fa-box-open",
                title: "Không có sản phẩm phù hợp",
                message: "Hãy thử lại với từ khóa khác."
            })}</td>
                </tr>
            `;
    };

    const loadData = async () => {
        tableRoot.innerHTML = `<tr><td colspan="7">${renderLoadingState("Đang tải sản phẩm...")}</td></tr>`;
        const [productResponse, lookups] = await Promise.all([sanPhamApi.listAll(), loadCatalogLookups()]);
        products = productResponse.items;
        catalog = lookups;
        populateLookups();
        renderTable();
    };

    const refreshProductsAfterMutation = async ({ highlightId = 0 } = {}) => {
        try {
            await loadData();
            if (highlightId) {
                window.requestAnimationFrame(() => highlightProductRow(highlightId));
            }
        } catch (error) {
            showToast(error.message || "Đã lưu dữ liệu nhưng chưa thể tải lại danh sách sản phẩm.", "warning");
        }
    };

    const buildImageUploadFormData = ({ productId, imageFile, sortOrder = 1, isPrimary = false, existingImage = null }) => {
        const formData = new FormData();

        formData.append("san_pham_id", String(productId));
        formData.append("la_anh_chinh", isPrimary ? "1" : "0");
        formData.append("thu_tu", String(sortOrder));
        formData.append(PRODUCT_IMAGE_FILE_FIELD, imageFile, imageFile.name);

        if (existingImage?.duong_dan) {
            formData.append("duong_dan_cu", existingImage.duong_dan);
        }

        return formData;
    };

    const uploadProductImage = async ({ productId, imageFile, sortOrder = 1, isPrimary = false, existingImage = null }) => {
        const formData = buildImageUploadFormData({
            productId,
            imageFile,
            sortOrder,
            isPrimary,
            existingImage
        });

        const ensureImageUploadRecord = (payload) => {
            const normalized = normalizeRecordResponse(payload);

            if (
                !normalized ||
                (!normalized.id && !normalized.duong_dan && Number(normalized.san_pham_id || 0) !== Number(productId))
            ) {
                throw new Error("Backend chưa trả về dữ liệu ảnh hợp lệ sau khi upload.");
            }

            return normalized;
        };

        if (existingImage?.id) {
            formData.append("_method", "PUT");
            return ensureImageUploadRecord(
                await apiPostMultipart(`${API_PATHS.hinh_anh_san_pham}/${existingImage.id}`, formData)
            );
        }

        return ensureImageUploadRecord(
            await apiPostMultipart(API_PATHS.hinh_anh_san_pham, formData)
        );
    };

    const uploadProductImages = async ({ productId, imageFiles = [], existingImages = [] }) => {
        const files = imageFiles.filter(Boolean);
        if (!files.length) {
            return [];
        }

        const sortedExistingImages = sortProductImages(existingImages);
        const existingMainImage =
            sortedExistingImages.find((image) => Number(image.la_anh_chinh || 0) === 1) ||
            sortedExistingImages[0] ||
            null;
        let nextSortOrder = sortedExistingImages.reduce(
            (maxOrder, image) => Math.max(maxOrder, Number(image.thu_tu || 0)),
            0
        ) + 1;
        const uploadedImages = [];

        for (const [index, imageFile] of files.entries()) {
            if (index === 0) {
                const primarySortOrder = existingMainImage
                    ? Math.max(Number(existingMainImage.thu_tu || 1), 1)
                    : 1;
                uploadedImages.push(
                    await uploadProductImage({
                        productId,
                        imageFile,
                        sortOrder: primarySortOrder,
                        isPrimary: true,
                        existingImage: existingMainImage
                    })
                );
                nextSortOrder = Math.max(nextSortOrder, primarySortOrder + 1);
                continue;
            }

            uploadedImages.push(
                await uploadProductImage({
                    productId,
                    imageFile,
                    sortOrder: Math.max(nextSortOrder, 2),
                    isPrimary: false
                })
            );
            nextSortOrder += 1;
        }

        return uploadedImages;
    };

    const removeProductImages = async (images = []) => {
        const removableImages = images.filter((image) => Number(image?.id || 0));
        if (!removableImages.length) {
            return;
        }

        const removalResults = await Promise.allSettled(
            removableImages.map((image) => hinhAnhSanPhamApi.remove(image.id))
        );
        const failedRemovals = removalResults.filter((result) => result.status === "rejected");

        if (failedRemovals.length) {
            throw failedRemovals[0].reason || new Error("Không thể xóa bộ ảnh cũ của sản phẩm.");
        }
    };

    const normalizeProductPrimaryImage = async ({ productId, primaryImageId = 0 } = {}) => {
        if (!productId || !primaryImageId) {
            return;
        }

        try {
            const imageResponse = await hinhAnhSanPhamApi.listAll();
            const productImages = sortProductImages(
                imageResponse.items.filter((image) => Number(image.san_pham_id) === Number(productId))
            );

            if (!productImages.length) {
                return;
            }

            let secondarySortOrder = 2;
            const updateTasks = productImages
                .map((image) => {
                    const isPrimary = Number(image.id) === Number(primaryImageId);
                    const nextSortOrder = isPrimary ? 1 : secondarySortOrder++;

                    if (
                        Number(image.la_anh_chinh || 0) === (isPrimary ? 1 : 0) &&
                        Number(image.thu_tu || 0) === nextSortOrder
                    ) {
                        return null;
                    }

                    return hinhAnhSanPhamApi.update(image.id, {
                        san_pham_id: Number(image.san_pham_id || productId),
                        duong_dan: image.duong_dan,
                        la_anh_chinh: isPrimary ? 1 : 0,
                        thu_tu: nextSortOrder
                    });
                })
                .filter(Boolean);

            if (updateTasks.length) {
                await Promise.allSettled(updateTasks);
            }
        } catch (error) {
            // Some backends only allow multipart image updates. In that case we still keep the uploaded record;
            // the fallback sorting below will prefer the newest main image on the UI.
        }
    };

    searchInput.addEventListener("input", renderTable);

    fields.anh_file?.addEventListener("change", () => {
        const incomingFiles = Array.from(fields.anh_file.files || []);
        const invalidFiles = incomingFiles.filter((file) => !file.type.startsWith("image/"));

        if (invalidFiles.length) {
            fields.anh_file.value = "";
            showToast("Vui lòng chỉ chọn file ảnh hợp lệ.", "warning");
            return;
        }

        const maxPendingCount = getMaxPendingImageCount();

        if (maxPendingCount <= 0) {
            fields.anh_file.value = "";
            showToast(`Chỉ được chọn tối đa ${MAX_PRODUCT_IMAGE_COUNT} ảnh cho mỗi sản phẩm.`, "warning");
            return;
        }

        const { addedCount, duplicateCount, ignoredCount } = appendSelectedImageFiles(incomingFiles, maxPendingCount);
        fields.anh_file.value = "";
        syncPreviewFromCurrentState();

        if (!addedCount && duplicateCount) {
            showToast("Các ảnh này đã được chọn trước đó.", "info");
        }

        if (ignoredCount) {
            showToast(
                `Chỉ được chọn tối đa 1 ảnh chính và ${MAX_SECONDARY_IMAGE_COUNT} ảnh phụ cho mỗi sản phẩm.`,
                "warning"
            );
        }
    });

    imageSelectionClearButton?.addEventListener("click", () => {
        clearSelectedImageFiles();
        syncPreviewFromCurrentState();
        showToast("Đã xóa bộ ảnh mới đã chọn.", "success");
    });

    form.addEventListener("click", async (event) => {
        const trigger = event.target.closest("[data-open-description-editor]");
        if (!trigger) {
            return;
        }

        await openDescriptionEditor(trigger.dataset.openDescriptionEditor);
    });

    descriptionModalSaveButton?.addEventListener("click", applyDescriptionEditor);

    tableRoot.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-product]");
        const deleteButton = event.target.closest("[data-delete-product]");

        if (editButton) {
            const record = products.find((item) => Number(item.id) === Number(editButton.dataset.editProduct));
            if (!record) {
                return;
            }

            currentEditId = record.id;
            updateFormMode({ isEditing: true, record });

            Object.entries(fields).forEach(([key, input]) => {
                if (!input) {
                    return;
                }

                if (key === "duong_dan_anh") {
                    input.value = getProductMainImage(record.id)?.duong_dan || "";
                    return;
                }

                if (key === "anh_file") {
                    clearSelectedImageFiles();
                    return;
                }

                if (key === "gia_nhap") {
                    input.value = record.gia_nhap ?? record.gia_ban ?? "";
                    return;
                }

                if (key === "mo_ta_ngan" || key === "mo_ta_chi_tiet") {
                    input.value = sanitizeRichTextHtml(record[key] ?? "");
                    return;
                }

                input.value = record[key] ?? "";
            });

            renderAllDescriptionPreviews();
            syncPreviewFromCurrentState();
            focusFormForEditing();
        }

        if (deleteButton) {
            const recordId = Number(deleteButton.dataset.deleteProduct);
            const confirmed = await showConfirmDialog({
                title: "Xác nhận xóa sản phẩm",
                message: "Bạn có chắc muốn xóa sản phẩm này khỏi danh sách không?",
                confirmLabel: "Đồng ý xóa",
                cancelLabel: "Không"
            });
            if (!confirmed) {
                return;
            }

            try {
                await sanPhamApi.remove(recordId);
                showToast("Xóa sản phẩm thành công.");
                await loadData();
                resetForm();
            } catch (error) {
                showToast(error.message || "Không thể xóa sản phẩm.", "danger");
            }
        }
    });

    document.getElementById("admin-product-reset")?.addEventListener("click", resetForm);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (isSubmitting) {
            return;
        }

        const isEditing = Boolean(currentEditId);
        const textValidation = validateProductTextFields();
        if (!textValidation) {
            return;
        }

        const danhMucId = validateRequiredSelect(fields.danh_muc_id, "Danh mục");
        if (!danhMucId) {
            return;
        }

        const thuongHieuId = validateRequiredSelect(fields.thuong_hieu_id, "Thương hiệu");
        if (!thuongHieuId) {
            return;
        }

        const giaNhap = validateBoundedInteger(fields.gia_nhap, {
            label: "Giá nhập",
            max: MAX_PRICE_VALUE,
            mustBeGreaterThanZero: true
        });
        if (giaNhap === null) {
            return;
        }

        const giaBan = validateBoundedInteger(fields.gia_ban, {
            label: "Giá bán",
            max: MAX_PRICE_VALUE,
            mustBeGreaterThanZero: true
        });
        if (giaBan === null) {
            return;
        }

        const giaGiam = validateBoundedInteger(fields.gia_giam, {
            label: "Giá giảm",
            max: MAX_PRICE_VALUE,
            required: false
        });
        if (giaGiam === null) {
            return;
        }

        if (giaGiam > 0 && giaGiam >= giaBan) {
            reportFieldValidation(fields.gia_giam, "Giá giảm phải nhỏ hơn giá bán.");
            return;
        }

        const thoiGianBaoHanh = validateBoundedInteger(fields.thoi_gian_bao_hanh_thang, {
            label: "Bảo hành",
            max: MAX_WARRANTY_MONTHS
        });
        if (thoiGianBaoHanh === null) {
            return;
        }

        const soLuongTon = validateBoundedInteger(fields.so_luong_ton, {
            label: "Số lượng tồn",
            max: MAX_STOCK_QUANTITY
        });
        if (soLuongTon === null) {
            return;
        }

        const moTaNganHtml = sanitizeRichTextHtml(fields.mo_ta_ngan.value.trim());
        const moTaChiTietHtml = sanitizeRichTextHtml(fields.mo_ta_chi_tiet.value.trim());

        if (!stripRichTextHtml(moTaNganHtml)) {
            showToast("Vui lòng nhập mô tả ngắn cho sản phẩm.", "warning");
            await openDescriptionEditor("mo_ta_ngan");
            return;
        }

        if (!stripRichTextHtml(moTaChiTietHtml)) {
            showToast("Vui lòng nhập mô tả chi tiết cho sản phẩm.", "warning");
            await openDescriptionEditor("mo_ta_chi_tiet");
            return;
        }

        const selectedImageFiles = getSelectedImageFiles();
        const hasImageUpload = Boolean(selectedImageFiles.length);

        const payload = {
            ma_san_pham: textValidation.productCode,
            ten: textValidation.productName,
            danh_muc_id: danhMucId,
            thuong_hieu_id: thuongHieuId,
            gia_nhap: giaNhap,
            gia_ban: giaBan,
            gia_giam: giaGiam,
            thoi_gian_bao_hanh_thang: thoiGianBaoHanh,
            mo_ta_ngan: moTaNganHtml,
            mo_ta_chi_tiet: moTaChiTietHtml,
            so_luong_ton: soLuongTon,
            trang_thai: fields.trang_thai.value
        };

        setFormSubmitting({ isLoading: true, isEditing, hasImageUpload });
        showProcessingPopup({
            title: isEditing ? "Đang cập nhật sản phẩm" : "Đang thêm sản phẩm",
            message: hasImageUpload
                ? "Hệ thống đang lưu thông tin và tải bộ ảnh sản phẩm lên. Vui lòng chờ trong giây lát."
                : "Hệ thống đang lưu thông tin sản phẩm. Vui lòng chờ trong giây lát."
        });

        try {
            const record = currentEditId
                ? await sanPhamApi.update(currentEditId, payload)
                : await sanPhamApi.create(payload);

            const existingImages = getProductImageList(record.id);
            const totalImageCountAfterSave = calculateTotalImageCountAfterSave({
                existingImages,
                selectedFiles: selectedImageFiles
            });

            if (totalImageCountAfterSave > MAX_PRODUCT_IMAGE_COUNT) {
                showToast(
                    `Mỗi sản phẩm chỉ có tối đa ${MAX_PRODUCT_IMAGE_COUNT} ảnh: 1 ảnh chính và ${MAX_SECONDARY_IMAGE_COUNT} ảnh phụ.`,
                    "warning"
                );
                currentEditId = record.id;
                updateFormMode({ isEditing: true, record });
                return;
            }

            if (selectedImageFiles.length) {
                try {
                    if (existingImages.length) {
                        await removeProductImages(existingImages);
                        fields.duong_dan_anh.value = "";
                    }

                    const uploadedImages = await uploadProductImages({
                        productId: record.id,
                        imageFiles: selectedImageFiles,
                        existingImages: []
                    });
                    const uploadedPrimaryImage = uploadedImages[0] || null;

                    await normalizeProductPrimaryImage({
                        productId: record.id,
                        primaryImageId: uploadedPrimaryImage?.id || 0
                    });

                    if (uploadedPrimaryImage?.duong_dan) {
                        fields.duong_dan_anh.value = uploadedPrimaryImage.duong_dan;
                    }
                } catch (error) {
                    showToast(
                        isEditing
                            ? `Đã cập nhật sản phẩm nhưng tải bộ ảnh chưa hoàn tất: ${error.message || "Backend chưa nhận được file."}`
                            : `Đã thêm sản phẩm nhưng tải bộ ảnh chưa hoàn tất: ${error.message || "Backend chưa nhận được file."}`,
                        "warning"
                    );

                    if (isEditing) {
                        currentEditId = record.id;
                        updateFormMode({ isEditing: true, record });
                        fields.anh_file.value = "";
                        await refreshProductsAfterMutation({ highlightId: record.id });
                        syncPreviewFromCurrentState();
                        return;
                    }

                    resetForm();
                    await refreshProductsAfterMutation();
                    return;
                }
            }

            const successMessage = selectedImageFiles.length
                ? isEditing
                    ? "Sản phẩm đã được cập nhật và bộ ảnh mới đã tải lên thành công."
                    : "Sản phẩm đã được thêm và bộ ảnh đã tải lên thành công."
                : isEditing
                    ? "Sản phẩm đã được cập nhật thành công."
                    : "Sản phẩm đã được thêm thành công.";

            resetForm();
            await refreshProductsAfterMutation({ highlightId: isEditing ? record.id : 0 });
            hideCenterPopup();
            await showCenterPopup({
                title: "Thành công!",
                message: successMessage,
                tone: "success",
                confirmLabel: "OK"
            });
        } catch (error) {
            showToast(error.message || "Không thể lưu sản phẩm.", "danger");
        } finally {
            hideCenterPopup();
            setFormSubmitting({ isLoading: false, isEditing: Boolean(currentEditId) });
        }
    });

    renderAllDescriptionPreviews();
    await loadData();
    resetForm();
});
