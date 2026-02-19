// Form detection and parsing utilities

export interface LoginForm {
    form: HTMLFormElement;
    usernameField: HTMLInputElement | null;
    passwordField: HTMLInputElement;
    url: string;
}

export interface FormCredentials {
    url: string;
    username: string;
    password: string;
    usernameFieldName?: string;
    passwordFieldName?: string;
}

/**
 * Detect all login forms on the current page
 */
export function detectLoginForms(): LoginForm[] {
    const forms = document.querySelectorAll('form');
    const loginForms: LoginForm[] = [];

    forms.forEach((form) => {
        const passwordField = form.querySelector('input[type="password"]') as HTMLInputElement;

        if (passwordField) {
            const usernameField = findUsernameField(form, passwordField);

            loginForms.push({
                form,
                usernameField,
                passwordField,
                url: window.location.href,
            });
        }
    });

    return loginForms;
}

/**
 * Find the username field associated with a password field
 * Looks for email or text inputs before the password field
 */
function findUsernameField(
    form: HTMLFormElement,
    passwordField: HTMLInputElement
): HTMLInputElement | null {
    const inputs = Array.from(form.querySelectorAll('input'));
    const passwordIndex = inputs.indexOf(passwordField);

    // Look backwards from password field
    for (let i = passwordIndex - 1; i >= 0; i--) {
        const input = inputs[i];
        const type = input.type.toLowerCase();

        // Check for email, text, or tel inputs
        if (
            type === 'email' ||
            type === 'text' ||
            type === 'tel' ||
            input.name.toLowerCase().includes('user') ||
            input.name.toLowerCase().includes('email') ||
            input.name.toLowerCase().includes('login')
        ) {
            return input;
        }
    }

    return null;
}

/**
 * Extract credentials from a form
 */
export function extractFormCredentials(loginForm: LoginForm): FormCredentials | null {
    const { usernameField, passwordField, url } = loginForm;

    const password = passwordField.value;
    const username = usernameField?.value || '';

    // Don't extract if password is empty
    if (!password) {
        return null;
    }

    return {
        url,
        username,
        password,
        usernameFieldName: usernameField?.name || usernameField?.id || 'username',
        passwordFieldName: passwordField.name || passwordField.id || 'password',
    };
}

/**
 * Fill a form with credentials
 */
export function fillForm(
    loginForm: LoginForm,
    credentials: { username: string; password: string }
): void {
    const { usernameField, passwordField } = loginForm;

    if (usernameField) {
        usernameField.value = credentials.username;
        // Trigger input event for React/Vue forms
        usernameField.dispatchEvent(new Event('input', { bubbles: true }));
        usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    passwordField.value = credentials.password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Check if a form is likely a login form (not registration or password reset)
 */
export function isLoginForm(form: HTMLFormElement): boolean {
    const formText = form.textContent?.toLowerCase() || '';
    const formAction = form.action.toLowerCase();

    // Exclude registration forms primarily by action or clear title indicators
    // Be careful not to exclude login forms that just have a "Sign up" link

    // Check form attributes first
    if (
        formAction.includes('register') ||
        formAction.includes('signup')
    ) {
        return false;
    }

    // Check specific submit buttons, which is more reliable than general form text
    // Check specific submit buttons (including implicit ones)
    const submitBtn = form.querySelector('button:not([type="button"]):not([type="reset"]), input[type="submit"]');
    if (submitBtn) {
        const btnText = submitBtn.textContent?.toLowerCase() || (submitBtn as HTMLInputElement).value?.toLowerCase() || '';
        if (btnText.includes('sign up') || btnText.includes('create account') || btnText.includes('register')) {
            return false;
        }
    }

    return true;
}


/**
 * Observe DOM for dynamically added forms
 */
export function observeForForms(callback: (forms: LoginForm[]) => void): MutationObserver {
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;

        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }

        if (shouldCheck) {
            const forms = detectLoginForms();
            if (forms.length > 0) {
                callback(forms);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    return observer;
}
