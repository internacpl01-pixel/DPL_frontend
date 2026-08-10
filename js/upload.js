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
                    Upload a PDF bank statement. Transactions will be extracted and appended to the master table.
                    No duplicate checks are performed — rows are simply added.
                </p>

                <div class="card">
                    <h3>Upload PDF</h3>
                    <form id="pdf-upload-form">
                        <div class="form-group">
                            <label for="pdf-file">Choose PDF file</label>
                            <input type="file" id="pdf-file" accept="application/pdf,.pdf" required>
                            <small style="color:#666;">Accepted: PDF only (V1)</small>
                        </div>
                        <div class="form-group">
                            <label for="pdf-password">PDF Password (if encrypted)</label>
                            <input type="password" id="pdf-password" class="form-control" placeholder="Leave blank if not password-protected">
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
                <label for="pdf-password">Enter PDF Password</label>
                <input type="password" id="pdf-password" class="form-control" placeholder="Enter password to unlock PDF" autofocus>
            </div>
            <button class="btn btn-primary" id="btn-password-submit">Submit Password</button>
            <button class="btn btn-secondary" id="btn-password-cancel" style="margin-left:8px;">Cancel</button>
        `;

        document.getElementById("btn-password-submit").addEventListener("click", async () => {
            const pw = document.getElementById("pdf-password").value.trim();
            if (!pw) {
                App.toast("Please enter the password", "warning");
                return;
            }
            await submitWithPassword(file, pw);
        });

        document.getElementById("pdf-password").addEventListener("keydown", (e) => {
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
        setTimeout(() => document.getElementById("pdf-password")?.focus(), 100);
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

            resultBody.innerHTML = `
                <p><strong>File:</strong> ${App.escapeHtml(file.name)}</p>
                <p><strong>Bank:</strong> ${App.escapeHtml(result.bank || "Unknown")}</p>
                <p><strong>Rows Read:</strong> ${result.row_count}</p>
                <p><strong>Rows Imported:</strong> ${result.inserted}</p>
                <a href="#data" class="btn btn-secondary" style="margin-top:12px;">View Master Data</a>
            `;

            if (result.inserted > 0) {
                App.toast(`Imported ${result.inserted} rows from ${result.bank}`, "success");
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
                // Re-focus the password field
                setTimeout(() => document.getElementById("pdf-password")?.focus(), 100);
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

        if (!file.name.toLowerCase().endsWith(".pdf")) {
            App.toast("Only PDF files are supported", "error");
            return;
        }

        const btn = document.getElementById("btn-upload");
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        const originalText = btn.textContent;
        const password = document.getElementById("pdf-password").value.trim();
        btn.disabled = true;
        btn.textContent = `Parsing PDF (${sizeMB} MB)... please wait`;

        const resultCard = document.getElementById("upload-result");
        const resultBody = document.getElementById("upload-result-body");
        resultCard.style.display = "none";
        resultBody.innerHTML = "";

        try {
            const result = await Api.uploadPdf(file, password);

            resultCard.style.display = "block";
            resultBody.innerHTML = `
                <p><strong>File:</strong> ${App.escapeHtml(file.name)}</p>
                <p><strong>Bank:</strong> ${App.escapeHtml(result.bank || "Unknown")}</p>
                <p><strong>Rows Read:</strong> ${result.row_count}</p>
                <p><strong>Rows Imported:</strong> ${result.inserted}</p>
                <a href="#data" class="btn btn-secondary" style="margin-top:12px;">View Master Data</a>
            `;

            if (result.inserted > 0) {
                App.toast(`Imported ${result.inserted} rows from ${result.bank}`, "success");
            } else if (result.row_count === 0) {
                App.toast("No transaction rows could be extracted from this PDF.", "warning");
            }

            document.getElementById("pdf-upload-form").reset();
        } catch (err) {
            // Check if this is an encrypted PDF — show password prompt
            if (err.message && err.message.includes("ENCRYPTED")) {
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

    return { load, TITLE };
})();