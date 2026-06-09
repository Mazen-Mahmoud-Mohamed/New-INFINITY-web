/**
 * Shared client-side form validation for auth and profile pages.
 */
(function (global) {
    if (global.FormValidation) return;

    const MESSAGES = {
        required: '❌ This field is required.',
        fullName: '❌ Please enter your full name using letters only.',
        companyName: '❌ Company name may only contain letters, numbers, spaces, &, -, and .',
        phone: '❌ Please enter a valid Egyptian mobile number (11 digits).',
        age: '❌ Age must be between 18 and 100.',
        email: '❌ Please enter a valid email address.',
        confirmPassword: '❌ Passwords do not match.'
    };

    const EGYPT_MOBILE_PREFIXES = ['010', '011', '012', '015'];

    function trim(value) {
        return String(value == null ? '' : value).trim();
    }

    function validateFullName(value) {
        const v = trim(value);
        if (!v) return { valid: false, message: MESSAGES.required };
        if (!/^[A-Za-z]+(?:\s+[A-Za-z]+)+$/.test(v)) {
            return { valid: false, message: MESSAGES.fullName };
        }
        const parts = v.split(/\s+/);
        if (parts.some((part) => part.length < 2) || v.length < 5) {
            return { valid: false, message: MESSAGES.fullName };
        }
        return { valid: true };
    }

    function validateCompanyName(value) {
        const v = trim(value);
        if (!v) return { valid: true };
        if (!/^[A-Za-z0-9\s&\-.]+$/.test(v) || v.length < 2) {
            return { valid: false, message: MESSAGES.companyName };
        }
        return { valid: true };
    }

    function validateEgyptPhone(value) {
        const v = trim(value).replace(/\D/g, '');
        if (!v) return { valid: false, message: MESSAGES.required };
        if (v.length !== 11) return { valid: false, message: MESSAGES.phone };
        const prefix = v.slice(0, 3);
        if (!EGYPT_MOBILE_PREFIXES.includes(prefix)) {
            return { valid: false, message: MESSAGES.phone };
        }
        return { valid: true, normalized: v };
    }

    function validateAge(value, required) {
        const raw = trim(value);
        if (!raw) return required ? { valid: false, message: MESSAGES.required } : { valid: true };
        if (!/^\d+$/.test(raw)) return { valid: false, message: MESSAGES.age };
        const n = Number(raw);
        if (n < 18 || n > 100) return { valid: false, message: MESSAGES.age };
        return { valid: true, normalized: n };
    }

    function validateEmail(value) {
        const v = trim(value);
        if (!v) return { valid: false, message: MESSAGES.required };
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRe.test(v)) return { valid: false, message: MESSAGES.email };
        return { valid: true };
    }

    function getPasswordChecks(value) {
        return {
            length: value.length >= 8,
            upper: /[A-Z]/.test(value),
            lower: /[a-z]/.test(value),
            number: /\d/.test(value),
            special: /[^A-Za-z0-9]/.test(value)
        };
    }

    function isPrimaryPasswordInput(input) {
        if (!input || input.type !== 'password') return false;
        const id = input.id || '';
        return id.includes('password') && !id.includes('confirm');
    }

    function validatePassword(value) {
        const v = String(value || '');
        if (!v) return { valid: false, message: MESSAGES.required };
        const checks = getPasswordChecks(v);
        if (!checks.length || !checks.upper || !checks.lower || !checks.number || !checks.special) {
            return { valid: false };
        }
        return { valid: true };
    }

    function validateConfirmPassword(password, confirm) {
        if (!trim(confirm)) return { valid: false, message: MESSAGES.required };
        if (password !== confirm) return { valid: false, message: MESSAGES.confirmPassword };
        return { valid: true };
    }

    function validateSelect(value) {
        if (!trim(value)) return { valid: false, message: MESSAGES.required };
        return { valid: true };
    }

    function getFieldContainer(input) {
        return input.closest('.form-group, .cp-group') || input.parentElement;
    }

    function ensureErrorElement(input) {
        const container = getFieldContainer(input);
        if (!container) return null;
        let el = container.querySelector('.field-error');
        if (!el) {
            el = document.createElement('div');
            el.className = 'field-error';
            el.setAttribute('role', 'alert');
            const passwordField = input.closest('.password-field');
            if (passwordField) {
                passwordField.insertAdjacentElement('afterend', el);
            } else {
                input.insertAdjacentElement('afterend', el);
            }
        }
        return el;
    }

    function setFieldError(input, message) {
        if (!input) return;
        const container = getFieldContainer(input);
        const passwordField = isPrimaryPasswordInput(input);
        const errorEl = passwordField ? null : ensureErrorElement(input);
        input.classList.add('is-invalid');
        input.setAttribute('aria-invalid', 'true');
        if (container) container.classList.add('has-error');
        if (passwordField) {
            const stray = container && container.querySelector('.field-error');
            if (stray) {
                stray.textContent = '';
                stray.classList.remove('visible');
            }
            return;
        }
        if (errorEl) {
            errorEl.textContent = message || '';
            errorEl.classList.add('visible');
        }
    }

    function clearFieldError(input) {
        if (!input) return;
        const container = getFieldContainer(input);
        const errorEl = container && container.querySelector('.field-error');
        input.classList.remove('is-invalid');
        input.removeAttribute('aria-invalid');
        if (container) container.classList.remove('has-error');
        if (errorEl && !isPrimaryPasswordInput(input)) {
            errorEl.textContent = '';
            errorEl.classList.remove('visible');
        }
    }

    function sanitizePhoneInput(input) {
        const digits = input.value.replace(/\D/g, '').slice(0, 11);
        if (input.value !== digits) input.value = digits;
    }

    function sanitizeAgeInput(input) {
        const digits = input.value.replace(/\D/g, '').slice(0, 3);
        if (input.value !== digits) input.value = digits;
    }

    function sanitizeFullNameInput(input) {
        const cleaned = input.value.replace(/[^A-Za-z\s]/g, '').replace(/\s{2,}/g, ' ');
        if (input.value !== cleaned) input.value = cleaned;
    }

    function sanitizeCompanyNameInput(input) {
        const cleaned = input.value.replace(/[^A-Za-z0-9\s&\-.]/g, '');
        if (input.value !== cleaned) input.value = cleaned;
    }

    function updatePasswordRequirements(passwordInput, requirementsEl) {
        if (!requirementsEl || !passwordInput) return;
        const value = passwordInput.value;
        const checks = getPasswordChecks(value);
        const hasInput = value.length > 0;
        requirementsEl.querySelectorAll('[data-rule]').forEach((item) => {
            const rule = item.getAttribute('data-rule');
            const ok = checks[rule];
            item.classList.remove('pending', 'met', 'fail');
            if (!hasInput) {
                item.classList.add('pending');
            } else if (ok) {
                item.classList.add('met');
            } else {
                item.classList.add('fail');
            }
        });
    }

    function bindField(input, validateFn, options) {
        if (!input) return;
        const { onInput, liveConfirmTarget } = options || {};

        const run = () => {
            const result = validateFn();
            if (result.valid) {
                clearFieldError(input);
            } else if (isPrimaryPasswordInput(input)) {
                setFieldError(input);
            } else if (result.message) {
                setFieldError(input, result.message);
            }
            if (typeof onInput === 'function') onInput(result);
            if (liveConfirmTarget) {
                const confirmInput = liveConfirmTarget;
                const confirmResult = validateConfirmPassword(input.value, confirmInput.value);
                if (!confirmResult.valid && trim(confirmInput.value)) {
                    setFieldError(confirmInput, confirmResult.message);
                } else if (confirmResult.valid) {
                    clearFieldError(confirmInput);
                }
            }
            return result.valid;
        };

        const onEdit = () => {
            if (input.id && input.id.includes('phone')) sanitizePhoneInput(input);
            if (input.type === 'number' || (input.id && input.id.includes('age'))) sanitizeAgeInput(input);
            if (input.id && input.id.includes('name') && !input.id.includes('company')) sanitizeFullNameInput(input);
            if (input.id && input.id.includes('company-name')) sanitizeCompanyNameInput(input);
            run();
        };

        input.addEventListener('input', onEdit);
        input.addEventListener('change', onEdit);
        input.addEventListener('blur', run);
        return run;
    }

    function validateSignupForm(form) {
        const name = form.querySelector('#signup-name');
        const phone = form.querySelector('#signup-phone');
        const age = form.querySelector('#signup-age');
        const gender = form.querySelector('#signup-gender');
        const state = form.querySelector('#signup-state');
        const companyName = form.querySelector('#signup-company-name');
        const email = form.querySelector('#signup-email');
        const password = form.querySelector('#signup-password');
        const confirm = form.querySelector('#signup-confirm-password');

        const checks = [
            validateFullName(name.value),
            validateEgyptPhone(phone.value),
            validateAge(age.value, true),
            validateSelect(gender.value),
            validateSelect(state.value),
            validateCompanyName(companyName.value),
            validateEmail(email.value),
            validatePassword(password.value),
            validateConfirmPassword(password.value, confirm.value)
        ];

        const fields = [name, phone, age, gender, state, companyName, email, password, confirm];
        let firstInvalid = null;

        checks.forEach((result, i) => {
            const input = fields[i];
            if (!result.valid) {
                if (isPrimaryPasswordInput(input)) {
                    setFieldError(input);
                    updatePasswordRequirements(input, form.querySelector('.password-requirements'));
                } else {
                    setFieldError(input, result.message);
                }
                if (!firstInvalid) firstInvalid = input;
            } else {
                clearFieldError(input);
            }
        });

        if (firstInvalid) {
            firstInvalid.focus();
            return false;
        }
        return true;
    }

    function validateCompleteProfileForm(form) {
        const phone = form.querySelector('#cp-phone');
        const age = form.querySelector('#cp-age');
        const companyName = form.querySelector('#cp-company-name');
        const password = form.querySelector('#cp-password');
        const confirm = form.querySelector('#cp-confirm-password');

        const checks = [
            validateEgyptPhone(phone.value),
            validateAge(age.value, false),
            validateCompanyName(companyName.value),
            validatePassword(password.value),
            validateConfirmPassword(password.value, confirm.value)
        ];

        const fields = [phone, age, companyName, password, confirm];
        let firstInvalid = null;

        checks.forEach((result, i) => {
            const input = fields[i];
            if (!result.valid) {
                if (isPrimaryPasswordInput(input)) {
                    setFieldError(input);
                    updatePasswordRequirements(input, form.querySelector('.password-requirements'));
                } else {
                    setFieldError(input, result.message);
                }
                if (!firstInvalid) firstInvalid = input;
            } else {
                clearFieldError(input);
            }
        });

        if (firstInvalid) {
            firstInvalid.focus();
            return false;
        }
        return true;
    }

    function attachSignupValidation(form) {
        if (!form) return;

        const name = form.querySelector('#signup-name');
        const phone = form.querySelector('#signup-phone');
        const age = form.querySelector('#signup-age');
        const gender = form.querySelector('#signup-gender');
        const state = form.querySelector('#signup-state');
        const companyName = form.querySelector('#signup-company-name');
        const email = form.querySelector('#signup-email');
        const password = form.querySelector('#signup-password');
        const confirm = form.querySelector('#signup-confirm-password');

        if (phone) {
            phone.setAttribute('maxlength', '11');
            phone.setAttribute('inputmode', 'numeric');
            phone.setAttribute('autocomplete', 'tel');
        }
        if (age) {
            age.removeAttribute('type');
            age.setAttribute('inputmode', 'numeric');
            age.setAttribute('maxlength', '3');
        }

        let requirementsEl = form.querySelector('.password-requirements');
        if (!requirementsEl && password) {
            requirementsEl = document.createElement('div');
            requirementsEl.className = 'password-requirements';
            requirementsEl.innerHTML = [
                '<p class="password-requirements-title">Password must include:</p>',
                '<ul>',
                '<li class="pending" data-rule="length">8+ characters</li>',
                '<li class="pending" data-rule="upper">One uppercase letter</li>',
                '<li class="pending" data-rule="lower">One lowercase letter</li>',
                '<li class="pending" data-rule="number">One number</li>',
                '<li class="pending" data-rule="special">One special character</li>',
                '</ul>'
            ].join('');
            const passwordGroup = password.closest('.form-group');
            if (passwordGroup) passwordGroup.appendChild(requirementsEl);
        }

        bindField(name, () => validateFullName(name.value));
        bindField(phone, () => validateEgyptPhone(phone.value));
        bindField(age, () => validateAge(age.value, true));
        bindField(gender, () => validateSelect(gender.value));
        bindField(state, () => validateSelect(state.value));
        bindField(companyName, () => validateCompanyName(companyName.value));
        bindField(email, () => validateEmail(email.value));
        bindField(password, () => validatePassword(password.value), {
            onInput: () => updatePasswordRequirements(password, requirementsEl),
            liveConfirmTarget: confirm
        });
        bindField(confirm, () => validateConfirmPassword(password.value, confirm.value));

        updatePasswordRequirements(password, requirementsEl);
    }

    function attachCompleteProfileValidation(form) {
        if (!form) return;

        const phone = form.querySelector('#cp-phone');
        const age = form.querySelector('#cp-age');
        const companyName = form.querySelector('#cp-company-name');
        const password = form.querySelector('#cp-password');
        const confirm = form.querySelector('#cp-confirm-password');

        if (phone) {
            phone.setAttribute('maxlength', '11');
            phone.setAttribute('inputmode', 'numeric');
        }
        if (age) {
            age.removeAttribute('type');
            age.setAttribute('inputmode', 'numeric');
            age.setAttribute('maxlength', '3');
        }

        let requirementsEl = form.querySelector('.password-requirements');
        if (!requirementsEl && password) {
            requirementsEl = document.createElement('div');
            requirementsEl.className = 'password-requirements';
            requirementsEl.innerHTML = [
                '<p class="password-requirements-title">Password must include:</p>',
                '<ul>',
                '<li class="pending" data-rule="length">8+ characters</li>',
                '<li class="pending" data-rule="upper">One uppercase letter</li>',
                '<li class="pending" data-rule="lower">One lowercase letter</li>',
                '<li class="pending" data-rule="number">One number</li>',
                '<li class="pending" data-rule="special">One special character</li>',
                '</ul>'
            ].join('');
            const passwordGroup = password.closest('.cp-group');
            if (passwordGroup) passwordGroup.appendChild(requirementsEl);
        }

        bindField(phone, () => validateEgyptPhone(phone.value));
        bindField(age, () => validateAge(age.value, false));
        bindField(companyName, () => validateCompanyName(companyName.value));
        bindField(password, () => validatePassword(password.value), {
            onInput: () => updatePasswordRequirements(password, requirementsEl),
            liveConfirmTarget: confirm
        });
        bindField(confirm, () => validateConfirmPassword(password.value, confirm.value));

        updatePasswordRequirements(password, requirementsEl);
    }

    global.FormValidation = {
        MESSAGES,
        validateFullName,
        validateCompanyName,
        validateEgyptPhone,
        validateAge,
        validateEmail,
        validatePassword,
        validateConfirmPassword,
        setFieldError,
        clearFieldError,
        attachSignupValidation,
        attachCompleteProfileValidation,
        validateSignupForm,
        validateCompleteProfileForm
    };
})(typeof window !== 'undefined' ? window : globalThis);
