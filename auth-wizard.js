(function (global) {
    const STEP_LABELS = ["Account Type", "Your Info", "Address", "Security"];
    let currentStep = 1;
    let companyLogoData = null;

    function getAccountType() {
        const checked = document.querySelector('input[name="account-type"]:checked');
        return checked?.value === "company" ? "company" : "personal";
    }

    function totalSteps() { return 4; }

    function stepInfoLabel(step) {
        if (step === 2) {
            return getAccountType() === "company" ? "Company Information" : "Personal Information";
        }
        return STEP_LABELS[step - 1];
    }

    function updateProgress() {
        const wrap = document.getElementById("auth-wizard-progress");
        if (!wrap) return;
        const dots = wrap.querySelectorAll(".auth-wizard-step-dot");
        dots.forEach((dot, i) => {
            const step = i + 1;
            dot.classList.toggle("done", step < currentStep);
            dot.classList.toggle("active", step === currentStep);
        });
        const label = document.getElementById("auth-wizard-step-label");
        if (label) label.textContent = `Step ${currentStep} of ${totalSteps()}: ${stepInfoLabel(currentStep)}`;
    }

    function showStep(step) {
        currentStep = step;
        const type = getAccountType();
        document.querySelectorAll(".auth-wizard-panel").forEach((p) => {
            const panelStep = Number(p.dataset.step);
            let active = false;
            if (panelStep === step) {
                active = p.dataset.panel ? p.dataset.panel === type : true;
            }
            p.classList.toggle("active", active);
        });
        const back = document.getElementById("wizard-back");
        const next = document.getElementById("wizard-next");
        const submit = document.getElementById("wizard-submit");
        if (back) back.style.display = step > 1 ? "" : "none";
        if (next) next.style.display = step < totalSteps() ? "" : "none";
        if (submit) submit.style.display = step === totalSteps() ? "" : "none";
        updateProgress();
        syncAccountTypeUI();
    }

    function syncAccountTypeUI() {
        const type = getAccountType();
        document.body.classList.toggle("signup-company", type === "company");
        document.body.classList.toggle("signup-personal", type === "personal");
        document.querySelectorAll(".auth-type-radio").forEach((label) => {
            const input = label.querySelector('input[type="radio"]');
            label.classList.toggle("selected", input?.value === type);
        });
        if (currentStep === 2) showStep(2);
    }

    function validateCurrentStep() {
        const form = document.getElementById("signup-form");
        if (!form || !global.FormValidation) return true;
        return FormValidation.validateSignupWizardStep(form, currentStep);
    }

    function computeAgeFromDob(dob) {
        if (!dob) return null;
        const birth = new Date(dob);
        if (Number.isNaN(birth.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
        return age;
    }

    function readLogoFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function setLogoPreview(dataUrl) {
        const zone = document.getElementById("signup-logo-zone");
        const wrap = document.getElementById("signup-logo-preview-wrap");
        const preview = document.getElementById("signup-logo-preview");
        companyLogoData = dataUrl || null;
        if (dataUrl && preview && wrap) {
            preview.src = dataUrl;
            wrap.hidden = false;
            if (zone) zone.hidden = true;
        } else {
            if (wrap) wrap.hidden = true;
            if (zone) zone.hidden = false;
            if (preview) preview.removeAttribute("src");
            const input = document.getElementById("signup-logo");
            if (input) input.value = "";
        }
    }

    async function handleLogoFile(file) {
        if (!file || !file.type.startsWith("image/")) return;
        const data = await readLogoFile(file);
        setLogoPreview(data);
    }

    function initLogoDropzone() {
        const zone = document.getElementById("signup-logo-zone");
        const input = document.getElementById("signup-logo");
        if (!zone || !input) return;

        const pick = () => input.click();
        zone.addEventListener("click", pick);
        zone.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
        zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("dragover"); });
        zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
        zone.addEventListener("drop", (e) => {
            e.preventDefault();
            zone.classList.remove("dragover");
            if (e.dataTransfer.files[0]) handleLogoFile(e.dataTransfer.files[0]);
        });
        input.addEventListener("change", () => { if (input.files[0]) handleLogoFile(input.files[0]); });

        document.getElementById("signup-logo-replace")?.addEventListener("click", pick);
        document.getElementById("signup-logo-remove")?.addEventListener("click", () => setLogoPreview(null));
    }

    function init() {
        const form = document.getElementById("signup-form");
        const card = document.getElementById("auth-card");
        if (!form) return;

        form.classList.add("auth-wizard-mode");
        if (document.getElementById("signup-form")?.classList.contains("active")) {
            card?.classList.add("auth-wizard-active");
        }

        document.querySelectorAll('input[name="account-type"]').forEach((radio) => {
            radio.addEventListener("change", syncAccountTypeUI);
        });

        document.getElementById("wizard-next")?.addEventListener("click", () => {
            if (!validateCurrentStep()) return;
            if (currentStep < totalSteps()) showStep(currentStep + 1);
        });

        document.getElementById("wizard-back")?.addEventListener("click", () => {
            if (currentStep > 1) showStep(currentStep - 1);
        });

        initLogoDropzone();

        const closeBtn = document.getElementById("signup-close-btn");
        closeBtn?.addEventListener("click", () => {
            if (typeof global.switchTab === "function") global.switchTab("signin");
        });

        const origSwitchTab = global.switchTab;
        if (typeof origSwitchTab === "function") {
            global.switchTab = function (tab) {
                origSwitchTab(tab);
                const progress = document.getElementById("auth-wizard-progress");
                const close = document.getElementById("signup-close-btn");
                if (progress) progress.classList.toggle("active", tab === "signup");
                if (close) close.hidden = tab !== "signup";
                if (tab === "signup") showStep(1);
                else card?.classList.toggle("auth-wizard-active", tab === "signup");
            };
        }

        showStep(1);
        const progress = document.getElementById("auth-wizard-progress");
        if (progress && document.getElementById("signup-form")?.classList.contains("active")) {
            progress.classList.add("active");
            if (closeBtn) closeBtn.hidden = false;
        }
    }

    global.AuthWizard = {
        init,
        getAccountType,
        computeAgeFromDob,
        getCompanyLogoData: () => companyLogoData,
        showStep,
    };

    document.addEventListener("DOMContentLoaded", init);
})(window);
