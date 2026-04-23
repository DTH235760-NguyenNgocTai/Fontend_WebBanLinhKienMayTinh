export const BASE_URL = "http://127.0.0.1:8080/api";

export const STORAGE_KEYS = {
  accessToken: "frontend-linh-kien.access_token",
  currentAccount: "frontend-linh-kien.current_account",
};

export const API_PATHS = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    me: "/auth/me",
    logout: "/auth/logout",
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
  thanh_toan: "/thanh-toan",
};

const DEFAULT_HEADERS = {
  Accept: "application/json",
};

function isFormDataPayload(value) {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function removeHeaderCaseInsensitive(headers, headerName) {
  const targetKey = Object.keys(headers).find(
    (key) => key.toLowerCase() === headerName.toLowerCase(),
  );

  if (targetKey) {
    delete headers[targetKey];
  }
}

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

function buildHeaders(headers = {}, { isFormData = false } = {}) {
  const authToken = getAuthorizationToken();
  const mergedHeaders = {
    ...DEFAULT_HEADERS,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...headers,
  };

  if (isFormData) {
    removeHeaderCaseInsensitive(mergedHeaders, "Content-Type");
    return mergedHeaders;
  }

  if (
    !Object.keys(mergedHeaders).some(
      (key) => key.toLowerCase() === "content-type",
    )
  ) {
    mergedHeaders["Content-Type"] = "application/json";
  }

  return mergedHeaders;
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
    "Không thể kết nối dữ liệu.";

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
    credentials = "omit",
    ...restOptions
  } = options;
  const requestBody = body ?? data;
  const isFormData = isFormDataPayload(requestBody);
  const serializedBody =
    requestBody === undefined
      ? undefined
      : isFormData
        ? requestBody
        : body !== undefined
          ? body
          : JSON.stringify(data);

  const response = await fetch(resolveUrl(url, params), {
    method,
    credentials,
    headers: buildHeaders(headers, { isFormData }),
    body: serializedBody,
    ...restOptions,
  });

  const payload = await parseResponseBody(response);

  if (response.redirected && !response.url.startsWith(BASE_URL)) {
    throw createApiError(response, {
      message:
        "Yêu cầu dữ liệu bị chuyển hướng sai. Backend có thể chưa cấu hình đúng route API.",
    });
  }

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

export async function apiPostMultipart(url, formData, options = {}) {
  return request("POST", url, { ...options, body: formData });
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
  const items = Array.isArray(unwrapped)
    ? unwrapped
    : Array.isArray(unwrapped?.items)
      ? unwrapped.items
      : Array.isArray(unwrapped?.danh_sach)
        ? unwrapped.danh_sach
        : Array.isArray(unwrapped?.records)
          ? unwrapped.records
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.danh_sach)
              ? payload.danh_sach
              : [];

  const pagination =
    unwrapped?.phan_trang ||
    unwrapped?.pagination ||
    payload?.phan_trang ||
    payload?.pagination ||
    null;

  return {
    items,
    pagination,
    raw: payload,
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

function filterItemsLocally(items = [], filters = {}) {
  return items.filter((item) =>
    Object.entries(filters).every(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return true;
      }

      return Number(item?.[key]) === Number(value);
    }),
  );
}

function readPaginationNumber(pagination = {}, keys = []) {
  for (const key of keys) {
    const numericValue = Number(pagination?.[key]);
    if (Number.isFinite(numericValue) && numericValue > 0) {
      return numericValue;
    }
  }

  return 0;
}

async function fetchAllPages(path, params = {}) {
  const firstResponse = normalizeCollectionResponse(
    await apiGet(path, {
      params,
    }),
  );

  const items = Array.isArray(firstResponse.items) ? [...firstResponse.items] : [];
  const firstPagination = firstResponse.pagination || {};
  const totalPages = readPaginationNumber(firstPagination, [
    "last_page",
    "lastPage",
    "total_pages",
    "totalPages",
    "so_trang",
  ]);
  const totalItems = readPaginationNumber(firstPagination, [
    "total",
    "total_items",
    "totalItems",
    "tong_so_phan_tu",
    "tong_so_ban_ghi",
  ]);

  if ((!totalPages || totalPages <= 1) && (!totalItems || items.length >= totalItems)) {
    return firstResponse;
  }

  let currentPage = readPaginationNumber(firstPagination, [
    "current_page",
    "currentPage",
    "page",
    "trang_hien_tai",
  ]);

  currentPage = currentPage || 1;

  while ((!totalPages || currentPage < totalPages) && (!totalItems || items.length < totalItems)) {
    currentPage += 1;

    const pageResponse = normalizeCollectionResponse(
      await apiGet(path, {
        params: {
          ...params,
          page: currentPage,
        },
      }),
    );
    const pageItems = Array.isArray(pageResponse.items) ? pageResponse.items : [];

    if (!pageItems.length) {
      break;
    }

    items.push(...pageItems);
  }

  return {
    ...firstResponse,
    items,
  };
}

function createCrudResource(path) {
  return {
    async list(params = {}) {
      return normalizeCollectionResponse(await apiGet(path, { params }));
    },
    async listAll(params = {}) {
      return fetchAllPages(path, params);
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
    },
  };
}

export const danhMucApi = createCrudResource(API_PATHS.danh_muc);
export const thuongHieuApi = createCrudResource(API_PATHS.thuong_hieu);
export const vaiTroApi = createCrudResource(API_PATHS.vai_tro);
export const taiKhoanApi = createCrudResource(API_PATHS.tai_khoan);
const changePasswordEndpoints = [
  `${API_PATHS.tai_khoan}/doi-mat-khau`,
  `${API_PATHS.tai_khoan}/change-password`,
  "/doi-mat-khau",
  "/change-password",
];

async function postChangePassword(payload) {
  let lastError = null;

  for (const endpoint of changePasswordEndpoints) {
    try {
      return normalizeRecordResponse(await apiPost(endpoint, payload));
    } catch (error) {
      lastError = error;

      if (![404, 405].includes(Number(error?.status || 0))) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Không thể đổi mật khẩu lúc này.");
}

Object.assign(taiKhoanApi, {
  async changePassword(payload) {
    return postChangePassword(payload);
  },
});
export const sanPhamApi = {
  ...createCrudResource(API_PATHS.san_pham),
  async listAll(params = {}) {
    return fetchAllPages(API_PATHS.san_pham, params);
  },
};
export const hinhAnhSanPhamApi = createCrudResource(
  API_PATHS.hinh_anh_san_pham,
);
export const diaChiGiaoHangApi = {
  ...createCrudResource(API_PATHS.dia_chi_giao_hang),
  async listByCustomer(tai_khoan_id) {
    const response = await this.listAll();

    return {
      ...response,
      items: filterItemsLocally(response.items, { tai_khoan_id }),
    };
  },
};
export const donHangApi = {
  ...createCrudResource(API_PATHS.don_hang),
  async listByCustomer(tai_khoan_id) {
    const response = await this.listAll();

    return {
      ...response,
      items: filterItemsLocally(response.items, { tai_khoan_id }),
    };
  },
  async checkout(payload) {
    return normalizeRecordResponse(
      await apiPost(`${API_PATHS.don_hang}/checkout`, payload),
    );
  },
};
export const chiTietDonHangApi = {
  ...createCrudResource(API_PATHS.chi_tiet_don_hang),
  async listByOrder(don_hang_id) {
    const response = await this.listAll();

    return {
      ...response,
      items: filterItemsLocally(response.items, { don_hang_id }),
    };
  },
};
export const thanhToanApi = {
  ...createCrudResource(API_PATHS.thanh_toan),
  async listByOrder(don_hang_id) {
    const response = await this.listAll();

    return {
      ...response,
      items: filterItemsLocally(response.items, { don_hang_id }),
    };
  },
};

export const authApi = {
  async login(payload) {
    return apiPost(API_PATHS.auth.login, payload);
  },
  async register(payload) {
    return apiPost(API_PATHS.auth.register, payload);
  },
  async logout() {
    return apiPost(API_PATHS.auth.logout);
  },
  async me() {
    try {
      return normalizeRecordResponse(await apiGet(API_PATHS.auth.me));
    } catch (error) {
      if (error.status === 404) {
        return normalizeRecordResponse(
          await apiGet(`${API_PATHS.tai_khoan}/me`),
        );
      }

      throw error;
    }
  },
};

export const gioHangApi = {
  async getCurrent() {
    const response = await createCrudResource(API_PATHS.gio_hang).listAll();
    return response.items[0] || null;
  },
  async create(payload = {}) {
    return normalizeRecordResponse(await apiPost(API_PATHS.gio_hang, payload));
  },
  async ensureCurrent(payload = {}) {
    const response = await createCrudResource(API_PATHS.gio_hang).listAll();
    const currentCart = payload?.tai_khoan_id
      ? response.items.find(
          (item) =>
            Number(item.tai_khoan_id) === Number(payload.tai_khoan_id),
        ) || null
      : response.items[0] || null;

    if (currentCart) {
      return currentCart;
    }

    return this.create(payload);
  },
  async getDetails(params = {}) {
    const response = await createCrudResource(API_PATHS.chi_tiet_gio_hang).listAll();

    return {
      ...response,
      items: filterItemsLocally(response.items, params),
    };
  },
  async getCurrentWithDetails(createPayload = {}) {
    const gio_hang = await this.ensureCurrent(createPayload);
    const directItems = Array.isArray(gio_hang?.chi_tiet_gio_hang)
      ? gio_hang.chi_tiet_gio_hang
      : [];

    if (directItems.length) {
      return { gio_hang, chi_tiet_gio_hang: directItems };
    }

    const detailResponse = await this.getDetails({ gio_hang_id: gio_hang.id });
    return {
      gio_hang,
      chi_tiet_gio_hang: detailResponse.items,
    };
  },
  async addItem(payload) {
    return normalizeRecordResponse(
      await apiPost(API_PATHS.chi_tiet_gio_hang, payload),
    );
  },
  async updateItem(id, payload) {
    return normalizeRecordResponse(
      await apiPut(`${API_PATHS.chi_tiet_gio_hang}/${id}`, payload),
    );
  },
  async removeItem(id) {
    return apiDelete(`${API_PATHS.chi_tiet_gio_hang}/${id}`);
  },
  async addProduct({
    gio_hang_id,
    san_pham_id,
    so_luong,
    don_gia,
    maxQuantity = 0,
  }) {
    const requestedQuantity = Math.max(Number(so_luong || 0), 0);
    const stockLimit = Math.max(Number(maxQuantity || 0), 0);
    const detailResponse = await this.getDetails({ gio_hang_id });
    const currentItem = detailResponse.items.find(
      (item) => Number(item.san_pham_id) === Number(san_pham_id),
    );
    const currentQuantity = Number(currentItem?.so_luong || 0);
    const nextQuantity = currentQuantity + requestedQuantity;

    if (stockLimit > 0 && nextQuantity > stockLimit) {
      throw new Error(`Số lượng vượt quá tồn kho hiện có (${stockLimit}).`);
    }

    if (currentItem) {
      return this.updateItem(currentItem.id, {
        gio_hang_id,
        san_pham_id,
        so_luong: nextQuantity,
        don_gia,
      });
    }

    return this.addItem({
      gio_hang_id,
      san_pham_id,
      so_luong: requestedQuantity,
      don_gia,
    });
  },
};
