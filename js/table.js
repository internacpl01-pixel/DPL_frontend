// ===== TABLE STRUCTURE MODULE =====

const TablePage = (() => {
    const TITLE = "Table Structure";

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        container.innerHTML = `
            <div class="page-section active" id="section-table-structure">
                
                <p class="section-desc">Columns of the master table.</p>
                <div id="table-search-wrapper">
                    <input type="text" id="table-search" class="search-input" placeholder="Search columns...">
                </div>
                <div id="table-info">${App.spinner()}</div>
            </div>
        `;

        let data = [];
        try {
            data = await Api.get("/table-structure");
        } catch (err) {
            App.handleApiError(err);
            return;
        }

        const box = document.getElementById("table-info");
        if (!data.length) {
            box.innerHTML = App.emptyState("No columns found.");
            return;
        }

        function renderTable(filter = "") {
            const term = filter.toLowerCase().trim();
            const filtered = term
                ? data.filter(item =>
                    item.column_name.toLowerCase().includes(term) ||
                    item.data_type.toLowerCase().includes(term))
                : data;

            if (!filtered.length) {
                box.innerHTML = App.emptyState("No matching columns found.");
                return;
            }

            let html = `<div class="card" style="overflow-x:auto;">
                <table class="data-table">
                    <thead><tr>
                        <th>Column Name</th>
                        <th>Data Type</th>
                        <th>Nullable</th>
                    </tr></thead>
                    <tbody>`;

            filtered.forEach(item => {
                html += `<tr>
                    <td><strong>${App.escapeHtml(item.column_name)}</strong></td>
                    <td>${App.escapeHtml(item.data_type)}</td>
                    <td>${App.escapeHtml(item.is_nullable)}</td>
                </tr>`;
            });

            html += `</tbody></table></div>`;
            box.innerHTML = html;
        }

        renderTable();

        document.getElementById("table-search").addEventListener("input", (e) => {
            renderTable(e.target.value);
        });
    }

    return { load, TITLE };
})();
