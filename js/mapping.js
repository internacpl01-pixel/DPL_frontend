// ===== FIELD MAPPINGS MODULE =====

const MappingPage = (() => {
    const TITLE = "Field Mapping Configuration";

    function getUserLevel() {
        const u = Auth.getStoredUser();
        return u ? (u.access_level ?? u.level ?? 0) : 0;
    }

    function canEditMapping() {
        return getUserLevel() >= 1;
    }

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        const canEdit = canEditMapping();

        container.innerHTML = `
            <div class="page-section active" id="section-mapping">
                <p class="section-desc">Manage field name mappings for data import. No duplicate values allowed across any mapping.</p>
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
                            <input type="text" id="edit-displayname" class="form-control" placeholder="Leave empty to keep current">
                            ${canEdit ? `<button type="button" class="btn btn-primary btn-sm" id="btn-save-displayname" style="margin-left:8px;">Save</button>` : ""}
                        </div>
                        <div class="form-group">
                            <label>Map Fields</label>
                            <div id="mapfield-tags" class="mapfield-tags"></div>
                            ${canEdit ? `
                            <div class="input-group" style="margin-top:8px;">
                                <input type="text" class="form-control" id="new-mapfield" placeholder="Add new value...">
                                <button type="button" class="btn btn-primary btn-sm" id="btn-add-mapfield">Add</button>
                            </div>` : ""}
                        </div>
                    </div>
                </div>
            </div>
        `;

        let data = [];
        try {
            data = await Api.getFieldMappings();
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
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.textContent = "No field mappings found.";
            container.querySelector(".card").appendChild(empty);
            return;
        }

        const editDiv = document.getElementById("field-edit");
        const tagsContainer = document.getElementById("mapfield-tags");
        const btnAdd = document.getElementById("btn-add-mapfield");
        const inputNew = document.getElementById("new-mapfield");
        const btnSaveDisplay = document.getElementById("btn-save-displayname");

        let currentField = "";

        function isValueUsedElsewhere(value, currentFieldname) {
            const lower = value.toLowerCase();
            return data.some(item => {
                if (item.fieldname === currentFieldname) return false;
                return item.mapfields.split(",").some(v => v.trim().toLowerCase() === lower);
            });
        }

        function renderTags(mapfieldsStr, fieldname) {
            tagsContainer.innerHTML = "";
            if (!mapfieldsStr) return;
            const items = mapfieldsStr.split(",").map(s => s.trim()).filter(Boolean);
            items.forEach(val => {
                const tag = document.createElement("span");
                tag.className = "tag";
                tag.dataset.value = val;
                const removeBtn = canEdit
                    ? ` <button type="button" class="tag-remove">&times;</button>`
                    : "";
                tag.innerHTML = `${App.escapeHtml(val)}${removeBtn}`;
                const rm = tag.querySelector(".tag-remove");
                if (rm) {
                    rm.addEventListener("click", async function () {
                        if (!confirm(`Remove '${val}' from mapfields?`)) return;
                        tag.style.opacity = "0.4";
                        tag.style.pointerEvents = "none";
                        try {
                            await Api.deleteMapfield(fieldname, val);
                            tag.remove();
                            App.toast(`Removed '${val}'`, "success");
                            const item = data.find(d => d.fieldname === fieldname);
                            if (item) {
                                const vals = item.mapfields.split(",").map(s => s.trim()).filter(Boolean);
                                const idx = vals.indexOf(val);
                                if (idx !== -1) {
                                    vals.splice(idx, 1);
                                    item.mapfields = vals.join(", ");
                                }
                            }
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
                renderTags(item.mapfields, fieldname);
                editDiv.classList.remove("hidden");
            }
        });

        if (btnSaveDisplay) {
            btnSaveDisplay.addEventListener("click", async () => {
                if (!currentField) { App.toast("Select a field first", "warning"); return; }
                const displayname = document.getElementById("edit-displayname").value.trim();
                try {
                    await Api.updateFieldMapping(currentField, displayname, "");
                    App.toast("Display name updated", "success");
                    const opt = select.querySelector(`option[value="${currentField}"]`);
                    if (opt) {
                        const item = data.find(d => d.fieldname === currentField);
                        if (item) {
                            item.displayname = displayname;
                            opt.textContent = `${currentField} — ${displayname || currentField}`;
                        }
                    }
                } catch (err) {
                    App.toast(err.message, "error");
                }
            });
        }

        if (btnAdd && inputNew) {
            btnAdd.addEventListener("click", async () => {
                const newVal = inputNew.value.trim();
                if (!newVal) return;
                if (!currentField) { App.toast("Select a field first", "warning"); return; }

                const existingValues = [...tagsContainer.querySelectorAll(".tag")].map(t => t.dataset.value);
                if (existingValues.some(v => v.toLowerCase() === newVal.toLowerCase())) {
                    App.toast(`'${newVal}' already exists in this mapping`, "error");
                    return;
                }

                if (isValueUsedElsewhere(newVal, currentField)) {
                    App.toast(`'${newVal}' is already used in another mapping`, "error");
                    return;
                }

                inputNew.value = "";
                try {
                    await Api.updateFieldMapping(currentField, "", newVal);
                    const tag = document.createElement("span");
                    tag.className = "tag";
                    tag.dataset.value = newVal;
                    tag.innerHTML = `${App.escapeHtml(newVal)} <button type="button" class="tag-remove">&times;</button>`;
                    const rm = tag.querySelector(".tag-remove");
                    rm.addEventListener("click", async function () {
                        if (!confirm(`Remove '${newVal}' from mapfields?`)) return;
                        tag.style.opacity = "0.4";
                        tag.style.pointerEvents = "none";
                        try {
                            await Api.deleteMapfield(currentField, newVal);
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
    }

    return { load };
})();
