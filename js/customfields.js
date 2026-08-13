// ===== CUSTOM FIELDS MODULE =====

var CustomFieldPage = (() => {
    const TITLE = "Custom Fields";

    const VALID_TYPES = ["date", "num", "text"];

    // Mirrors _PROTECTED_COLUMNS in routers/mappings.py. The server refuses
    // these regardless, so this only decides whether to draw the button.
    const PROTECTED = ["id", "date", "desc", "withdrawal", "deposits", "balance"];

    let listenersAttached = false;

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        container.innerHTML = `
            <div class="page-section active" id="section-custom-field">

                <p class="section-desc">Add a new field to the master table.</p>
                <div class="card">
                    <form id="cf-form">
                        <div class="form-group">
                            <label for="cf-type">Field Type</label>
                            <select id="cf-type" required>
                                <option value="">-- Select Type --</option>
                                <option value="date">Date</option>
                                <option value="num">Number</option>
                                <option value="text">Text</option>
                            </select>
                        </div>
                        <button type="submit" class="btn btn-primary">Add Field</button>
                    </form>
                </div>

                <p class="section-desc">Existing fields.</p>
                <div class="card" id="cf-list">${App.spinner()}</div>
            </div>
        `;

        document.getElementById("cf-form").addEventListener("submit", onAdd);

        // Delegated on the stable #page-content, like DataPage does: load()
        // replaces the rows on every render, so a listener bound to a Delete
        // button would go stale the moment the list refreshes.
        if (!listenersAttached) {
            listenersAttached = true;
            container.addEventListener("click", (e) => {
                const btn = e.target.closest("[data-action='delete-field']");
                if (btn) openDeleteConfirm(btn.dataset.fieldname, btn.dataset.displayname);
            });
        }

        await renderList();
    }

    async function onAdd(e) {
        e.preventDefault();
        const type = document.getElementById("cf-type").value.trim().toLowerCase();

        if (!type) {
            App.toast("Please select a field type", "warning");
            return;
        }
        if (!VALID_TYPES.includes(type)) {
            App.toast("Invalid type. Choose date, num, or text.", "error");
            return;
        }

        const btn = e.target.querySelector("button[type='submit']");
        btn.disabled = true;
        btn.textContent = "Adding...";

        try {
            const res = await Api.createCustomField(type);
            App.toast(`Column '${res.column}' (${res.type}) added successfully`, "success");
            e.target.reset();
            await renderList();
        } catch (err) {
            App.toast(err.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Add Field";
        }
    }

    async function renderList() {
        const el = document.getElementById("cf-list");
        if (!el) return;

        try {
            // Both sides are needed: a fieldmap row whose column was dropped
            // straight from Postgres still shows here, so it can be cleaned up.
            const [mappings, structure] = await Promise.all([
                Api.getFieldMappings(),
                Api.getTableStructure(),
            ]);

            const types = {};
            (structure || []).forEach(c => { types[c.column_name] = c.data_type; });

            const fields = (mappings || []).filter(m => m.fieldname !== "id");
            if (!fields.length) {
                el.innerHTML = App.emptyState("No fields defined yet.");
                return;
            }

            let html = `<div class="table-scroll">
                <table class="data-table">
                    <thead><tr>
                        <th>Display Name</th><th>Field</th><th>Column</th><th>Actions</th>
                    </tr></thead><tbody>`;

            fields.forEach(m => {
                const protectedField = PROTECTED.includes(m.fieldname);
                const type = types[m.fieldname];
                const colCell = type
                    ? App.escapeHtml(type)
                    : `<span class="text-danger">no column</span>`;

                html += `<tr>
                    <td>${App.escapeHtml(m.displayname || m.fieldname)}</td>
                    <td>${App.escapeHtml(m.fieldname)}</td>
                    <td>${colCell}</td>
                    <td class="actions">${protectedField
                        ? `<span class="text-sm">Core field</span>`
                        : `<button class="btn btn-danger btn-sm" data-action="delete-field"
                             data-fieldname="${App.escapeHtml(m.fieldname)}"
                             data-displayname="${App.escapeHtml(m.displayname || m.fieldname)}">Delete</button>`
                    }</td>
                </tr>`;
            });

            html += `</tbody></table></div>`;
            el.innerHTML = html;
        } catch (err) {
            el.innerHTML = `<p class="error-msg">${App.escapeHtml(err.message)}</p>`;
        }
    }

    function openDeleteConfirm(fieldname, displayname) {
        App.showModal(
            "Delete Field",
            `<p>Delete <strong>${App.escapeHtml(displayname)}</strong>
                (<code>${App.escapeHtml(fieldname)}</code>)?</p>
             <p class="text-danger">The column and every value stored in it will be
                dropped from the master table.</p>
             <p class="text-danger text-sm">This action cannot be undone.</p>`,
            [
                { text: "Delete Field", class: "btn-danger", action: "confirm" },
            ],
            async (action) => {
                if (action !== "confirm") return;
                try {
                    await Api.deleteCustomField(fieldname);
                    App.closeModal();
                    App.toast(`Field '${fieldname}' deleted`, "success");
                    await renderList();
                } catch (err) {
                    App.toast(err.message, "error");
                }
            }
        );
    }

    return { load, TITLE };
})();
