// ===== BANK STATEMENTS / PDF UPLOAD MODULE =====

var UploadPage = (() => {
    const TITLE = "Bank Statements";

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
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Parsing PDF... (may take 30+ seconds for large files)";

        const resultCard = document.getElementById("upload-result");
        const resultBody = document.getElementById("upload-result-body");
        resultCard.style.display = "none";
        resultBody.innerHTML = "";

        try {
            const result = await Api.uploadPdf(file);

            // Show result
            resultCard.style.display = "block";
            resultBody.innerHTML = `
                <p><strong>File:</strong> ${App.escapeHtml(result.filename || file.name)}</p>
                <p><strong>Bank:</strong> ${App.escapeHtml(result.bank || "Unknown")}</p>
                <p><strong>Rows Read:</strong> ${result.rows_read}</p>
                <p><strong>Rows Imported:</strong> ${result.rows_imported}</p>
                <p style="color:#666; margin-top:12px;">${App.escapeHtml(result.message || "")}</p>
                <a href="#data" class="btn btn-secondary" style="margin-top:12px;">View Master Data</a>
            `;

            if (result.rows_imported > 0) {
                App.toast(`Imported ${result.rows_imported} rows from ${result.bank}`, "success");
            } else if (result.rows_read === 0) {
                App.toast("No transaction rows could be extracted from this PDF.", "warning");
            }

            // Reset form
            form.reset();
        } catch (err) {
            resultCard.style.display = "block";
            resultBody.innerHTML = `
                <p style="color:#dc3545;"><strong>Import Failed</strong></p>
                <p>${App.escapeHtml(err.message || "Unknown error")}</p>
            `;
            App.handleApiError(err);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    return { load, TITLE };
})();