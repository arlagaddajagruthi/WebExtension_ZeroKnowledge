/**
 * AUTOFILL WORKFLOW
 * 
 * Complete workflow for:
 * - Form detection (login forms)
 * - Credential matching by domain
 * - Secure credential injection
 * - Form submission detection
 */

import { getCredentialsByDomainWorkflow } from './credential-workflow';
import { getVaultState } from './vault-workflow';
import type { Credential } from '../utils/types';

export interface DetectedForm {
  id: string;
  url: string;
  usernameFieldId?: string;
  passwordFieldId?: string;
  submitButtonId?: string;
  isSuspicious: boolean;
}

export interface CredentialOption {
  id: string;
  username: string;
  domain: string;
}

/**
 * WORKFLOW 1: FORM DETECTION
 * 
 * Content script runs on page load and detects login forms
 * 
 * Flow:
 * 1. Query DOM for password inputs
 * 2. Find associated username field
 * 3. Find submit button
 * 4. Check for phishing indicators
 * 5. Report to background script
 */
export function detectLoginForms(): DetectedForm[] {
  console.log('[FORM_DETECTION] Scanning for login forms...');

  const forms: DetectedForm[] = [];
  const passwordInputs = document.querySelectorAll('input[type="password"]');

  passwordInputs.forEach((passwordField, index) => {
    try {
      // STEP 1: Verify password field is visible
      if (!isElementVisible(passwordField)) {
        console.log('[FORM_DETECTION] Password field hidden, skipping');
        return;
      }

      // STEP 2: Find parent form
      let form = passwordField.closest('form');
      if (!form) {
        // Create virtual form reference for non-form inputs
        const formContainer = passwordField.closest('div[data-form], section, main');
        form = formContainer as HTMLFormElement;
      }

      if (!form) {
        console.log('[FORM_DETECTION] No form container found');
        return;
      }

      // STEP 3: Find username field
      const usernameField = findUsernameField(form, passwordField);
      if (!usernameField) {
        console.log('[FORM_DETECTION] No username field found');
        return;
      }

      // STEP 4: Find submit button
      const submitButton = findSubmitButton(form);

      // STEP 5: Check for phishing
      const isSuspicious = checkPhishingIndicators(form);

      // STEP 6: Generate form ID
      const formId = `form_${index}_${Date.now()}`;

      // Add to detected forms
      const detectedForm: DetectedForm = {
        id: formId,
        url: window.location.href,
        usernameFieldId: (usernameField as any)?.id || `username_${index}`,
        passwordFieldId: (passwordField as any)?.id || `password_${index}`,
        submitButtonId: (submitButton as any)?.id,
        isSuspicious,
      };

      forms.push(detectedForm);

      console.log('[FORM_DETECTION] Form detected:', {
        url: window.location.href,
        hasSuspiciousElements: isSuspicious,
      });
    } catch (error) {
      console.error('[FORM_DETECTION] Error processing form:', error);
    }
  });

  return forms;
}

/**
 * WORKFLOW 2: GET MATCHING CREDENTIALS
 * 
 * Flow:
 * 1. Extract domain from current URL
 * 2. Query vault for matching credentials
 * 3. Return credential options (username + domain, no password)
 */
export async function getMatchingCredentialsWorkflow(url: string): Promise<{ options: CredentialOption[]; error?: string }> {
  try {
    console.log('[CREDENTIAL_MATCHING] Getting credentials for:', url);

    // Extract domain
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    console.log('[CREDENTIAL_MATCHING] Domain extracted:', domain);

    // Get matching credentials
    const result = await getCredentialsByDomainWorkflow(domain);
    if (result.error) {
      throw new Error(result.error);
    }

    // Create options (no passwords)
    const options: CredentialOption[] = result.credentials.map(c => ({
      id: c.id,
      username: c.username,
      domain: new URL(c.url).hostname,
    }));

    console.log('[CREDENTIAL_MATCHING] Found', options.length, 'matching credentials');

    return { options };
  } catch (error: any) {
    console.error('[CREDENTIAL_MATCHING] Error:', error.message);
    return { options: [], error: error.message };
  }
}

/**
 * WORKFLOW 3: INJECT CREDENTIAL INTO FORM
 * 
 * Flow:
 * 1. Retrieve credential from vault
 * 2. Inject username into field
 * 3. Inject password into field
 * 4. Trigger change events (for JS frameworks)
 * 5. Focus on first field
 * 6. Clear password from memory after 30s
 */
export async function injectCredentialWorkflow(
  credentialId: string,
  usernameFieldId: string,
  passwordFieldId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[CREDENTIAL_INJECTION] Injecting credential:', credentialId);

    // STEP 1: Get vault and find credential
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error('Vault is locked');
    }

    const credential = vaultResult.vault.credentials.find(c => c.id === credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    console.log('[CREDENTIAL_INJECTION] Credential retrieved');

    // STEP 2: Find form fields
    const usernameField = document.querySelector(`#${usernameFieldId}`) as HTMLInputElement ||
                         document.querySelector('input[type="email"]') as HTMLInputElement ||
                         document.querySelector('input[name*="user"], input[name*="email"]') as HTMLInputElement;

    const passwordField = document.querySelector(`#${passwordFieldId}`) as HTMLInputElement ||
                         document.querySelector('input[type="password"]') as HTMLInputElement;

    if (!usernameField || !passwordField) {
      throw new Error('Form fields not found');
    }

    // STEP 3: Inject username
    console.log('[CREDENTIAL_INJECTION] Injecting username...');
    usernameField.value = credential.username;
    usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    usernameField.dispatchEvent(new Event('change', { bubbles: true }));

    // STEP 4: Inject password
    console.log('[CREDENTIAL_INJECTION] Injecting password...');
    passwordField.value = credential.password;
    passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    passwordField.dispatchEvent(new Event('change', { bubbles: true }));

    // STEP 5: Focus on username field
    usernameField.focus();

    // STEP 6: Clear password from memory after 30 seconds
    setTimeout(() => {
      (credential as any).password = '';
      console.log('[CREDENTIAL_INJECTION] Password cleared from memory');
    }, 30000);

    console.log('[CREDENTIAL_INJECTION] Credential injected successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[CREDENTIAL_INJECTION] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 4: DETECT FORM SUBMISSION
 * 
 * Flow:
 * 1. Monitor form submit event
 * 2. Extract username + password
 * 3. Compare with existing credentials
 * 4. Determine action (save/update/ignore)
 */
export async function onFormSubmittedWorkflow(
  url: string,
  username: string,
  password: string
): Promise<{ action: 'SAVE_PROMPT' | 'UPDATE_PROMPT' | 'IGNORE'; credentialId?: string }> {
  try {
    console.log('[FORM_SUBMIT] Form submitted:', { url, username });

    // Get vault
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      return { action: 'IGNORE' };
    }

    // Find credential with same domain + username
    const existingCredential = vaultResult.vault.credentials.find(c => {
      try {
        const cUrl = new URL(c.url);
        const formUrl = new URL(url);
        return (
          cUrl.hostname === formUrl.hostname &&
          c.username === username &&
          !c._isDeleted
        );
      } catch {
        return false;
      }
    });

    // Determine action
    if (!existingCredential) {
      console.log('[FORM_SUBMIT] New credential detected, prompt to save');
      return { action: 'SAVE_PROMPT' };
    }

    if (existingCredential.password !== password) {
      console.log('[FORM_SUBMIT] Password changed, prompt to update');
      return { action: 'UPDATE_PROMPT', credentialId: existingCredential.id };
    }

    console.log('[FORM_SUBMIT] Credential unchanged, ignore');
    return { action: 'IGNORE' };
  } catch (error) {
    console.error('[FORM_SUBMIT] Error:', error);
    return { action: 'IGNORE' };
  }
}

/**
 * HELPER: Check if element is visible
 */
function isElementVisible(element: Element): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.getBoundingClientRect().height > 0
  );
}

/**
 * HELPER: Find username field in form
 */
function findUsernameField(form: HTMLFormElement, passwordField: HTMLInputElement): HTMLInputElement | null {
  // Try common selectors
  const selectors = [
    'input[type="email"]',
    'input[name*="email"]',
    'input[name*="user"]',
    'input[name*="login"]',
    'input[aria-label*="email"]',
    'input[aria-label*="user"]',
    'input[placeholder*="email"]',
    'input[placeholder*="user"]',
  ];

  for (const selector of selectors) {
    const field = form.querySelector(selector) as HTMLInputElement;
    if (field && field !== passwordField && isElementVisible(field)) {
      return field;
    }
  }

  // Fallback: Find first visible text input before password field
  const inputs = Array.from(form.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
  return inputs.find(i => isElementVisible(i)) || null;
}

/**
 * HELPER: Find submit button
 */
function findSubmitButton(form: HTMLFormElement): HTMLElement | null {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:contains("Login")',
    'button:contains("Sign In")',
    'button:contains("Submit")',
  ];

  for (const selector of selectors) {
    const button = form.querySelector(selector);
    if (button && isElementVisible(button)) {
      return button as HTMLElement;
    }
  }

  return null;
}

/**
 * HELPER: Check for phishing indicators
 */
function checkPhishingIndicators(form: HTMLFormElement): boolean {
  // Check for suspicious patterns
  const formHtml = form.outerHTML.toLowerCase();

  const suspiciousPatterns = [
    'verify', // "Verify your password"
    'confirm', // "Confirm password"
    'reenter', // "Re-enter password"
    'unusual activity', // Phishing warning
  ];

  return suspiciousPatterns.some(pattern => formHtml.includes(pattern));
}

/**
 * Declare getVaultState from vault-workflow
 * (needs to be available to content script context)
 */
declare function getVaultState(): Promise<{ vault?: any; error?: string }>;
