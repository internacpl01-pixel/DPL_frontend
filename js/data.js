// ===== MASTER DATA MODULE =====

var DataPage = (() => {
    const TITLE = "Master Data";
    const PAGE_SIZE = 50;

    let currentPage = 1;
    let totalPages = 1;
    let allColumns = [];
    let searchTerm = "";

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        container.innerHTML = `
            <div class="page-section active" id="section-data">
                <div class="search-box" style="margin-bottom:12px;">
                    <input type="text" id="data-search" class="form-control" placeholder="Search all columns...">
                </div>
                <div id="data-table-area">
                    <div id="data-info">${App.spinner()}</div>
                </div>
                <div id="data-pagination" style="margin-top:12px; text-align:center;"></div>
            </div>
        `;

        searchTerm = "";
        currentPage = 1;
        allColumns = [];

        document.getElementById("data-search").addEventListener("input", debounceSearch(250));
        await loadData();
    }

    function debounceSearch(ms) {
        let timer;
        return (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                searchTerm = e.target.value.trim().toLowerCase();
                currentPage = 1;
                loadData();
            }, ms);
        };
    }

    async function loadData() {
        const infoEl = document.getElementById("data-info");
        const pagEl = document.getElementById("data-pagination");

        try {
            const result = await Api.getData(currentPage, PAGE_SIZE);

            allColumns = result.columns || [];
            const rows = result.rows || [];
            totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

            if (!rows.length) {
                infoEl.innerHTML = App.emptyState("No data found. Upload a PDF to import transactions.");
                pagEl.innerHTML = "";
                return;
            }

            // Build table
            let html = `<div style="overflow-x:auto;">
                <table class="data-table">
                    <thead><tr>`;

            allColumns.forEach(col => {
                html += `<th>${App.escapeHtml(col.name)}</th>`;
            });

            html += `<th>Actions</th></tr></thead><tbody>`;

            rows.forEach(row => {
                const rowId = row.id || "";
                let matches = true;
                if (searchTerm) {
                    const searchable = Object.values(row).join(" ").toLowerCase();
                    matches = searchable.includes(searchTerm);
                }
                if (!matches) return;

                html += `<tr data-id="${rowId}">`;

                allColumns.forEach(col => {
                    const val = row[col.name] || "";
                    html += `<td>${App.escapeHtml(String(val))}</td>`;
                });

                html += `<td class="actions">
                    <button class="btn btn-danger btn-sm" data-action="delete" data-id="${rowId}">Delete</button>
                </td></tr>`;
            });

            html += `</tbody></table></div>`;
            infoEl.innerHTML = html;

            // Pagination
            let pagHtml = `<span style="margin-right:12px;">Page ${currentPage} of ${totalPages} (${result.total} total)</span>`;
            if (currentPage > 1) {
                pagHtml += `<button class="btn btn-secondary btn-sm" id="pag-prev">Previous</button> `;
            }
            for (let p = Math.max(1, currentPage - 2); p <= Math.min(totalPages, currentPage + 2); p++) {
                const cls = p === currentPage ? "btn-primary" : "btn-secondary";
                pagHtml += ` <button class="btn ${cls} btn-sm pag-page" data-page="${p}">${p}</button> `;
            }
            if (currentPage < totalPages) {
                pagHtml += `<button class="btn btn-secondary btn-sm" id="pag-next">Next</button>`;
            }
            pagEl.innerHTML = pagHtml;

            // Wire up pagination
            const prevBtn = document.getElementById("pag-prev");
            if (prevBtn) {
                prevBtn.addEventListener("click", () => {
                    if (currentPage > 1) {
                        currentPage--;
                        loadData();
                    }
                });
            }
            const nextBtn = document.getElementById("pag-next");
            if (nextBtn) {
                nextBtn.addEventListener("click", () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        loadData();
                    }
                });
            }
            document.querySelectorAll(".pag-page").forEach(btn => {
                btn.addEventListener("click", () => {
                    currentPage = parseInt(btn.dataset.page, 10);
                    loadData();
                });
            });

            // Wire up delete buttons
            document.querySelectorAll("[data-action='delete']").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = parseInt(btn.dataset.id, 10);
                    openDeleteConfirm(id);
                });
            });

        } catch (err) {
            infoEl.innerHTML = `<p class="error-msg">${App.escapeHtml(err.message)}</p>`;
            pagEl.innerHTML = "";
        }
    }

    function openDeleteConfirm(rowId) {
        App.showModal(
            "Delete Row",
            `<p>Are you sure you want to delete row <strong>${rowId}</strong>?</p>
             <p style="color:#dc3545;font-size:13px;">This action cannot be undone.</p>`,
            [
                { text: "Cancel", class: "btn-secondary", action: "cancel" },
                { text: "Delete", class: "btn-danger", action: "confirm" },
            ],
            async (action) => {
                if (action !== "confirm") return;
                try {
                    await Api.deleteData(rowId);
                    App.closeModal();
                    App.toast(`Row ${rowId} deleted`, "success");
                    // If current page is empty after delete, go back
                    if (currentPage > 1 && currentPage === totalPages) {
                        currentPage--;
                    }
                    loadData();
                } catch (err) {
                    App.toast(err.message, "error");
                }
            }
        );
    }

    return { load, TITLE };
})();