// ===== BANK STATEMENTS / PDF UPLOAD MODULE =====

var UploadPage = (() => {
    const TITLE = "Bank Statements";
    let pendingFile = null;  // holds the file while waiting for password

    async function load() {
        App.setTitle(TITLE);

        const container = document.getElementById("page-content");
        container.innerHTML = `
            <div class="page-section active" id="section-upload">
                <p class="section-desc">
                    Upload a PDF bank statement or Excel (.xlsx/.xls) file. Transactions will be extracted and appended to the master table.
                    No duplicate checks are performed — rows are simply added.
                </p>

                <div class="card">
                    <h3>Upload PDF</h3>
                    <form id="pdf-upload-form">
                        <div class="form-group">
                            <label for="pdf-file">Choose file</label>
                            <input type="file" id="pdf-file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.xls" required>
                            <small style="color:#666;">Accepted: PDF or Excel (.xlsx, .xls)</small>
                        </div>
                        <div class="form-group">
                            <label for="pdf-password-input">PDF Password (if encrypted)</label>
                            <input type="password" id="pdf-password-input" class="form-control" placeholder="Leave blank if not password-protected">
                        </div>
                        <button type="submit" id="btn-upload" class="btn btn-primary">Upload and Import</button>
                    </form>
                </div>

                <div class="card" id="upload-result" style="display:none;">
                    <h3>Import Result</h3>
                    <div id="upload-result-body"></div>
                </div>
            </div>
        `;

        const form = document.getElementById("pdf-upload-form");
        form.addEventListener("submit", handleUpload);
    }

    function showPasswordPrompt(file, message) {
        const resultCard = document.getElementById("upload-result");
        const resultBody = document.getElementById("upload-result-body");
        resultCard.style.display = "block";
        resultBody.innerHTML = `
            <p style="color:#d68910; font-size:14px; margin-bottom:10px;"><strong>${App.escapeHtml(message)}</strong></p>
            <div class="form-group">
                <label for="pdf-password-prompt">Enter PDF Password</label>
                <input type="password" id="pdf-password-prompt" class="form-control" placeholder="Enter password to unlock PDF" autofocus>
            </div>
            <button class="btn btn-primary" id="btn-password-submit">Submit Password</button>
            <button class="btn btn-secondary" id="btn-password-cancel" style="margin-left:8px;">Cancel</button>
        `;

        document.getElementById("btn-password-submit").addEventListener("click", async () => {
            const pw = document.getElementById("pdf-password-prompt").value.trim();
            if (!pw) {
                App.toast("Please enter the password", "warning");
                return;
            }
            await submitWithPassword(file, pw);
        });

        document.getElementById("pdf-password-prompt").addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                const pw = e.target.value.trim();
                if (!pw) {
                    App.toast("Please enter the password", "warning");
                    return;
                }
                submitWithPassword(file, pw);
            }
        });

        document.getElementById("btn-password-cancel").addEventListener("click", () => {
            resultCard.style.display = "none";
            resultBody.innerHTML = "";
            pendingFile = null;
            document.getElementById("pdf-upload-form").reset();
        });

        // Focus the password field
        setTimeout(() => document.getElementById("pdf-password-prompt")?.focus(), 100);
    }

    async function submitWithPassword(file, password) {
        const btn = document.getElementById("btn-password-submit");
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Decrypting and parsing...";

        const resultCard = document.getElementById("upload-result");
        const resultBody = document.getElementById("upload-result-body");
        resultBody.innerHTML = `<p>${App.spinner()} Decrypting PDF...</p>`;

        try {
            const result = await Api.uploadPdf(file, password);

            resultBody.innerHTML = renderImportResult(file.name, result);

            if (result.inserted > 0) {
                App.toast(`Imported ${result.inserted} rows`, "success");
            } else if (result.row_count === 0) {
                App.toast("No transaction rows could be extracted from this PDF.", "warning");
            }

            pendingFile = null;
            document.getElementById("pdf-upload-form").reset();
        } catch (err) {
            if (err.message && err.message.includes("Incorrect password")) {
                resultBody.innerHTML = `
                    <p style="color:#dc3545;"><strong>${App.escapeHtml(err.message)}</strong></p>
                `;
                App.toast("Incorrect password", "error");
                setTimeout(() => document.getElementById("pdf-password-prompt")?.focus(), 100);
            } else {
                resultBody.innerHTML = `
                    <p style="color:#dc3545;"><strong>Import Failed</strong></p>
                    <p>${App.escapeHtml(err.message || "Unknown error")}</p>
                `;
                App.handleApiError(err);
                pendingFile = null;
                document.getElementById("pdf-upload-form").reset();
            }
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    async function handleUpload(e) {
        e.preventDefault();

        const fileInput = document.getElementById("pdf-file");
        const file = fileInput.files[0];
        if (!file) {
            App.toast("Please select a file", "warning");
            return;
        }

        const isExcel = /\.(xlsx|xls)$/i.test(file.name);
        const isPdf = /\.pdf$/i.test(file.name);

        if (!isExcel && !isPdf) {
            App.toast("Only PDF or Excel files are supported", "error");
            return;
        }

        const btn = document.getElementById("btn-upload");
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const originalText = btn.textContent;

        if (isPdf) {
            btn.disabled = true;
            btn.textContent = `Parsing PDF (${sizeMB} MB)... please wait`;
        } else {
            btn.disabled = true;
            btn.textContent = `Reading Excel (${sizeMB} MB)... please wait`;
        }

        const resultCard = document.getElementById("upload-result");
        const resultBody = document.getElementById("upload-result-body");
        resultCard.style.display = "none";
        resultBody.innerHTML = "";

        // Read password from the form's password field
        const passwordValue = document.getElementById("pdf-password-input")?.value?.trim() || "";

        // Show processing indicator during the API call
        resultCard.style.display = "block";
        resultBody.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p><strong>Parsing started, please wait...</strong></p>
                <p style="color:#888; font-size:13px;">${App.escapeHtml(file.name)} (${sizeMB} MB)</p>
            </div>
        `;

        // Yield to the browser so it paints the spinner before the await blocks the main thread
        await new Promise(resolve => requestAnimationFrame(resolve));

        try {
            const result = isExcel
                ? await Api.uploadExcel(file)
                : await Api.uploadPdf(file, passwordValue);

            resultCard.style.display = "block";
            resultBody.innerHTML = renderImportResult(file.name, result);

            if (result.inserted > 0) {
                App.toast(`Imported ${result.inserted} rows`, "success");
            } else if (result.row_count === 0) {
                App.toast("No transaction rows could be extracted.", "warning");
            }

            document.getElementById("pdf-upload-form").reset();
        } catch (err) {
            if (isPdf && err.message && err.message.includes("ENCRYPTED")) {
                btn.disabled = false;
                btn.textContent = originalText;
                pendingFile = file;
                showPasswordPrompt(file, err.message);
                return;
            }

            resultCard.style.display = "block";
            resultBody.innerHTML = `
                <p style="color:#dc3545;"><strong>Import Failed</strong></p>
                <p>${App.escapeHtml(err.message || "Unknown error")}</p>
            `;
            App.handleApiError(err);
            document.getElementById("pdf-upload-form").reset();
        } finally {
            if (!pendingFile) {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        }
    }

    function renderImportResult(fileName, result) {
        let html = `
            <p><strong>File:</strong> ${App.escapeHtml(fileName)}</p>
            <p><strong>Rows Read:</strong> ${result.row_count}</p>
            <p><strong>Rows Imported:</strong> ${result.inserted}</p>
        `;

        // Unmapped headers — PDF columns that weren't matched to any field
        if (result.unmapped_headers && result.unmapped_headers.length > 0) {
            html += `<div style="margin-top:10px; padding:8px; background:#fff3cd; border-radius:4px;">`;
            html += `<p style="color:#856404; margin:0 0 6px 0;"><strong>Unmapped PDF columns:</strong> ${App.escapeHtml(result.unmapped_headers.join(", "))}</p>`;
            html += `<p style="color:#856404; margin:0; font-size:13px;">Go to Field Mappings to map these to your custom fields.</p>`;
            html += `</div>`;
        }

        // Per-field fill rates — shows which columns got data and which didn't
        if (result.fill_rates) {
            const lowFill = Object.entries(result.fill_rates).filter(([, v]) => v.filled < v.total && v.total > 0);
            if (lowFill.length > 0) {
                html += `<div style="margin-top:10px; padding:8px; background:#f8f9fa; border-radius:4px;">`;
                html += `<p style="margin:0 0 6px 0;"><strong>Field fill rates:</strong></p>`;
                html += `<table style="font-size:13px; border-collapse:collapse;">`;
                for (const [field, info] of lowFill) {
                    const pct = Math.round((info.filled / info.total) * 100);
                    const warn = pct === 0 ? "color:#dc3545;" : pct < 50 ? "color:#d68910;" : "";
                    html += `<tr><td style="padding:2px 8px;">${App.escapeHtml(field)}</td>`;
                    html += `<td style="${warn}">${info.filled}/${info.total} (${pct}%)</td></tr>`;
                }
                html += `</table></div>`;
            }
        }

        html += `<a href="#data" class="btn btn-secondary" style="margin-top:12px;">View Master Data</a>`;
        return html;
    }

    return { load, TITLE };
})();