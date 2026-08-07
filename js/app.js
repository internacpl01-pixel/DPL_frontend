// ===== DPL Data Bank - App Entry Point =====

const App = (() => {
    let currentSection = null;

    // ===== MENU CONFIG =====
    const MENU = [
        { id: 1, label: "Dashboard", section: "dashboard", minLevel: 0, icon: "📊" },
        { id: 2, label: "Field Mappings", section: "field-mappings", minLevel: 0, icon: "📝" },
        { id: 3, label: "Table Structure", section: "table-structure", minLevel: 0, icon: "📋" },
        { id: 4, label: "Change Log", section: "change-log", minLevel: 1, icon: "📒" },
        { id: 5, label: "Custom Fields", section: "custom-fields", minLevel: 1, icon: "➕" },
        { id: 6, label: "Users", section: "users", minLevel: 1, icon: "👥" },
    ];

    const LEVEL_NAMES = { 0: "Staff", 1: "Manager", 2: "Admin" };

    // ===== UTILITIES =====
    function escapeHtml(s) {
        if (s === null || s === undefined) return "";
        return String(s)
            .replace(/&/g, "&amp;").replace(/</g, "&lt;")
            .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function spinner() {
        return `<div class="loading-container"><div class="spinner"></div><p>Loading...</p></div>`;
    }

    function emptyState(msg) {
        return `<div class="empty-state"><p>${escapeHtml(msg)}</p></div>`;
    }

    // ===== TOAST =====
    function toast(message, type = "info") {
        const container = document.getElementById("toast-container");
        if (!container) return;
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
    }

    // ===== MODAL =====
    function showModal(title, bodyHtml, actions, onAction) {
        const overlay = document.getElementById("modal-container");
        const titleEl = document.getElementById("modal-title");
        const bodyEl = document.getElementById("modal-body");
        const actionsEl = document.getElementById("modal-actions");
        if (!overlay) return;
        titleEl.textContent = title;
        bodyEl.innerHTML = bodyHtml;
        actionsEl.innerHTML = "";
        actions.forEach(act => {
            const btn = document.createElement("button");
            btn.className = `btn ${act.class || "btn-secondary"}`;
            btn.textContent = act.text;
            btn.addEventListener("click", async () => { if (onAction) await onAction(act.action); });
            actionsEl.appendChild(btn);
        });
        overlay.classList.add("active");
    }

    function closeModal() {
        const overlay = document.getElementById("modal-container");
        if (overlay) overlay.classList.remove("active");
    }

    // ===== TITLE =====
    function setTitle(title) {
        const el = document.getElementById("page-title");
        if (el) el.textContent = title;
    }

    // ===== ERROR HANDLING =====
    function handleApiError(err) {
        const status = err.status;
        if (status === 401) {
            toast("Session expired. Please login again.", "error");
            Auth.logout();
            showLoginPage();
            return;
        }
        if (status === 403) toast("You do not have permission.", "error");
        else if (status === 404) toast("Resource not found.", "error");
        else if (status === 422) toast("Invalid data. Please check your input.", "error");
        else if (status >= 500) toast("Server error. Please try again later.", "error");
        else toast(err.message, "error");
    }

    // ===== PAGE VISIBILITY =====
    function showLoginPage() {
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        const loginPage = document.getElementById("login-page");
        if (loginPage) loginPage.classList.add("active");
        setTitle("Login");
        closeSidebar();
    }

    function showDashboard() {
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        const dash = document.getElementById("dashboard-page");
        if (dash) dash.classList.add("active");
        setTitle("Dashboard");
    }

    function closeSidebar() {
        const sidebar = document.getElementById("sidebar");
        const backdrop = document.getElementById("sidebar-backdrop");
        if (sidebar) sidebar.classList.remove("open");
        if (backdrop) backdrop.classList.remove("active");
    }

    // ===== SIDEBAR RENDERING =====
    function renderSidebar() {
        const user = Auth.getStoredUser();
        if (!user) return;

        const userLevel = user.access_level ?? user.level ?? 0;

        document.getElementById("user-name").textContent = user.username;
        const badge = document.getElementById("user-level-badge");
        badge.textContent = LEVEL_NAMES[userLevel] || "Unknown";

        const topbarUser = document.getElementById("topbar-user");
        if (topbarUser) topbarUser.textContent = `${user.username} (${LEVEL_NAMES[userLevel]})`;

        const menuEl = document.getElementById("sidebar-menu");
        menuEl.innerHTML = "";

        MENU.forEach(item => {
            if (userLevel < item.minLevel) return;
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = `#${item.section}`;
            a.textContent = `${item.icon} ${item.label}`;
            a.dataset.section = item.section;
            a.addEventListener("click", (e) => {
                e.preventDefault();
                loadPage(item.section);
                closeSidebar();
            });
            li.appendChild(a);
            menuEl.appendChild(li);
        });

        setActiveMenu(window.location.hash.replace('#', '') || 'dashboard');
    }

    function setActiveMenu(sectionId) {
        document.querySelectorAll('#sidebar-menu a').forEach(a => a.classList.remove("active"));
        const link = document.querySelector(`#sidebar-menu a[data-section="${sectionId}"]`);
        if (link) link.classList.add("active");
    }

    // ===== PAGE LOADING =====
    async function loadPage(sectionId) {
        if (!sectionId) sectionId = 'dashboard';
        setActiveMenu(sectionId);

        // Check auth
        if (!Auth.isLoggedIn()) {
            showLoginPage();
            return;
        }

        // Check permission
        const user = Auth.getStoredUser();
        const userLevel = user ? (user.access_level ?? user.level ?? 0) : 0;
        const menuItem = MENU.find(m => m.section === sectionId);
        if (menuItem && userLevel < menuItem.minLevel) {
            document.getElementById("page-content").innerHTML =
                `<div class="empty-state"><p>You do not have permission to access this page.</p></div>`;
            return;
        }

        const container = document.getElementById("page-content");
        if (!container) return;

        // Route to handler
        switch (sectionId) {
            case 'dashboard':
                await loadDashboard(container);
                break;
            case 'field-mappings':
                await loadModulePage('./mapping.js', container);
                break;
            case 'table-structure':
                await loadModulePage('./table.js', container);
                break;
            case 'change-log':
                await loadModulePage('./logs.js', container);
                break;
            case 'custom-fields':
                await loadModulePage('./customfields.js', container);
                break;
            case 'users':
                await loadModulePage('./users.js', container);
                break;
            case 'register':
                showRegisterPage(container);
                break;
            default:
                container.innerHTML = `<div class="empty-state"><p>Page not found.</p></div>`;
        }
    }

    async function loadModulePage(modulePath, container) {
        container.innerHTML = spinner();
        try {
            const module = await import(modulePath);
            if (module && module.load) {
                await module.load();
            }
        } catch (err) {
            container.innerHTML = `<div class="error-state">
                <h2>Error Loading Page</h2>
                <p>${escapeHtml(err.message)}</p>
                <button class="btn btn-primary" onclick="location.reload()">Retry</button>
            </div>`;
        }
    }

    async function loadDashboard(container) {
        try {
            const data = await Api.getMe();
            const userLevel = data.access_level ?? data.level ?? 0;
            const levelName = LEVEL_NAMES[userLevel] || 'Unknown';

            container.innerHTML = `
                <div class="dashboard-cards">
                    <div class="stat-card">
                        <div class="stat-icon">👤</div>
                        <div class="stat-info">
                            <h3>Username</h3>
                            <p class="stat-value">${escapeHtml(data.username)}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">🔑</div>
                        <div class="stat-info">
                            <h3>Role</h3>
                            <p class="stat-value">${escapeHtml(levelName)}</p>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon">📊</div>
                        <div class="stat-info">
                            <h3>System</h3>
                            <p class="stat-value">Online</p>
                        </div>
                    </div>
                </div>
                <div class="card">
                    <h3>Welcome to DPL Data Bank</h3>
                    <p>You are logged in as <strong>${escapeHtml(data.username)}</strong> with <strong>${escapeHtml(levelName)}</strong> access level.</p>
                    <div class="quick-actions">
                        <p class="section-desc">Quick Actions:</p>
                        <div class="action-buttons">
                            <a href="#field-mappings" class="btn btn-primary">Manage Field Mappings</a>
                            <a href="#table-structure" class="btn btn-secondary">View Table Structure</a>
                            ${userLevel >= 1 ? '<a href="#custom-fields" class="btn btn-secondary">Add Custom Field</a>' : ''}
                            ${userLevel >= 1 ? '<a href="#users" class="btn btn-secondary">Manage Users</a>' : ''}
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = `<div class="error-state"><h2>Error Loading Dashboard</h2><p>${escapeHtml(err.message)}</p></div>`;
        }
    }

    function showRegisterPage(container) {
        container.innerHTML = `
            <div class="auth-container">
                <div class="auth-box">
                    <h2 class="auth-title">Create Account</h2>
                    <p class="auth-subtitle">Register a new user account</p>
                    <form id="register-form" class="auth-form">
                        <div class="form-group">
                            <label for="reg-username">Username</label>
                            <input type="text" id="reg-username" class="form-control" placeholder="Enter username" minlength="3" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-password">Password</label>
                            <input type="password" id="reg-password" class="form-control" placeholder="Enter password" minlength="4" required>
                        </div>
                        <div class="form-group">
                            <label for="reg-level">Access Level</label>
                            <select id="reg-level" class="form-control">
                                <option value="0">Staff</option>
                                <option value="1">Manager</option>
                                <option value="2">Admin</option>
                            </select>
                        </div>
                        <div id="reg-error" class="error-msg hidden"></div>
                        <button type="submit" class="btn btn-primary auth-btn">Register</button>
                        <p class="auth-footer">Already have an account? <a href="#login">Login here</a></p>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('reg-username').value.trim();
            const password = document.getElementById('reg-password').value;
            const accessLevel = parseInt(document.getElementById('reg-level').value);
            const errEl = document.getElementById('reg-error');
            errEl.classList.add('hidden');

            try {
                const result = await Auth.register(username, password, accessLevel);
                toast(result.message || 'Registration successful!', 'success');
                window.location.hash = 'login';
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        });
    }

    // ===== AUTH FLOW =====
    async function enterDashboard() {
        showDashboard();
        renderSidebar();
        await loadPage('dashboard');
    }

    async function checkSession() {
        if (!Auth.isLoggedIn()) {
            showLoginPage();
            return;
        }
        try {
            await Auth.fetchMe();
            await enterDashboard();
        } catch (err) {
            await Auth.logout();
            showLoginPage();
        }
    }

    // ===== BOOTSTRAP =====
    async function bootstrap() {
        // Modal close on backdrop
        document.getElementById("modal-container").addEventListener("click", (e) => {
            if (e.target.id === "modal-container") closeModal();
        });

        // Login form
        document.getElementById("login-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value;
            const errEl = document.getElementById("login-error");
            errEl.classList.add("hidden");

            const btn = document.getElementById("btn-login");
            btn.disabled = true;
            btn.textContent = "Logging in...";

            try {
                await Auth.login(username, password);
                errEl.classList.add("hidden");
                await enterDashboard();
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove("hidden");
            } finally {
                btn.disabled = false;
                btn.textContent = "Login";
            }
        });

        // Logout
        document.getElementById("btn-logout").addEventListener("click", async () => {
            await Auth.logout();
            showLoginPage();
            document.getElementById("login-form").reset();
        });

        // Sidebar toggle (mobile)
        document.getElementById("btn-sidebar-toggle").addEventListener("click", () => {
            const sidebar = document.getElementById("sidebar");
            const backdrop = document.getElementById("sidebar-backdrop");
            sidebar.classList.toggle("open");
            backdrop.classList.toggle("active");
        });

        document.getElementById("sidebar-backdrop").addEventListener("click", closeSidebar);

        // Hash routing
        window.addEventListener("hashchange", () => {
            const hash = window.location.hash.replace("#", "") || "dashboard";
            if (hash === 'login') {
                // Let the login page be shown via auth flow
                return;
            }
            loadPage(hash);
        });

        // Check session
        checkSession();
    }

    // ===== PUBLIC API =====
    return {
        bootstrap,
        toast,
        showModal,
        closeModal,
        setTitle,
        escapeHtml,
        spinner,
        emptyState,
        handleApiError,
        showLoginPage,
        loadPage,
    };
})();

document.addEventListener("DOMContentLoaded", App.bootstrap);
