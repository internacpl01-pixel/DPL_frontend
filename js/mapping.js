// ===== FIELD MAPPINGS MODULE =====

const MappingPage = (() => {
    const TITLE = "Field Mapping Configuration";

    function canEdit() {
        const user = Auth.getStoredUser();
        return user && user.level >= 1;
    }

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        const editControl = canEdit() ? "" : `<p class="section-desc">Read-only view. Only managers and admins can edit mappings.</p>`;

        container.innerHTML = `
            <div class="page-section active" id="section-mapping">
                <p class="section-desc">Manage field name mappings for data import.</p>
                ${editControl}
                <div class="card">
                    <div class="form-group">
                        <label for="field-select">Select Field</label>
                        <select id="field-select">
                            <option value="">-- Select a field --</option>
                        </select>
                    </div>
                    <div id="field-edit" class="hidden">
                        <div class="form-group">
                            <label for="edit-displayname">Display Name</label>
                            <input type="text" id="edit-displayname" placeholder="Leave empty to keep current">
                        </div>
                        <div class="form-group">
                            <label>Map Fields</label>
                            <div id="mapfield-tags" class="mapfield-tags"></div>
                            ${canEdit() ? `
                            <div class="form-row" style="margin-top:8px;">
                                <input type="text" class="form-control" id="new-mapfield" placeholder="Add new value...">
                                <button class="btn btn-primary btn-sm" id="btn-add-mapfield" type="button">Add</button>
                            </div>` : ""}
                        </div>
                        ${canEdit() ? `<button class="btn btn-success" id="btn-save-mapping">Save All Changes</button>` : ""}
                    </div>
                </div>
            </div>
        `;

        let data = [];
        try {
            data = await Api.get("/field-mappings");
        } catch (err) {
            App.handleApiError(err);
            return;
        }

        const select = document.getElementById("field-select");
        data.forEach(item => {
            const opt = document.createElement("option");
            opt.value = item.fieldname;
            opt.textContent = `${item.fieldname} — ${item.displayname || item.fieldname}`;
            select.appendChild(opt);
        });

        if (!data.length) {
            const empty = document.createElement("p");
            empty.className = "empty-state";
            empty.textContent = "No field mappings found.";
            container.querySelector(".card").appendChild(empty);
            return;
        }

        const editDiv = document.getElementById("field-edit");
        const tagsContainer = document.getElementById("mapfield-tags");
        const btnSave = document.getElementById("btn-save-mapping");
        const btnAdd = document.getElementById("btn-add-mapfield");
        const inputNew = document.getElementById("new-mapfield");

        let currentField = "";

        function renderTags(mapfieldsStr) {
            tagsContainer.innerHTML = "";
            if (!mapfieldsStr) return;
            const items = mapfieldsStr.split(",").map(s => s.trim()).filter(Boolean);
            items.forEach(val => {
                const tag = document.createElement("span");
                tag.className = "tag";
                tag.dataset.value = val;
                tag.innerHTML = `${App.escapeHtml(val)} ${canEdit() ? `<button class="tag-remove" type="button">&times;</button>` : ""}`;
                const removeBtn = tag.querySelector(".tag-remove");
                if (removeBtn) {
                    removeBtn.addEventListener("click", async function () {
                        if (!confirm(`Remove '${val}' from mapfields?`)) return;
                        tag.style.opacity = "0.4";
                        tag.style.pointerEvents = "none";
                        try {
                            await Api.delete(`/field-mappings/${encodeURIComponent(currentField)}/mapfield`, { value: val });
                            tag.remove();
                            App.toast(`Removed '${val}'`, "success");
                        } catch (err) {
                            tag.style.opacity = "1";
                            tag.style.pointerEvents = "auto";
                            App.toast(err.message, "error");
                        }
                    });
                }
                tagsContainer.appendChild(tag);
            });
        }

        select.addEventListener("change", () => {
            const fieldname = select.value;
            if (!fieldname) {
                editDiv.classList.add("hidden");
                currentField = "";
                return;
            }
            currentField = fieldname;
            const item = data.find(d => d.fieldname === fieldname);
            if (item) {
                document.getElementById("edit-displayname").value = item.displayname || "";
                renderTags(item.mapfields);
                editDiv.classList.remove("hidden");
            }
        });

        if (btnAdd && inputNew) {
            btnAdd.addEventListener("click", async () => {
                const newVal = inputNew.value.trim();
                if (!newVal) return;
                if (!currentField) { App.toast("Select a field first", "warning"); return; }
                const existing = [...tagsContainer.querySelectorAll(".tag")].map(t => t.dataset.value);
                if (existing.some(v => v.toLowerCase() === newVal.toLowerCase())) {
                    App.toast(`'${newVal}' already exists`, "error");
                    return;
                }
                inputNew.value = "";
                try {
                    await Api.put(`/field-mappings/${encodeURIComponent(currentField)}`, { mapfields: newVal });
                    const tag = document.createElement("span");
                    tag.className = "tag";
                    tag.dataset.value = newVal;
                    tag.innerHTML = `${App.escapeHtml(newVal)} <button class="tag-remove" type="button">&times;</button>`;
                    tag.querySelector(".tag-remove").addEventListener("click", async function () {
                        if (!confirm(`Remove '${newVal}' from mapfields?`)) return;
                        tag.style.opacity = "0.4";
                        tag.style.pointerEvents = "none";
                        try {
                            await Api.delete(`/field-mappings/${encodeURIComponent(currentField)}/mapfield`, { value: newVal });
                            tag.remove();
                            App.toast(`Removed '${newVal}'`, "success");
                        } catch (err) {
                            tag.style.opacity = "1";
                            tag.style.pointerEvents = "auto";
                            App.toast(err.message, "error");
                        }
                    });
                    tagsContainer.appendChild(tag);
                    App.toast(`Added '${newVal}'`, "success");
                } catch (err) {
                    App.toast(err.message, "error");
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener("click", async () => {
                if (!currentField) { App.toast("Select a field first", "warning"); return; }
                const displayname = document.getElementById("edit-displayname").value.trim();
                const tagValues = [...tagsContainer.querySelectorAll(".tag")].map(t => t.dataset.value);
                const mapfields = tagValues.join(", ");
                try {
                    await Api.put(`/field-mappings/${encodeURIComponent(currentField)}`, {
                        displayname: displayname || "",
                        mapfields,
                    });
                    App.toast("Mapping updated successfully", "success");
                } catch (err) {
                    App.toast(err.message, "error");
                }
            });
        }
    }

    return { load, TITLE };
})();
