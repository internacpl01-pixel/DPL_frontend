// ===== API CLIENT =====

const Api = (() => {
    function buildUrl(path) {
        const base = API_BASE_URL.replace(/\/+$/, "");
        return `${base}/api${path.startsWith("/") ? path : "/" + path}`;
    }

    async function request(path, options = {}) {
        const url = buildUrl(path);
        const headers = new Headers();
        headers.set("Content-Type", "application/json");

        const token = Auth.getToken();
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }

        if (options.headers) {
            const extra = new Headers(options.headers);
            extra.forEach((value, key) => headers.set(key, value));
        }

        const config = { ...options, headers };
        if (config.body && typeof config.body !== "string") {
            config.body = JSON.stringify(config.body);
        }
        if (config.body === undefined) {
            delete config.body;
        }

        const res = await fetch(url, config);

        let data = null;
        try {
            data = await res.json();
        } catch (_) {
            data = null;
        }

        if (!res.ok) {
            const detail = data && (data.detail || data.error) ? (data.detail || data.error) : `Request failed (${res.status})`;
            const err = new Error(detail);
            err.status = res.status;
            throw err;
        }

        return data;
    }

    return {
        get: (path) => request(path, { method: "GET" }),
        post: (path, body) => request(path, { method: "POST", body }),
        put: (path, body) => request(path, { method: "PUT", body }),
        patch: (path, body) => request(path, { method: "PATCH", body }),
        delete: (path, body) => {
            const opts = { method: "DELETE" };
            if (body) {
                opts.body = JSON.stringify(body);
                opts.headers = { "Content-Type": "application/json" };
            }
            return request(path, opts);
        },
    };
})();
