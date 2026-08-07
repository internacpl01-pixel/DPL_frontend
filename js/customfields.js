// ===== CUSTOM FIELDS MODULE =====

const CustomFieldPage = (() => {
    const TITLE = "Add Custom Field";

    const VALID_TYPES = ["date", "num", "text"];

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
            </div>
        `;

        document.getElementById("cf-form").addEventListener("submit", async (e) => {
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
            } catch (err) {
                App.toast(err.message, "error");
            } finally {
                btn.disabled = false;
                btn.textContent = "Add Field";
            }
        });
    }

    return { load, TITLE };
})();
