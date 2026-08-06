// ===== DPL Data Bank - App Entry Point =====

const App = (() => {
    let currentSection = null;

    // ===== MENU CONFIG (matches backend permissions) =====

    const MENU = [
        { id: 1, label: "Field Mapping Configuration", section: "section-mapping", module: MappingPage, minLevel: 1 },
        { id: 2, label: "View Field Mappings",         section: "section-view-mappings", module: null, minLevel: 0 },
        { id: 3, label: "Change Log",                  section: "section-change-log", module: LogPage, minLevel: 1 },
        { id: 4, label: "Table Structure",             section: "section-table-structure", module: TablePage, minLevel: 0 },
        { id: 5, label: "Add Custom Field",            section: "section-custom-field", module: CustomFieldPage, minLevel: 0 },
        { id: 6, label: "Users",                       section: "section-users", module: UsersPage, minLevel: 1 },
    ];

    // ===== UTILITIES =====

    function escapeHtml(s) {
        if (s === null || s === undefined) return "";
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function spinner() {
        return `<div class="spinner-overlay"><div class="loading"></div></div>`;
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
        setTimeout(() => {
            if (el.parentNode) el.remove();
        }, 4000);
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
            btn.addEventListener("click", async () => {
                if (onAction) {
                    await onAction(act.action);
                }
            });
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
        const msg = err.message;

        if (status === 401) {
            toast("Session expired. Please login again.", "error");
            Auth.logout();
            showLoginPage();
            return;
        }
        if (status === 403) {
            toast("You do not have permission to access this resource.", "error");
            return;
        }
        if (status === 404) {
            toast("Resource not found.", "error");
            return;
        }
        if (status === 422) {
            toast("Invalid data. Please check your input.", "error");
            return;
        }
        if (status >= 500) {
            toast("Server error. Please try again later.", "error");
            return;
        }
        toast(msg, "error");
    }

    // ===== PAGE NAVIGATION =====

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

        document.getElementById("user-name").textContent = user.username;
        const badge = document.getElementById("user-level-badge");
        badge.textContent = user.level_name;
        badge.className = `badge badge-${user.level_name.toLowerCase()}`;

        const topbarUser = document.getElementById("topbar-user");
        if (topbarUser) topbarUser.textContent = `${user.username} (${user.level_name})`;

        const menuEl = document.getElementById("sidebar-menu");
        menuEl.innerHTML = "";

        MENU.forEach(item => {
            if (user.level < item.minLevel) return;
            const li = document.createElement("li");
            const a = document.createElement("a");
            a.href = "#";
            a.textContent = item.label;
            a.dataset.section = item.section;
            a.addEventListener("click", (e) => {
                e.preventDefault();
                loadSection(item.section, item.module);
                closeSidebar();
            });
            li.appendChild(a);
            menuEl.appendChild(li);
        });
    }

    function setActiveMenu(sectionId) {
        document.querySelectorAll(".sidebar-menu li a").forEach(a => a.classList.remove("active"));
        const link = document.querySelector(`.sidebar-menu li a[data-section="${sectionId}"]`);
        if (link) link.classList.add("active");
    }

    // ===== SECTION LOADING =====

    async function loadSection(sectionId, module) {
        currentSection = sectionId;
        setActiveMenu(sectionId);

        const content = document.getElementById("page-content");
        content.innerHTML = spinner();

        if (!module) {
            // Sections without modules: show a basic view
            content.innerHTML = `
                <div class="page-section active">
                    <p class="section-desc">All configured field mappings.</p>
                    <div id="view-mappings">${spinner()}</div>
                </div>
            `;
            try {
                const data = await Api.get("/field-mappings");
                const box = document.getElementById("view-mappings");
                if (!data.length) {
                    box.innerHTML = emptyState("No field mappings found.");
                    return;
                }
                let html = `<div class="card" style="overflow-x:auto;">
                    <table class="data-table"><thead><tr>
                        <th>ID</th><th>Field Name</th><th>Display Name</th><th>Map Fields</th>
                    </tr></thead><tbody>`;
                data.forEach(item => {
                    html += `<tr>
                        <td>${item.id}</td>
                        <td><strong>${escapeHtml(item.fieldname)}</strong></td>
                        <td>${escapeHtml(item.displayname || "")}</td>
                        <td>${escapeHtml(item.mapfields || "")}</td>
                    </tr>`;
                });
                html += `</tbody></table></div>`;
                box.innerHTML = html;
            } catch (err) {
                handleApiError(err);
            }
            return;
        }

        try {
            await module.load();
        } catch (err) {
            content.innerHTML = `<div class="card"><p class="error-msg">${escapeHtml(err.message)}</p></div>`;
        }
    }

    // ===== AUTH FLOW =====

    async function enterDashboard() {
        showDashboard();
        renderSidebar();

        const user = Auth.getStoredUser();
        const first = MENU.find(m => user && user.level >= m.minLevel);
        if (first) {
            await loadSection(first.section, first.module);
        }
    }

    // ===== BOOTSTRAP =====

    async function bootstrap() {
        // Bind modal close on backdrop click
        document.getElementById("modal-container").addEventListener("click", (e) => {
            if (e.target === document.getElementById("modal-container")) {
                closeModal();
            }
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
            Auth.logout();
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

        // Check for existing session
        if (Auth.isLoggedIn()) {
            try {
                await Auth.fetchMe();
                await enterDashboard();
            } catch (_) {
                Auth.logout();
                showLoginPage();
            }
        } else {
            showLoginPage();
        }
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
    };
})();

document.addEventListener("DOMContentLoaded", App.bootstrap);
