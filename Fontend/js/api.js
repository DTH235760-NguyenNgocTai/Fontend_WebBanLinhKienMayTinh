export const BASE_URL = "http://localhost:5000/api";

export const STORAGE_KEYS = {
    accessToken: "frontend-linh-kien.access_token",
    currentAccount: "frontend-linh-kien.current_account"
};

export const API_PATHS = {
    auth: {
        login: "/auth/login",
        register: "/auth/register",
        me: "/auth/me"
    },
    tai_khoan: "/tai-khoan",
    vai_tro: "/vai-tro",
    danh_muc: "/danh-muc",
    thuong_hieu: "/thuong-hieu",
    san_pham: "/san-pham",
    hinh_anh_san_pham: "/hinh-anh-san-pham",
    gio_hang: "/gio-hang",
    chi_tiet_gio_hang: "/chi-tiet-gio-hang",
    dia_chi_giao_hang: "/dia-chi-giao-hang",
    don_hang: "/don-hang",
    chi_tiet_don_hang: "/chi-tiet-don-hang",
    thanh_toan: "/thanh-toan"
};

const DEFAULT_HEADERS = {
    Accept: "application/json",
    "Content-Type": "application/json"
};

function buildQueryString(params = {}) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => searchParams.append(key, item));
            return;
        }

        searchParams.set(key, value);
    });

    return searchParams.toString();
}

function resolveUrl(url, params) {
    const queryString = buildQueryString(params);
    const absoluteUrl = /^https?:\/\//i.test(url) ? url : `${BASE_URL}${url}`;
    return queryString ? `${absoluteUrl}?${queryString}` : absoluteUrl;
}

export function getAuthorizationToken() {
    return localStorage.getItem(STORAGE_KEYS.accessToken) || "";
}

export function setAuthorizationToken(token) {
    if (!token) {
        localStorage.removeItem(STORAGE_KEYS.accessToken);
        return;
    }

    localStorage.setItem(STORAGE_KEYS.accessToken, token);
}

export function clearAuthorizationToken() {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
}

function buildHeaders(headers = {}) {
    const authToken = getAuthorizationToken();
    return {
        ...DEFAULT_HEADERS,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers
    };
}

async function parseResponseBody(response) {
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return response.json();
    }

    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        return text;
    }
}

function createApiError(response, payload) {
    const message =
        payload?.message ||
        payload?.error ||
        payload?.loi ||
        payload?.du_lieu?.message ||
        "Không thể kết nối API.";

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    return error;
}

async function request(method, url, options = {}) {
    const {
        params,
        data,
        headers = {},
        body,
        credentials = "include",
        ...restOptions
    } = options;

    const response = await fetch(resolveUrl(url, params), {
        method,
        credentials,
        headers: buildHeaders(headers),
        body: body ?? (data !== undefined ? JSON.stringify(data) : undefined),
        ...restOptions
    });

    const payload = await parseResponseBody(response);

    if (!response.ok) {
        throw createApiError(response, payload);
    }

    return payload;
}

export async function apiGet(url, options = {}) {
    return request("GET", url, options);
}

export async function apiPost(url, data, options = {}) {
    return request("POST", url, { ...options, data });
}

export async function apiPut(url, data, options = {}) {
    return request("PUT", url, { ...options, data });
}

export async function apiDelete(url, options = {}) {
    return request("DELETE", url, options);
}

export function unwrapData(payload) {
    if (payload === null || payload === undefined) {
        return payload;
    }

    if (payload.du_lieu !== undefined) {
        return payload.du_lieu;
    }

    if (payload.data !== undefined) {
        return payload.data;
    }

    return payload;
}

export function normalizeCollectionResponse(payload) {
    const unwrapped = unwrapData(payload);
    const items =
        Array.isArray(unwrapped) ? unwrapped :
        Array.isArray(unwrapped?.items) ? unwrapped.items :
        Array.isArray(unwrapped?.danh_sach) ? unwrapped.danh_sach :
        Array.isArray(unwrapped?.records) ? unwrapped.records :
        Array.isArray(payload?.items) ? payload.items :
        Array.isArray(payload?.danh_sach) ? payload.danh_sach :
        [];

    const pagination =
        unwrapped?.phan_trang ||
        unwrapped?.pagination ||
        payload?.phan_trang ||
        payload?.pagination ||
        null;

    return {
        items,
        pagination,
        raw: payload
    };
}

export function normalizeRecordResponse(payload) {
    const unwrapped = unwrapData(payload);

    if (Array.isArray(unwrapped)) {
        return unwrapped[0] || null;
    }

    if (unwrapped?.ban_ghi) {
        return unwrapped.ban_ghi;
    }

    if (unwrapped?.item) {
        return unwrapped.item;
    }

    return unwrapped || null;
}

function createCrudResource(path) {
    return {
        async list(params = {}) {
            return normalizeCollectionResponse(await apiGet(path, { params }));
        },
        async get(id, params = {}) {
            return normalizeRecordResponse(await apiGet(`${path}/${id}`, { params }));
        },
        async create(payload) {
            return normalizeRecordResponse(await apiPost(path, payload));
        },
        async update(id, payload) {
            return normalizeRecordResponse(await apiPut(`${path}/${id}`, payload));
        },
        async remove(id) {
            return apiDelete(`${path}/${id}`);
        }
    };
}

export const danhMucApi = createCrudResource(API_PATHS.danh_muc);
export const thuongHieuApi = createCrudResource(API_PATHS.thuong_hieu);
export const vaiTroApi = createCrudResource(API_PATHS.vai_tro);
export const taiKhoanApi = createCrudResource(API_PATHS.tai_khoan);
export const sanPhamApi = createCrudResource(API_PATHS.san_pham);
export const hinhAnhSanPhamApi = createCrudResource(API_PATHS.hinh_anh_san_pham);
export const diaChiGiaoHangApi = createCrudResource(API_PATHS.dia_chi_giao_hang);
export const donHangApi = createCrudResource(API_PATHS.don_hang);
export const chiTietDonHangApi = createCrudResource(API_PATHS.chi_tiet_don_hang);
export const thanhToanApi = createCrudResource(API_PATHS.thanh_toan);

export const authApi = {
    async login(payload) {
        return apiPost(API_PATHS.auth.login, payload);
    },
    async register(payload) {
        return apiPost(API_PATHS.auth.register, payload);
    },
    async me() {
        try {
            return normalizeRecordResponse(await apiGet(API_PATHS.auth.me));
        } catch (error) {
            if (error.status === 404) {
                return normalizeRecordResponse(await apiGet(`${API_PATHS.tai_khoan}/me`));
            }

            throw error;
        }
    }
};

export const gioHangApi = {
    async getCurrent() {
        return normalizeRecordResponse(await apiGet(API_PATHS.gio_hang));
    },
    async create(payload = {}) {
        return normalizeRecordResponse(await apiPost(API_PATHS.gio_hang, payload));
    },
    async ensureCurrent(payload = {}) {
        const currentCart = await this.getCurrent();
        if (currentCart) {
            return currentCart;
        }

        return this.create(payload);
    },
    async getDetails(params = {}) {
        return normalizeCollectionResponse(await apiGet(API_PATHS.chi_tiet_gio_hang, { params }));
    },
    async getCurrentWithDetails(createPayload = {}) {
        const gio_hang = await this.ensureCurrent(createPayload);
        const directItems = Array.isArray(gio_hang?.chi_tiet_gio_hang) ? gio_hang.chi_tiet_gio_hang : [];

        if (directItems.length) {
            return { gio_hang, chi_tiet_gio_hang: directItems };
        }

        const detailResponse = await this.getDetails({ gio_hang_id: gio_hang.id });
        return {
            gio_hang,
            chi_tiet_gio_hang: detailResponse.items
        };
    },
    async addItem(payload) {
        return normalizeRecordResponse(await apiPost(API_PATHS.chi_tiet_gio_hang, payload));
    },
    async updateItem(id, payload) {
        return normalizeRecordResponse(await apiPut(`${API_PATHS.chi_tiet_gio_hang}/${id}`, payload));
    },
    async removeItem(id) {
        return apiDelete(`${API_PATHS.chi_tiet_gio_hang}/${id}`);
    },
    async addProduct({ gio_hang_id, san_pham_id, so_luong, don_gia }) {
        const detailResponse = await this.getDetails({ gio_hang_id });
        const currentItem = detailResponse.items.find(
            (item) => Number(item.san_pham_id) === Number(san_pham_id)
        );

        if (currentItem) {
            return this.updateItem(currentItem.id, {
                gio_hang_id,
                san_pham_id,
                so_luong: Number(currentItem.so_luong || 0) + Number(so_luong || 0),
                don_gia
            });
        }

        return this.addItem({
            gio_hang_id,
            san_pham_id,
            so_luong,
            don_gia
        });
    }
};
