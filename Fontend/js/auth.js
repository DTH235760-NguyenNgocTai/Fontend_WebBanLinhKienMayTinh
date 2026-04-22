import { authApi, taiKhoanApi, STORAGE_KEYS, setAuthorizationToken, clearAuthorizationToken } from "./api.js";

function readStoredAccount() {
    const raw = localStorage.getItem(STORAGE_KEYS.currentAccount);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function writeStoredAccount(account) {
    if (!account) {
        localStorage.removeItem(STORAGE_KEYS.currentAccount);
    } else {
        localStorage.setItem(STORAGE_KEYS.currentAccount, JSON.stringify(account));
    }
}

export function getCurrentAccount() {
    return readStoredAccount();
}

export async function syncCurrentAccount() {
    try {
        const currentAccount = await authApi.me();
        const account = currentAccount?.tai_khoan || currentAccount?.user || currentAccount;
        writeStoredAccount(account);
        return account;
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            writeStoredAccount(null);
            clearAuthorizationToken();
            return null;
        }
        return readStoredAccount();
    }
}

export async function login(payload) {
    const response = await authApi.login(payload);

    if (response?.access_token) {
        setAuthorizationToken(response.access_token);
    }

    const tai_khoan = response?.tai_khoan || response?.user || response;

    if (tai_khoan) {
        writeStoredAccount(tai_khoan);
    }
    return tai_khoan;
}

export async function register(payload) {
    const response = await authApi.register(payload);

    if (response?.access_token) {
        setAuthorizationToken(response.access_token);
    }

    const tai_khoan = response?.tai_khoan || response?.user || response;

    if (tai_khoan) {
        writeStoredAccount(tai_khoan);
    }
    return tai_khoan;
}

export async function updateCurrentAccount(id, payload) {
    const updated = await taiKhoanApi.update(id, payload);
    await syncCurrentAccount();
    return updated;
}

export async function logout() {
    try {
        await authApi.logout();
    } catch (error) {
        console.error("Logout error", error);
    } finally {
        writeStoredAccount(null);
        clearAuthorizationToken();
    }
}

export async function isAdmin(account = null) {
    const acc = account || (await syncCurrentAccount());
    if (!acc) return false;
    if (Number(acc.vai_tro_id) === 1) return true;
    const role = (acc.vai_tro?.ten || acc.ten_vai_tro || "").toLowerCase();
    return ["admin", "quan tri", "quan ly"].some((k) => role.includes(k));
}

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const identifier = document.getElementById("login-identifier").value.trim();
            const password = document.getElementById("login-password").value;

            try {
                // Backend maps to ten_dang_nhap
                const account = await login({
                    ten_dang_nhap: identifier,
                    mat_khau: password,
                });

                const { showToast, ROUTES } = await import("./helpers.js");

                const params = new URLSearchParams(window.location.search);
                let redirect = params.get("redirect") || "";

                if (!redirect) {
                    if (await isAdmin(account)) {
                        redirect = ROUTES.admin_dashboard || "/pages/admin/dashboard.html";
                    } else {
                        redirect = ROUTES.home || "/index.html";
                    }
                }

                await showToast("Đăng nhập thành công!", "success");
                window.location.href = redirect;

            } catch (error) {
                import("./helpers.js").then(({ showToast }) => {
                    showToast(error.message || "Tên đăng nhập hoặc mật khẩu không đúng.", "danger");
                });
            }
        });
    }

    const registerForm = document.getElementById("register-form");
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const ho_ten = document.getElementById("register-ho-ten").value.trim();
            const email = document.getElementById("register-email").value.trim();
            const ten_dang_nhap = document.getElementById("register-ten-dang-nhap").value.trim();
            const so_dien_thoai = document.getElementById("register-so-dien-thoai")?.value.trim() || "";
            const gioi_tinh = document.getElementById("register-gioi-tinh")?.value || "";
            const ngay_sinh = document.getElementById("register-ngay-sinh")?.value || "";
            const mat_khau = document.getElementById("register-password").value;
            const mat_khau_confirmation = document.getElementById("register-confirm-password").value;

            try {
                const payload = {
                    ho_ten,
                    email,
                    ten_dang_nhap,
                    mat_khau,
                    mat_khau_confirmation
                };

                if (so_dien_thoai) payload.so_dien_thoai = so_dien_thoai;
                if (gioi_tinh) payload.gioi_tinh = gioi_tinh;
                if (ngay_sinh) payload.ngay_sinh = ngay_sinh;

                const account = await register(payload);

                const { showToast, ROUTES } = await import("./helpers.js");
                await showToast("Đăng ký thành công!", "success");
                window.location.href = ROUTES.home || "/index.html";

            } catch (error) {
                import("./helpers.js").then(({ showToast }) => {
                    showToast(error.message || "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.", "danger");
                });
            }
        });
    }
});
