import {
    authApi,
    clearAuthorizationToken,
    getAuthorizationToken,
    setAuthorizationToken,
    STORAGE_KEYS,
    taiKhoanApi,
    vaiTroApi
} from "./api.js";

function readStoredAccount() {
    const raw = localStorage.getItem(STORAGE_KEYS.currentAccount);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
}

function writeStoredAccount(account) {
    if (!account) {
        localStorage.removeItem(STORAGE_KEYS.currentAccount);
        return;
    }

    localStorage.setItem(STORAGE_KEYS.currentAccount, JSON.stringify(account));
}

function unpackAuthPayload(payload) {
    const source = payload?.du_lieu || payload?.data || payload || {};

    return {
        token: source.token || source.access_token || source.jwt || "",
        tai_khoan:
            source.tai_khoan ||
            source.current_account ||
            source.user ||
            source.account ||
            (source.id ? source : null)
    };
}

function normalizeText(value = "") {
    return value
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

export function getStoredAccount() {
    return readStoredAccount();
}

export function saveStoredAccount(account) {
    writeStoredAccount(account);
}

export function clearSession() {
    clearAuthorizationToken();
    writeStoredAccount(null);
}

export async function syncCurrentAccount() {
    const token = getAuthorizationToken();

    if (!token) {
        return readStoredAccount();
    }

    try {
        const currentAccount = await authApi.me();
        writeStoredAccount(currentAccount);
        return currentAccount;
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            clearSession();
            return null;
        }

        return readStoredAccount();
    }
}

export async function login(payload) {
    const response = await authApi.login(payload);
    const { token, tai_khoan } = unpackAuthPayload(response);

    if (token) {
        setAuthorizationToken(token);
    }

    if (tai_khoan) {
        writeStoredAccount(tai_khoan);
    }

    const currentAccount = tai_khoan || (token ? await syncCurrentAccount() : null);
    return currentAccount;
}

export async function register(payload) {
    const response = await authApi.register(payload);
    const { token, tai_khoan } = unpackAuthPayload(response);

    if (token) {
        setAuthorizationToken(token);
    }

    if (tai_khoan) {
        writeStoredAccount(tai_khoan);
    }

    return tai_khoan || null;
}

export async function logout() {
    clearSession();
    return true;
}

export async function isAuthenticated() {
    const currentAccount = await syncCurrentAccount();
    return Boolean(currentAccount);
}

export async function getRoleName(account = null) {
    const currentAccount = account || (await syncCurrentAccount());

    if (!currentAccount) {
        return "";
    }

    const directRoleName =
        currentAccount.vai_tro?.ten ||
        currentAccount.ten_vai_tro ||
        currentAccount.vai_tro_ten ||
        currentAccount.role_name ||
        "";

    if (directRoleName) {
        return directRoleName;
    }

    if (!currentAccount.vai_tro_id) {
        return "";
    }

    try {
        const role = await vaiTroApi.get(currentAccount.vai_tro_id);
        return role?.ten || "";
    } catch (error) {
        return "";
    }
}

export async function isAdmin(account = null) {
    const roleName = normalizeText(await getRoleName(account));
    return ["admin", "quan tri", "quan_ly", "quan ly", "quan_ly_ban_hang", "quan ly ban hang"].some((keyword) =>
        roleName.includes(keyword)
    );
}

export async function getCurrentAccount() {
    return syncCurrentAccount();
}

export async function updateCurrentAccount(id, payload) {
    const updatedAccount = await taiKhoanApi.update(id, payload);
    writeStoredAccount(updatedAccount);
    return updatedAccount;
}

export function getLoginRedirectByRole(account, fallbackUserUrl, fallbackAdminUrl) {
    const directRoleName = normalizeText(
        account?.vai_tro?.ten || account?.ten_vai_tro || account?.vai_tro_ten || ""
    );

    if (["admin", "quan tri", "quan_ly", "quan ly", "quan_ly_ban_hang", "quan ly ban hang"].some((keyword) =>
        directRoleName.includes(keyword)
    )) {
        return fallbackAdminUrl;
    }

    return fallbackUserUrl;
}

async function initializeAuthPages() {
    const page = document.body?.dataset.page || "";
    if (page !== "login" && page !== "register") {
        return;
    }

    const helpers = await import("./helpers.js");
    const currentAccount = await getCurrentAccount();
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");

    await helpers.initializeLayout({ currentPage: page, area: "user" });

    if (currentAccount) {
        const nextUrl = (await isAdmin(currentAccount)) ? helpers.ROUTES.admin_dashboard : (redirectParam || helpers.ROUTES.tai_khoan);
        window.location.href = nextUrl;
        return;
    }

    document.getElementById("login-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const account = await login({
                tai_khoan: document.getElementById("login-identifier").value.trim(),
                mat_khau: document.getElementById("login-password").value
            });
            const nextUrl = (await isAdmin(account)) ? helpers.ROUTES.admin_dashboard : (redirectParam || helpers.ROUTES.tai_khoan);
            helpers.showToast("Đăng nhập thành công.");
            setTimeout(() => {
                window.location.href = nextUrl;
            }, 250);
        } catch (error) {
            helpers.showToast(error.message || "Không thể đăng nhập.", "danger");
        }
    });

    document.getElementById("register-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const matKhau = document.getElementById("register-password").value;
        const xacNhanMatKhau = document.getElementById("register-confirm-password").value;

        if (matKhau !== xacNhanMatKhau) {
            helpers.showToast("Mật khẩu xác nhận chưa khớp.", "warning");
            return;
        }

        try {
            await register({
                email: document.getElementById("register-email").value.trim(),
                ten_dang_nhap: document.getElementById("register-ten-dang-nhap").value.trim(),
                mat_khau: matKhau,
                ho_ten: document.getElementById("register-ho-ten").value.trim(),
                gioi_tinh: document.getElementById("register-gioi-tinh").value || null,
                ngay_sinh: document.getElementById("register-ngay-sinh").value || null,
                so_dien_thoai: document.getElementById("register-so-dien-thoai").value.trim() || null
            });

            helpers.showToast("Đăng ký thành công. Mời bạn đăng nhập.");
            setTimeout(() => {
                window.location.href = helpers.ROUTES.login;
            }, 250);
        } catch (error) {
            helpers.showToast(error.message || "Không thể đăng ký.", "danger");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeAuthPages();
});
