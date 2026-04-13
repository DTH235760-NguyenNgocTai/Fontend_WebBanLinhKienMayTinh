import { hinhAnhSanPhamApi, sanPhamApi } from "../api.js";
import {
    ensureAdminPage,
    formatCurrency,
    initializeLayout,
    loadCatalogLookups,
    renderEmptyState,
    renderLoadingState,
    renderStatus,
    showToast
} from "../helpers.js";

const productStatuses = ["hoat_dong", "sap_het_hang", "dang_nhap_hang", "ngung_kinh_doanh"];

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
    let currentEditId = 0;
    let products = [];
    let catalog;

    const fields = {
        ma_san_pham: document.getElementById("product-ma-san-pham"),
        ten: document.getElementById("product-ten"),
        danh_muc_id: document.getElementById("product-danh-muc-id"),
        thuong_hieu_id: document.getElementById("product-thuong-hieu-id"),
        gia_ban: document.getElementById("product-gia-ban"),
        gia_giam: document.getElementById("product-gia-giam"),
        thoi_gian_bao_hanh_thang: document.getElementById("product-bao-hanh"),
        mo_ta_ngan: document.getElementById("product-mo-ta-ngan"),
        mo_ta_chi_tiet: document.getElementById("product-mo-ta-chi-tiet"),
        so_luong_ton: document.getElementById("product-so-luong-ton"),
        trang_thai: document.getElementById("product-trang-thai"),
        duong_dan_anh: document.getElementById("product-duong-dan-anh")
    };

    const resetForm = () => {
        currentEditId = 0;
        form.reset();
        fields.trang_thai.value = "hoat_dong";
        formTitle.textContent = "Thêm sản phẩm";
    };

    const populateLookups = () => {
        fields.danh_muc_id.innerHTML = `<option value="">Chọn danh mục</option>${catalog.danh_muc
            .map((item) => `<option value="${item.id}">${item.ten}</option>`)
            .join("")}`;
        fields.thuong_hieu_id.innerHTML = `<option value="">Chọn thương hiệu</option>${catalog.thuong_hieu
            .map((item) => `<option value="${item.id}">${item.ten}</option>`)
            .join("")}`;
        fields.trang_thai.innerHTML = productStatuses
            .map((status) => `<option value="${status}">${status}</option>`)
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
                        <tr>
                            <td>
                                <div class="mini-product">
                                    <div class="mini-product-thumb">
                                        <img src="${catalog.hinhAnhMap.get(Number(item.id))?.[0]?.duong_dan || ""}" alt="${item.ten}">
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
        const [productResponse, lookups] = await Promise.all([sanPhamApi.list(), loadCatalogLookups()]);
        products = productResponse.items;
        catalog = lookups;
        populateLookups();
        renderTable();
    };

    searchInput.addEventListener("input", renderTable);

    tableRoot.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-product]");
        const deleteButton = event.target.closest("[data-delete-product]");

        if (editButton) {
            const record = products.find((item) => Number(item.id) === Number(editButton.dataset.editProduct));
            if (!record) {
                return;
            }

            currentEditId = record.id;
            formTitle.textContent = "Cập nhật sản phẩm";
            Object.entries(fields).forEach(([key, input]) => {
                if (key === "duong_dan_anh") {
                    input.value = catalog.hinhAnhMap.get(Number(record.id))?.[0]?.duong_dan || "";
                    return;
                }

                input.value = record[key] ?? "";
            });
        }

        if (deleteButton) {
            const recordId = Number(deleteButton.dataset.deleteProduct);
            if (!window.confirm("Xóa sản phẩm này khỏi danh sách?")) {
                return;
            }

            try {
                await sanPhamApi.remove(recordId);
                showToast("Đã xóa sản phẩm.");
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

        const payload = {
            ma_san_pham: fields.ma_san_pham.value.trim(),
            ten: fields.ten.value.trim(),
            danh_muc_id: Number(fields.danh_muc_id.value),
            thuong_hieu_id: Number(fields.thuong_hieu_id.value),
            gia_ban: Number(fields.gia_ban.value || 0),
            gia_giam: fields.gia_giam.value ? Number(fields.gia_giam.value) : null,
            thoi_gian_bao_hanh_thang: Number(fields.thoi_gian_bao_hanh_thang.value || 0),
            mo_ta_ngan: fields.mo_ta_ngan.value.trim(),
            mo_ta_chi_tiet: fields.mo_ta_chi_tiet.value.trim(),
            so_luong_ton: Number(fields.so_luong_ton.value || 0),
            trang_thai: fields.trang_thai.value
        };

        try {
            const record = currentEditId
                ? await sanPhamApi.update(currentEditId, payload)
                : await sanPhamApi.create(payload);

            const duongDanAnh = fields.duong_dan_anh.value.trim();
            if (duongDanAnh) {
                const existingMainImage = catalog.hinhAnhMap.get(Number(record.id))?.[0];
                if (existingMainImage) {
                    await hinhAnhSanPhamApi.update(existingMainImage.id, {
                        ...existingMainImage,
                        duong_dan: duongDanAnh,
                        la_anh_chinh: true,
                        thu_tu: 1
                    });
                } else {
                    await hinhAnhSanPhamApi.create({
                        san_pham_id: record.id,
                        duong_dan: duongDanAnh,
                        la_anh_chinh: true,
                        thu_tu: 1
                    });
                }
            }

            showToast(currentEditId ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.");
            resetForm();
            await loadData();
        } catch (error) {
            showToast(error.message || "Không thể lưu sản phẩm.", "danger");
        }
    });

    await loadData();
    resetForm();
});
