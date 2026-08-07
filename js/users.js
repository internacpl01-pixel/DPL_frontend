// ===== USERS MODULE =====

const UsersPage = (() => {
    const TITLE = "Users";

    const LEVEL_NAMES = { 0: "Staff", 1: "Manager", 2: "Admin" };
    const LEVEL_CAN_CREATE = { 0: [], 1: [0], 2: [0, 1, 2] };
    const LEVEL_CAN_EDIT = { 0: [], 1: [0], 2: [0, 1] };

    function getCurrentUser() {
        return Auth.getStoredUser();
    }

    function getCurrentLevel() {
        const u = Auth.getStoredUser();
        return u ? (u.access_level ?? u.level ?? 0) : 0;
    }

    function canCreateLevel(level) {
        return (LEVEL_CAN_CREATE[getCurrentLevel()] || []).includes(level);
    }

    function canEditTarget(targetLevel) {
        return (LEVEL_CAN_EDIT[getCurrentLevel()] || []).includes(targetLevel);
    }

    function isAdmin() {
        return getCurrentLevel() === 2;
    }

    function isManagerOrAbove() {
        return getCurrentLevel() >= 1;
    }

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        const canCreateAny = isManagerOrAbove();

        container.innerHTML = `
            <div class="page-section active" id="section-users">
                <p class="section-desc">Manage user accounts and permissions.</p>

                ${canCreateAny ? `
                <div class="card">
                    <h3>Add User</h3>
                    <form id="add-user-form">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="au-username">Username</label>
                                <input type="text" id="au-username" placeholder="Min 3 chars" required minlength="3">
                            </div>
                            <div class="form-group">
                                <label for="au-password">Password</label>
                                <input type="password" id="au-password" placeholder="Min 4 chars" required minlength="4">
                            </div>
                            <div class="form-group">
                                <label for="au-level">Access Level</label>
                                <select id="au-level">
                                    ${buildLevelOptions()}
                                </select>
                            </div>
                            <button type="submit" class="btn btn-primary">Add User</button>
                        </div>
                    </form>
                </div>` : ""}

                <div class="card">
                    <h3>Existing Users</h3>
                    <div id="users-list">${App.spinner()}</div>
                </div>
            </div>
        `;

        if (canCreateAny) {
            document.getElementById("add-user-form").addEventListener("submit", handleAddUser);
        }

        await loadUsersList();
    }

    function buildLevelOptions() {
        const allowed = LEVEL_CAN_CREATE[getCurrentLevel()] || [];
        let html = "";
        if (allowed.includes(2)) html += `<option value="2">Admin</option>`;
        if (allowed.includes(1)) html += `<option value="1">Manager</option>`;
        if (allowed.includes(0)) html += `<option value="0">Staff</option>`;
        return html;
    }

    async function loadUsersList() {
        const box = document.getElementById("users-list");
        if (!box) return;

        try {
            const data = await Api.getUsers();
            if (!data.length) {
                box.innerHTML = App.emptyState("No users found.");
                return;
            }

            const currentUser = getCurrentUser();
            let html = `<div style="overflow-x:auto;">
                <table class="data-table">
                    <thead><tr>
                        <th>ID</th><th>Username</th><th>Level</th><th>Created</th><th>Actions</th>
                    </tr></thead>
                    <tbody>`;

            data.forEach(item => {
                const isSelf = String(item.id) === String(currentUser.id);
                const itemLevel = item.user_level;
                const canEdit = !isSelf && canEditTarget(itemLevel);
                const itemLevelName = item.level_name;
                html += `<tr>
                    <td>${item.id}</td>
                    <td><strong>${App.escapeHtml(item.username)}</strong>${isSelf ? " (you)" : ""}</td>
                    <td><span class="badge badge-${itemLevelName.toLowerCase()}">${App.escapeHtml(itemLevelName)}</span></td>
                    <td>${App.escapeHtml(item.created_at || '')}</td>
                    <td class="actions">
                        ${canEdit ? `
                            <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${item.id}">Edit</button>
                            <button class="btn btn-secondary btn-sm" data-action="level" data-id="${item.id}" data-level="${itemLevel}">Level</button>
                            <button class="btn btn-danger btn-sm" data-action="delete" data-id="${item.id}" data-name="${App.escapeHtml(item.username)}">Delete</button>
                        ` : `<span style="color:#aaa;font-size:13px;">--</span>`}
                    </td>
                </tr>`;
            });

            html += `</tbody></table></div>`;
            box.innerHTML = html;

            box.querySelectorAll("[data-action='edit']").forEach(btn => {
                btn.addEventListener("click", () => openEditModal(parseInt(btn.dataset.id)));
            });
            box.querySelectorAll("[data-action='delete']").forEach(btn => {
                btn.addEventListener("click", () => openDeleteConfirm(parseInt(btn.dataset.id), btn.dataset.name));
            });
            box.querySelectorAll("[data-action='level']").forEach(btn => {
                btn.addEventListener("click", () => openLevelModal(parseInt(btn.dataset.id), parseInt(btn.dataset.level)));
            });
        } catch (err) {
            box.innerHTML = `<p class="error-msg">${App.escapeHtml(err.message)}</p>`;
        }
    }

    async function handleAddUser(e) {
        e.preventDefault();
        const username = document.getElementById("au-username").value.trim();
        const password = document.getElementById("au-password").value;
        const level = parseInt(document.getElementById("au-level").value, 10);

        if (!username || !password) {
            App.toast("Username and password required", "warning");
            return;
        }
        if (username.length < 3) {
            App.toast("Username must be at least 3 characters", "error");
            return;
        }
        if (password.length < 4) {
            App.toast("Password must be at least 4 characters", "error");
            return;
        }
        if (!canCreateLevel(level)) {
            App.toast("You do not have permission to create this level user", "error");
            return;
        }

        try {
            await Api.createUser(username, password, level);
            App.toast(`User '${username}' created successfully`, "success");
            document.getElementById("add-user-form").reset();
            await loadUsersList();
        } catch (err) {
            App.toast(err.message, "error");
        }
    }

    async function openEditModal(userId) {
        try {
            const users = await Api.getUsers();
            const target = users.find(u => u.id === userId);
            if (!target) { App.toast("User not found", "error"); return; }

            const targetLevel = target.user_level;
            if (!canEditTarget(targetLevel)) {
                App.toast("You do not have permission to edit this user", "error");
                return;
            }

            App.showModal(
                "Edit User",
                `
                <form id="edit-user-form">
                    <div class="form-group">
                        <label for="edit-username">Username</label>
                        <input type="text" id="edit-username" value="${App.escapeHtml(target.username)}" placeholder="Leave empty to keep current">
                    </div>
                    <div class="form-group">
                        <label for="edit-password">New Password</label>
                        <input type="password" id="edit-password" placeholder="Leave empty to keep current">
                    </div>
                </form>
                `,
                [
                    { text: "Cancel", class: "btn-secondary", action: "cancel" },
                    { text: "Save Changes", class: "btn-primary", action: "save" },
                ],
                async (action) => {
                    if (action !== "save") return;

                    const username = document.getElementById("edit-username").value.trim();
                    const password = document.getElementById("edit-password").value;

                    const body = {};
                    if (username && username.length >= 3) {
                        body.username = username;
                    } else if (username && username.length < 3) {
                        App.toast("Username must be at least 3 characters", "error");
                        return;
                    }
                    if (password) {
                        if (password.length < 4) {
                            App.toast("Password must be at least 4 characters", "error");
                            return;
                        }
                        body.password = password;
                    }

                    if (!body.username && !body.password) {
                        App.toast("Provide at least one field to update", "warning");
                        return;
                    }

                    const saveBtn = document.querySelector("#modal-actions .btn-primary");
                    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving..."; }

                    try {
                        await Api.patchUser(userId, body);
                        App.closeModal();
                        App.toast("User updated successfully", "success");
                        await loadUsersList();
                    } catch (err) {
                        App.toast(err.message, "error");
                    } finally {
                        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Changes"; }
                    }
                }
            );
        } catch (err) {
            App.toast(err.message, "error");
        }
    }

    async function openDeleteConfirm(userId, username) {
        App.showModal(
            "Delete User",
            `<p>Are you sure you want to delete user <strong>${App.escapeHtml(username)}</strong>?</p>
             <p style="color:#dc3545;font-size:13px;">This action cannot be undone.</p>`,
            [
                { text: "Cancel", class: "btn-secondary", action: "cancel" },
                { text: "Delete", class: "btn-danger", action: "confirm" },
            ],
            async (action) => {
                if (action !== "confirm") return;
                try {
                    await Api.deleteUser(userId);
                    App.closeModal();
                    App.toast(`User '${username}' deleted`, "success");
                    await loadUsersList();
                } catch (err) {
                    App.toast(err.message, "error");
                }
            }
        );
    }

    async function openLevelModal(userId, currentLevel) {
        if (!isAdmin()) {
            App.toast("Only admins can change user levels", "error");
            return;
        }

        App.showModal(
            "Change User Level",
            `
            <div class="form-group">
                <label for="level-select">New Level</label>
                <select id="level-select">
                    <option value="0" ${currentLevel === 0 ? "selected" : ""}>Staff</option>
                    <option value="1" ${currentLevel === 1 ? "selected" : ""}>Manager</option>
                    <option value="2" ${currentLevel === 2 ? "selected" : ""}>Admin</option>
                </select>
            </div>
            `,
            [
                { text: "Cancel", class: "btn-secondary", action: "cancel" },
                { text: "Update Level", class: "btn-primary", action: "save" },
            ],
            async (action) => {
                if (action !== "save") return;
                const newLevel = parseInt(document.getElementById("level-select").value, 10);
                try {
                    await Api.updateUserLevel(userId, newLevel);
                    App.closeModal();
                    App.toast(`User level updated to ${LEVEL_NAMES[newLevel]}`, "success");
                    await loadUsersList();
                } catch (err) {
                    App.toast(err.message, "error");
                }
            }
        );
    }

    return { load, TITLE };
})();
