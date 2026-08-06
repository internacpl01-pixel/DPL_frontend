// ===== CHANGE LOG MODULE =====

const LogPage = (() => {
    const TITLE = "Change Log";

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        container.innerHTML = `
            <div class="page-section active" id="section-change-log">
                
                <p class="section-desc">Record of all field mapping changes. Newest first.</p>
                <div id="log-list">${App.spinner()}</div>
            </div>
        `;

        let data = [];
        try {
            data = await Api.get("/change-log");
        } catch (err) {
            App.handleApiError(err);
            return;
        }

        const box = document.getElementById("log-list");
        if (!data.length) {
            box.innerHTML = App.emptyState("No log entries found.");
            return;
        }

        let html = `<div class="card" style="overflow-x:auto;">
            <table class="data-table">
                <thead><tr>
                    <th>ID</th><th>Field</th><th>Row ID</th><th>Table</th><th>Changed At</th>
                </tr></thead>
                <tbody>`;

        data.forEach(item => {
            html += `<tr>
                <td>${item.id}</td>
                <td><strong>${App.escapeHtml(item.fieldname)}</strong></td>
                <td>${item.table_row_id}</td>
                <td>${App.escapeHtml(item.table_name)}</td>
                <td>${App.escapeHtml(item.changed_at)}</td>
            </tr>`;
        });

        html += `</tbody></table></div>`;
        box.innerHTML = html;
    }

    return { load, TITLE };
})();
