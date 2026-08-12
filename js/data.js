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
                <div class="toolbar">
                    <div class="search-box">
                        <input type="text" id="data-search" class="form-control" inputmode="numeric" placeholder="Search by ID...">
                    </div>
                    <div class="export-dropdown" id="export-dropdown">
                        <button class="btn btn-secondary btn-sm" id="btn-export">Export</button>
                        <div class="dropdown-menu" id="export-menu">
                            <button type="button" class="dropdown-item" data-format="csv">CSV</button>
                            <button type="button" class="dropdown-item" data-format="xlsx">Excel (.xlsx)</button>
                            <button type="button" class="dropdown-item" data-format="pdf">PDF</button>
                        </div>
                    </div>
                    <button class="btn btn-danger btn-sm" id="btn-truncate">Truncate All Data</button>
                </div>
                <div id="data-table-area">
                    <div id="data-info">${App.spinner()}</div>
                </div>
                <div id="data-pagination" class="pagination-bar"></div>
            </div>
        `;

        searchTerm = "";
        currentPage = 1;
        allColumns = [];

        // Attach event listeners once on the STABLE #page-content container
        // (it's never replaced — only its innerHTML is). Everything is handled
        // via delegation matched against e.target, so it keeps working no
        // matter how many times load() recreates the buttons/input inside it —
        // a direct listener on #btn-truncate/#data-search would go stale the
        // moment you navigate away and back, since load() destroys and
        // recreates those specific elements every time.
        if (!listenersAttached) {
            listenersAttached = true;

            const container = document.getElementById("page-content");

            container.addEventListener("input", debounceSearch(250));

            container.addEventListener("click", (e) => {
                const truncateBtn = e.target.closest("#btn-truncate");
                const btnExport = e.target.closest("#btn-export");
                const exportLink = e.target.closest("#export-menu .dropdown-item");
                const pagFirst = e.target.closest("#pag-first");
                const pagPrev = e.target.closest("#pag-prev");
                const pagNext = e.target.closest("#pag-next");
                const pagLast = e.target.closest("#pag-last");
                const pagPage = e.target.closest(".pag-page");
                const delBtn = e.target.closest("[data-action='delete']");

                // Close export dropdown if clicking outside it
                const menu = document.getElementById("export-menu");
                if (menu && menu.style.display !== "none" && !btnExport && !exportLink) {
                    menu.style.display = "none";
                }

                if (btnExport) {
                    const menu = document.getElementById("export-menu");
                    menu.style.display = menu.style.display === "none" ? "block" : "none";
                } else if (exportLink) {
                    e.preventDefault();
                    const menu = document.getElementById("export-menu");
                    menu.style.display = "none";
                    const fmt = exportLink.dataset.format;
                    triggerExport(fmt);
                } else if (truncateBtn) {
                    openTruncateConfirm();
                } else if (pagFirst) {
                    if (currentPage !== 1) { currentPage = 1; loadData(); }
                } else if (pagPrev) {
                    if (currentPage > 1) { currentPage--; loadData(); }
                } else if (pagNext) {
                    if (currentPage < totalPages) { currentPage++; loadData(); }
                } else if (pagLast) {
                    if (currentPage !== totalPages) { currentPage = totalPages; loadData(); }
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
            if (e.target.id !== "data-search") return;
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
            const result = await Api.getData(currentPage, PAGE_SIZE, searchTerm);

            allColumns = result.columns || [];
            const rows = result.rows || [];
            totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

            if (!rows.length) {
                infoEl.innerHTML = App.emptyState(searchTerm
                    ? `No row with ID "${App.escapeHtml(searchTerm)}".`
                    : "No data found. Upload a PDF to import transactions.");
                pagEl.innerHTML = "";
                return;
            }

            // Build table
            const isNumericCol = (col) =>
                ["numeric", "real", "double precision", "integer", "bigint"].includes((col.type || "").toLowerCase());

            let html = `<div class="table-scroll">
                <table class="data-table">
                    <thead><tr>`;

            allColumns.forEach(col => {
                const headerText = col.displayname && col.displayname !== col.name ? col.displayname : col.name;
                html += `<th${isNumericCol(col) ? ' class="text-right"' : ""}>${App.escapeHtml(headerText)}</th>`;
            });

            html += `<th>Actions</th></tr></thead><tbody>`;

            rows.forEach(row => {
                const rowId = row.id || "";
                // No client-side filter: the server already returned only the
                // matching rows, and `total` below counts matches across the
                // whole table rather than just this page.
                html += `<tr data-id="${rowId}">`;

                allColumns.forEach(col => {
                    const val = row[col.name] || "";
                    html += `<td${isNumericCol(col) ? ' class="text-right"' : ""}>${App.escapeHtml(String(val))}</td>`;
                });

                html += `<td class="actions">
                    <button class="btn btn-danger btn-sm" data-action="delete" data-id="${rowId}">Delete</button>
                </td></tr>`;
            });

            html += `</tbody></table></div>`;
            infoEl.innerHTML = html;

            // Pagination (rendered, events handled by delegated listener in load())
            // Fixed layout: First, Previous, up to 7 page numbers, Next, Last —
            // always rendered (disabled at the boundaries) so the bar never
            // reflows, and the numbered window stays fixed-width (max 7 buttons)
            // regardless of totalPages, so this renders just as fast at 20 pages
            // as at 2000.
            const atFirst = currentPage <= 1;
            const atLast = currentPage >= totalPages;

            const WINDOW = 7;
            let winStart = Math.max(1, currentPage - Math.floor(WINDOW / 2));
            let winEnd = Math.min(totalPages, winStart + WINDOW - 1);
            winStart = Math.max(1, winEnd - WINDOW + 1);

            let pagHtml = `<span class="mr-3">Page ${currentPage} of ${totalPages} (${result.total} total)</span>`;
            pagHtml += `<button class="btn btn-secondary btn-sm" id="pag-first" title="First page" ${atFirst ? "disabled" : ""}>&laquo; First</button> `;
            pagHtml += `<button class="btn btn-secondary btn-sm" id="pag-prev" ${atFirst ? "disabled" : ""}>Previous</button> `;
            for (let p = winStart; p <= winEnd; p++) {
                const cls = p === currentPage ? "btn-primary" : "btn-secondary";
                pagHtml += ` <button class="btn ${cls} btn-sm pag-page" data-page="${p}">${p}</button> `;
            }
            pagHtml += `<button class="btn btn-secondary btn-sm" id="pag-next" ${atLast ? "disabled" : ""}>Next</button> `;
            pagHtml += `<button class="btn btn-secondary btn-sm" id="pag-last" title="Last page" ${atLast ? "disabled" : ""}>Last &raquo;</button>`;
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
             <p class="text-danger text-sm">This action cannot be undone.</p>`,
            [
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
            `<p class="text-danger"><strong>This will permanently delete ALL data from the master table.</strong></p>
             <p class="text-danger text-sm">This action cannot be undone.</p>`,
            [
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

    async function triggerExport(format) {
        try {
            const result = await Api.exportData(format, searchTerm);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(result.blob);
            a.download = result.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
            App.toast(`Exporting ${format.toUpperCase()}...`, "success");
        } catch (err) {
            App.toast(err.message, "error");
        }
    }

    return { load, TITLE };
})();