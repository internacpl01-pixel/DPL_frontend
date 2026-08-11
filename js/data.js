// ===== MASTER DATA MODULE =====

var DataPage = (() => {
    const TITLE = "Master Data";
    const PAGE_SIZE = 50;

    let currentPage = 1;
    let totalPages = 1;
    let allColumns = [];
    let searchTerm = "";
    let listenersAttached = false;

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        container.innerHTML = `
            <div class="page-section active" id="section-data">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <div class="search-box" style="flex:1; margin-right:12px;">
                        <input type="text" id="data-search" class="form-control" placeholder="Search all columns...">
                    </div>
                    <button class="btn btn-danger btn-sm" id="btn-truncate">Truncate All Data</button>
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

        // Attach event listeners once (not on every page change)
        if (!listenersAttached) {
            listenersAttached = true;

            // Search (debounced)
            document.getElementById("data-search").addEventListener("input", debounceSearch(250));

            // Truncate — attached once, survives all loadData() calls
            document.getElementById("btn-truncate").addEventListener("click", openTruncateConfirm);

            // Delegated clicks for pagination and delete (container = #page-content)
            const container = document.getElementById("page-content");
            container.addEventListener("click", (e) => {
                const pagPrev = e.target.closest("#pag-prev");
                const pagNext = e.target.closest("#pag-next");
                const pagPage = e.target.closest(".pag-page");
                const delBtn = e.target.closest("[data-action='delete']");

                if (pagPrev) {
                    if (currentPage > 1) { currentPage--; loadData(); }
                } else if (pagNext) {
                    if (currentPage < totalPages) { currentPage++; loadData(); }
                } else if (pagPage) {
                    currentPage = parseInt(pagPage.dataset.page, 10);
                    loadData();
                } else if (delBtn) {
                    const id = parseInt(delBtn.dataset.id, 10);
                    openDeleteConfirm(id);
                }
            });
        }

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
                const headerText = col.displayname && col.displayname !== col.name ? col.displayname : col.name;
                html += `<th>${App.escapeHtml(headerText)}</th>`;
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

            // Pagination (rendered, events handled by delegated listener in load())
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

    function openTruncateConfirm() {
        App.showModal(
            "Truncate All Data",
            `<p style="color:#dc3545;font-size:15px;"><strong>This will permanently delete ALL data from the master table.</strong></p>
             <p style="color:#dc3545;font-size:13px;">This action cannot be undone.</p>`,
            [
                { text: "Cancel", class: "btn-secondary", action: "cancel" },
                { text: "Truncate All", class: "btn-danger", action: "confirm" },
            ],
            async (action) => {
                if (action !== "confirm") return;
                try {
                    await Api.truncateData();
                    App.closeModal();
                    App.toast("All data has been deleted", "success");
                    currentPage = 1;
                    loadData();
                } catch (err) {
                    App.toast(err.message, "error");
                }
            }
        );
    }

    return { load, TITLE };
})();