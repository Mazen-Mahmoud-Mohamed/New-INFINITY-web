(function (global) {
    if (global.DashboardExtensions) return;

    const STAFF_ROLES = ["employee", "manager", "primary"];

    function canStaffSupport(role) {
        return STAFF_ROLES.includes(role);
    }

    function esc(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function formatDate(d) {
        if (!d) return "—";
        return new Date(d).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }

    function fileUrl(raw) {
        if (!raw) return "";
        const s = String(raw);
        if (s.startsWith("http") || s.startsWith("data:")) return s;
        return s.startsWith("/") ? s : `/${s}`;
    }

    function isImageMime(mime, url) {
        if (mime?.startsWith("image/")) return true;
        return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url || "");
    }

    function isPdfMime(mime, url) {
        if (mime === "application/pdf") return true;
        return /\.pdf(\?|$)/i.test(url || "");
    }

    function readFilesAsAttachments(fileList) {
        const files = Array.from(fileList || []).slice(0, 3);
        return Promise.all(files.map((file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ data: reader.result });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        })));
    }

    function renderMessageAttachments(attachments) {
        if (!attachments?.length) return "";
        const items = attachments.map((att, i) => {
            const url = fileUrl(att.url || att.data);
            if (!url) return "";
            const name = esc(att.filename || `Attachment ${i + 1}`);
            if (isImageMime(att.mimeType, url)) {
                return `<a class="dash-attach-thumb" href="${esc(url)}" target="_blank" rel="noopener" title="${name}">
                    <img src="${esc(url)}" alt="${name}">
                </a>`;
            }
            if (isPdfMime(att.mimeType, url)) {
                return `<a class="dash-attach-file" href="${esc(url)}" target="_blank" rel="noopener"><i class="fas fa-file-pdf"></i> ${name}</a>`;
            }
            return `<a class="dash-attach-file" href="${esc(url)}" target="_blank" rel="noopener" download><i class="fas fa-paperclip"></i> ${name}</a>`;
        }).join("");
        return items ? `<div class="dash-msg-attachments">${items}</div>` : "";
    }

    const DOC_LABELS = {
        national_id_front: "National ID (Front)",
        national_id_back: "National ID (Back)",
        driving_license_front: "Driving License (Front)",
        driving_license_back: "Driving License (Back)",
        commercial_register: "Commercial Register",
        tax_card: "Tax Card",
        company_license: "Company Logo",
    };

    function docViewUrl(userId, docType) {
        return `/api/dashboard/verification/document?userId=${encodeURIComponent(userId)}&docType=${encodeURIComponent(docType)}`;
    }

    function renderDocPreview(userId, doc) {
        const src = docViewUrl(userId, doc.type);
        const label = esc(DOC_LABELS[doc.type] || doc.type);
        const uploaded = doc.uploadedAt ? `<small class="muted">Uploaded ${formatDate(doc.uploadedAt)}</small>` : "";
        if (isImageMime(doc.mimeType, doc.url)) {
            return `<a class="dash-doc-preview" href="${esc(src)}" target="_blank" rel="noopener">
                <img src="${esc(src)}" alt="${label}">
            </a>`;
        }
        if (isPdfMime(doc.mimeType, doc.url)) {
            return `<a class="dash-doc-preview dash-doc-pdf" href="${esc(src)}" target="_blank" rel="noopener">
                <i class="fas fa-file-pdf"></i><span>PDF</span>
            </a>`;
        }
        return `<a class="dash-doc-preview dash-doc-file" href="${esc(src)}" target="_blank" rel="noopener">
            <i class="fas fa-file"></i><span>File</span>
        </a>`;
    }

    let supportTickets = [];
    let activeSupportId = null;
    let verificationUsers = [];
    let activeVerificationId = null;

    async function loadSupportTickets() {
        const status = document.getElementById("dash-support-status")?.value || "";
        const category = document.getElementById("dash-support-category")?.value || "";
        const search = document.getElementById("dash-support-search")?.value?.trim() || "";
        const params = new URLSearchParams();
        if (status) params.set("status", status);
        if (category) params.set("category", category);
        if (search) params.set("search", search);
        const list = document.getElementById("dash-support-list");
        if (list && window.InfinityLoader) list.innerHTML = `<div class="muted" style="padding:1rem;">Loading…</div>`;
        const res = await fetch(`/api/dashboard/support/tickets?${params}`, { credentials: "include" });
        const data = await res.json();
        supportTickets = data.tickets || [];
        renderSupportList();
    }

    function renderSupportList() {
        const list = document.getElementById("dash-support-list");
        if (!list) return;
        if (!supportTickets.length) {
            list.innerHTML = `<div class="muted" style="padding:1rem;text-align:center;">No tickets found.</div>`;
            return;
        }
        list.innerHTML = supportTickets.map((t) => `
            <button type="button" class="ap-ticket-item dash-support-item" data-id="${t._id}" style="width:100%;text-align:left;">
                <strong>${esc(t.subject)}</strong><br>
                <small class="muted">${esc(t.ticketNumber)} · ${esc((t.status || "").replace(/_/g, " "))} · ${esc(t.customer?.name || t.customer?.email || "Customer")}</small>
            </button>
        `).join("");
        list.querySelectorAll("[data-id]").forEach((btn) => {
            btn.addEventListener("click", () => openSupportTicket(btn.dataset.id));
        });
    }

    async function openSupportTicket(id) {
        activeSupportId = id;
        const res = await fetch(`/api/dashboard/support/tickets/${id}`, { credentials: "include" });
        if (!res.ok) return;
        const { ticket, customer } = await res.json();
        document.getElementById("dash-support-detail").hidden = false;
        document.getElementById("dash-support-empty").hidden = true;
        document.getElementById("dash-support-subject").textContent = ticket.subject;
        document.getElementById("dash-support-meta").innerHTML = `
            ${esc(ticket.ticketNumber)} · ${esc(ticket.category)} ·
            <select id="dash-support-status-select">
                ${["open", "in_progress", "waiting_customer", "resolved", "closed"].map((s) =>
                    `<option value="${s}" ${ticket.status === s ? "selected" : ""}>${s.replace(/_/g, " ")}</option>`
                ).join("")}
            </select>
        `;
        document.getElementById("dash-support-customer").innerHTML = customer
            ? `<strong>${esc(customer.name)}</strong> · ${esc(customer.email)} · ${esc(customer.phone || "-")} · ${esc(customer.accountType || "personal")}`
            : "";
        const chat = document.getElementById("dash-support-chat");
        chat.innerHTML = (ticket.messages || []).map((m) => {
            const staff = STAFF_ROLES.concat(["technical"]).includes(m.authorRole);
            const cls = staff ? "staff" : "user";
            const attachments = renderMessageAttachments(m.attachments);
            const time = formatDate(m.createdAt);
            return `<div class="dash-support-msg ${cls}">
                <div class="dash-support-msg-head"><strong>${esc(m.authorName || (staff ? "Staff" : "Customer"))}</strong><span>${time}</span></div>
                <div class="dash-support-msg-body">${esc(m.body).replace(/\n/g, "<br>")}${attachments}</div>
            </div>`;
        }).join("");
        chat.scrollTop = chat.scrollHeight;
        document.getElementById("dash-support-status-select")?.addEventListener("change", async (e) => {
            await fetch(`/api/dashboard/support/tickets/${id}/status`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: e.target.value }),
            });
            await loadSupportTickets();
            openSupportTicket(id);
        });
    }

    async function loadVerificationQueue() {
        const tbody = document.querySelector("#verification-table tbody");
        if (tbody && window.InfinityLoader) {
            tbody.innerHTML = window.InfinityLoader.skeletonTableBody(4, 6);
        }
        const filter = document.getElementById("dash-verification-filter")?.value || "actionable";
        const res = await fetch(`/api/dashboard/verification/pending?status=${encodeURIComponent(filter)}`, { credentials: "include" });
        const data = await res.json();
        verificationUsers = data.users || [];
        renderVerificationTable();
    }

    function statusLabel(status) {
        const map = {
            none: "Not submitted",
            pending: "Pending review",
            approved: "Approved",
            rejected: "Rejected",
            reupload_requested: "Rejected",
        };
        return map[status] || status || "—";
    }

    function renderVerificationTable() {
        const tbody = document.querySelector("#verification-table tbody");
        if (!tbody) return;
        tbody.innerHTML = "";
        if (!verificationUsers.length) {
            tbody.innerHTML = `<tr><td colspan="6" class="muted" style="text-align:center;padding:1rem;">No users in this view.</td></tr>`;
            return;
        }
        verificationUsers.forEach((u) => {
            const idStatus = u.identityVerification?.status || "none";
            const avatar = u.profilePicture
                ? `<img src="${esc(u.profilePicture)}" alt="" class="dash-user-avatar">`
                : `<span class="dash-user-avatar dash-user-avatar--text">${esc((u.name || "U").charAt(0).toUpperCase())}</span>`;
            const submitted = u.identityVerification?.submittedAt
                ? formatDate(u.identityVerification.submittedAt)
                : "—";
            const docCount = (u.identityVerification?.documents || []).filter((d) => d.url).length;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td data-label="Customer"><div class="dash-user-cell">${avatar}<div><strong>${esc(u.name || "-")}</strong><br><small class="muted">${docCount} file(s)</small></div></div></td>
                <td data-label="Email">${esc(u.email || "-")}</td>
                <td data-label="Account">${esc(u.accountType === "company" ? "Company" : "Personal")}</td>
                <td data-label="Status"><span class="ap-chip ${idStatus === "approved" ? "ok" : idStatus === "pending" ? "pending" : idStatus === "none" ? "pending" : "bad"}">${esc(statusLabel(idStatus))}</span></td>
                <td data-label="Submitted">${esc(submitted)}</td>
                <td data-label="Actions">
                    <div style="display:flex;gap:.35rem;flex-wrap:wrap;">
                        <button type="button" class="dash-btn ghost" data-review="${u._id}">View Documents</button>
                        <button type="button" class="dash-btn primary" data-quick-approve="${u._id}">Approve</button>
                        <button type="button" class="dash-btn ghost" data-quick-reject="${u._id}">Reject</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
        tbody.querySelectorAll("[data-review]").forEach((btn) => {
            btn.addEventListener("click", () => openVerificationReview(btn.dataset.review));
        });
        tbody.querySelectorAll("[data-quick-approve]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                await fetch(`/api/dashboard/verification/user/${btn.dataset.quickApprove}/review`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "approved", notes: "" }),
                });
                await loadVerificationQueue();
            });
        });
        tbody.querySelectorAll("[data-quick-reject]").forEach((btn) => {
            btn.addEventListener("click", async () => {
                const notes = prompt("Rejection reason (optional):") || "";
                await fetch(`/api/dashboard/verification/user/${btn.dataset.quickReject}/review`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "rejected", notes }),
                });
                await loadVerificationQueue();
            });
        });
    }

    async function openVerificationReview(userId) {
        activeVerificationId = userId;
        const res = await fetch(`/api/dashboard/verification/user/${userId}`, { credentials: "include" });
        if (!res.ok) return;
        const { user } = await res.json();
        const panel = document.getElementById("dash-verification-detail");
        panel.hidden = false;
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        document.getElementById("dash-verification-user").textContent = `${user.name} (${user.email}) — ${user.accountType}`;
        const docs = user.identityVerification?.documents || [];
        document.getElementById("dash-verification-docs").innerHTML = docs.length ? docs.map((d) => `
            <div class="dash-doc-review-row">
                <div class="dash-doc-review-head">
                    <div>
                        <strong>${esc(DOC_LABELS[d.type] || d.type)}</strong>
                        ${d.uploadedAt ? `<div class="muted" style="font-size:.78rem;">Uploaded ${formatDate(d.uploadedAt)}</div>` : ""}
                    </div>
                    <span class="doc-status-pill ${d.status || "draft"}">${esc(d.status || "draft")}</span>
                </div>
                ${d.rejectionReason ? `<p class="ap-sub" style="color:#b91c1c;margin:.35rem 0;">${esc(d.rejectionReason)}</p>` : ""}
                <div class="dash-doc-preview-row">${renderDocPreview(userId, d)}</div>
                <div class="dash-doc-review-actions">
                    <a href="${esc(docViewUrl(userId, d.type))}" target="_blank" rel="noopener" class="dash-btn ghost">Open Full Size</a>
                    <a href="${esc(docViewUrl(userId, d.type))}" download class="dash-btn ghost">Download</a>
                    <button type="button" class="dash-btn primary doc-approve-btn" data-type="${d.type}">Approve</button>
                    <button type="button" class="dash-btn ghost doc-reject-btn" data-type="${d.type}">Reject</button>
                </div>
                <input type="text" class="doc-reject-reason" data-type="${d.type}" placeholder="Rejection reason (optional)">
            </div>
        `).join("") : `<p class="muted">No documents uploaded yet.</p>`;

        document.querySelectorAll(".doc-approve-btn").forEach((btn) => {
            btn.addEventListener("click", () => reviewDocument(userId, btn.dataset.type, "approved", ""));
        });
        document.querySelectorAll(".doc-reject-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                const reason = document.querySelector(`.doc-reject-reason[data-type="${btn.dataset.type}"]`)?.value || "";
                reviewDocument(userId, btn.dataset.type, "rejected", reason);
            });
        });
        document.getElementById("dash-verification-notes").value = user.identityVerification?.staffNotes || "";
    }

    async function reviewDocument(userId, docType, status, reason) {
        await fetch(`/api/dashboard/verification/user/${userId}/document-review`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ docType, status, reason }),
        });
        await openVerificationReview(userId);
        await loadVerificationQueue();
    }

    function wireEvents() {
        document.getElementById("dash-support-search")?.addEventListener("input", () => loadSupportTickets());
        document.getElementById("dash-support-status")?.addEventListener("change", () => loadSupportTickets());
        document.getElementById("dash-support-category")?.addEventListener("change", () => loadSupportTickets());
        document.getElementById("dash-verification-filter")?.addEventListener("change", () => loadVerificationQueue());

        document.getElementById("dash-support-reply-form")?.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!activeSupportId) return;
            const body = document.getElementById("dash-support-reply-body").value.trim();
            const fileInput = document.getElementById("dash-support-reply-attachments");
            let attachments = [];
            if (fileInput?.files?.length) {
                attachments = await readFilesAsAttachments(fileInput.files);
            }
            const res = await fetch(`/api/dashboard/support/tickets/${activeSupportId}/reply`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body, attachments }),
            });
            if (res.ok) {
                document.getElementById("dash-support-reply-body").value = "";
                if (fileInput) fileInput.value = "";
                await loadSupportTickets();
                openSupportTicket(activeSupportId);
            }
        });

        document.getElementById("dash-verification-approve")?.addEventListener("click", () => submitReview("approved"));
        document.getElementById("dash-verification-reject")?.addEventListener("click", () => submitReview("rejected"));
        document.getElementById("dash-verification-reupload")?.addEventListener("click", () => submitReview("reupload_requested"));
    }

    async function submitReview(action) {
        if (!activeVerificationId) return;
        const notes = document.getElementById("dash-verification-notes").value.trim();
        await fetch(`/api/dashboard/verification/user/${activeVerificationId}/review`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, notes }),
        });
        document.getElementById("dash-verification-detail").hidden = true;
        activeVerificationId = null;
        await loadVerificationQueue();
    }

    async function init(role) {
        if (!canStaffSupport(role)) return;
        const supportTab = document.getElementById("support-tab");
        const verificationTab = document.getElementById("verification-tab");
        if (supportTab) supportTab.style.display = "";
        if (verificationTab) verificationTab.style.display = "";
        wireEvents();
        await Promise.all([loadSupportTickets(), loadVerificationQueue()]);
    }

    global.DashboardExtensions = {
        init,
        canStaffSupport,
        openVerificationReview,
        loadVerificationQueue,
    };
})(window);
