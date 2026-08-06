// ===== AUTH MODULE =====

const Auth = (() => {
    const STORAGE_KEY = "dpl_token";

    function getToken() {
        return localStorage.getItem(STORAGE_KEY) || null;
    }

    function setToken(token) {
        localStorage.setItem(STORAGE_KEY, token);
    }

    function clearToken() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function getStoredUser() {
        const raw = localStorage.getItem("dpl_user");
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    function setStoredUser(user) {
        if (user) {
            localStorage.setItem("dpl_user", JSON.stringify(user));
        } else {
            localStorage.removeItem("dpl_user");
        }
    }

    async function login(username, password) {
        const form = new URLSearchParams();
        form.set("username", username);
        form.set("password", password);

        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString(),
        });

        if (!res.ok) {
            let data = null;
            try { data = await res.json(); } catch (_) {}
            const msg = (data && (data.detail || data.error)) || `Login failed (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        setToken(data.access_token);
        setStoredUser(data.user);
        return data.user;
    }

    async function register(username, password, level) {
        const res = await fetch(`${API_BASE_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, level }),
        });

        if (!res.ok) {
            let data = null;
            try { data = await res.json(); } catch (_) {}
            const msg = (data && (data.detail || data.error)) || `Registration failed (${res.status})`;
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }

        return await res.json();
    }

    async function fetchMe() {
        const res = await fetch(`${API_BASE_URL}/api/me`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${getToken()}`,
            },
        });

        if (!res.ok) {
            logout();
            const err = new Error("Session expired");
            err.status = res.status;
            throw err;
        }

        const data = await res.json();
        setStoredUser(data.user);
        return data.user;
    }

    function logout() {
        clearToken();
        setStoredUser(null);
    }

    function isLoggedIn() {
        return !!getToken();
    }

    return {
        getToken,
        setToken,
        clearToken,
        getStoredUser,
        setStoredUser,
        login,
        register,
        fetchMe,
        logout,
        isLoggedIn,
    };
})();
