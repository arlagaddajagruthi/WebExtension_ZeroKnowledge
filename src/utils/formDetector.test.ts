import { describe, it, expect } from 'vitest';
import { detectLoginForms, isLoginForm } from './formDetector';

describe('formDetector', () => {
    it('should detect a standard login form', () => {
        document.body.innerHTML = `
            <form id="login">
                <input type="text" name="username" />
                <input type="password" name="password" />
                <button type="submit">Login</button>
            </form>
        `;

        const forms = detectLoginForms();
        expect(forms).toHaveLength(1);
        expect(forms[0].usernameField).not.toBeNull();
        expect(forms[0].passwordField).not.toBeNull();
    });

    it('should ignore forms without password fields', () => {
        document.body.innerHTML = `
            <form id="search">
                <input type="text" name="query" />
                <button type="submit">Search</button>
            </form>
        `;

        const forms = detectLoginForms();
        expect(forms).toHaveLength(0);
    });

    it('should correctly identify a login form based on heuristics', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input type="text" name="user" />
            <input type="password" name="pass" />
            <button>Sign In</button>
        `;

        expect(isLoginForm(form)).toBe(true);
    });

    it('should reject a registration form', () => {
        const form = document.createElement('form');
        form.innerHTML = `
            <input type="text" name="user" />
            <input type="password" name="pass" />
            <button>Create Account</button>
        `;
        // Since isLoginForm implementation checks for 'sign up' text, 
        // ensuring the test matches logic.
        expect(isLoginForm(form)).toBe(false);
    });
});
