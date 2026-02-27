import {
  detectLoginForms,
  extractFormCredentials,
  fillForm,
  isLoginForm,
  observeForForms,
  type LoginForm,
} from '../../utils/formDetector';
import { sendToBackground, MessageType } from '../../utils/messaging';
import { extractDomain } from '../../utils/urlMatcher';
import type { Credential } from '../../utils/types';

console.log('ZeroVault: Content script loaded');

let detectedForms: LoginForm[] = [];
let currentURL = window.location.href;

// Track potential credentials to fallback if form submission event misses data
let lastPotentialCredentials: { form: HTMLFormElement, data: any } | null = null;

// Initialize on page load
function init() {
  console.log('ZeroVault: Initializing content script');

  // Detect forms on page load
  setTimeout(() => {
    detectedForms = detectLoginForms();
    console.log(`ZeroVault: Found ${detectedForms.length} login forms`);

    if (detectedForms.length > 0) {
      handleFormsDetected(detectedForms);
    }
  }, 1000);

  // Observe for dynamically added forms
  observeForForms((forms) => {
    console.log(`ZeroVault: Detected ${forms.length} new forms`);
    detectedForms = [...detectedForms, ...forms];
    handleFormsDetected(forms);
  });

  // Listen for form submissions
  document.addEventListener('submit', handleFormSubmit, true);

  // Also listen for interactions that might trigger SPA navigation/submission
  document.addEventListener('input', handleInputMonitoring, true);
}

function handleInputMonitoring(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.tagName !== 'INPUT') return;

  const form = target.form;
  if (!form) return;

  const loginForm = detectedForms.find(lf => lf.form === form);
  if (loginForm) {
    // Debounce or just capture latest valid state
    const credentials = extractFormCredentials(loginForm);
    if (credentials && credentials.password) {
      lastPotentialCredentials = { form, data: credentials };
    }
  }
}

// Handle detected forms - request credentials and inject autofill UI
async function handleFormsDetected(forms: LoginForm[]) {
  try {
    // Request saved credentials for this URL
    const response = await sendToBackground<{ credentials: Credential[] }>(
      MessageType.REQUEST_CREDENTIALS,
      { url: currentURL }
    );

    if (response?.credentials && response.credentials.length > 0) {
      console.log(`ZeroVault: Found ${response.credentials.length} saved credentials`);

      // Inject autofill UI for each form
      forms.forEach((form) => {
        injectAutofillBubble(form, response.credentials);
      });
    } else {
      // No credentials found, still inject bubble to allow manual addition
      forms.forEach((form) => {
        injectAutofillBubble(form, []);
      });
    }
  } catch (error: any) {
    console.error('ZeroVault: Error requesting credentials:', error);
    if (error.message === 'Extension context invalidated') {
      console.log('ZeroVault: Extension context invalidated, stopping form detection');
      return; // Stop further attempts if context is invalid
    }
  }
}

// Show simple verification prompt for autofill
function showSimpleVerificationPrompt(): Promise<string | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector('.zerovault-verification-prompt');
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement('div');
    overlay.className = 'zerovault-modal-overlay';
    overlay.innerHTML = `
      <div class="zerovault-modal">
        <div class="zerovault-modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <h2>Verify Identity</h2>
        </div>
        <div class="zerovault-modal-content">
          <p>Enter your birth year, favorite color, or pet name to verify your identity</p>
          <input type="text" class="zerovault-verification-input" placeholder="e.g., 1990, blue, max" maxlength="20" autofocus />
        </div>
        <div class="zerovault-modal-actions">
          <button class="zerovault-btn zerovault-btn-primary" data-action="verify">Verify</button>
          <button class="zerovault-btn zerovault-btn-ghost" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;
    const style = document.createElement('style');
    style.textContent = `
      .zerovault-verification-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 16px;
        box-sizing: border-box;
      }
      .zerovault-verification-input:focus {
        outline: none;
        border-color: #3b82f6;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.zerovault-verification-input') as HTMLInputElement;
    overlay.querySelectorAll('.zerovault-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'verify') {
          const token = input.value;
          overlay.remove();
          resolve(token);
        } else {
          overlay.remove();
          resolve(null);
        }
      });
    });
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const token = input.value;
        overlay.remove();
        resolve(token);
      }
    });
  });
}

// Show master password prompt for autofill
function showMasterPasswordPrompt(): Promise<string | null> {
  return new Promise((resolve) => {
    // Remove existing prompt
    const existing = document.querySelector('.zerovault-master-pwd-prompt');
    if (existing) {
      existing.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'zerovault-modal-overlay';
    overlay.innerHTML = `
      <div class="zerovault-modal">
        <div class="zerovault-modal-header">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <h2>Enter Master Password</h2>
        </div>
        <div class="zerovault-modal-content">
          <p>Enter your master password to authorize autofill</p>
          <input type="password" class="zerovault-master-pwd-input" placeholder="Enter your master password" autofocus />
        </div>
        <div class="zerovault-modal-actions">
          <button class="zerovault-btn zerovault-btn-primary" data-action="unlock">Unlock</button>
          <button class="zerovault-btn zerovault-btn-ghost" data-action="cancel">Cancel</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .zerovault-master-pwd-input {
        flex-shrink: 0;
      }
      .zerovault-modal-content {
        padding: 24px;
      }
      .zerovault-modal-content p {
        margin: 0 0 16px 0;
        color: #374151;
        font-size: 14px;
      }
      .zerovault-password-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      .zerovault-password-input:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }
      .zerovault-modal-actions {
        display: flex;
        gap: 8px;
        padding: 16px 24px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
      }
      .zerovault-modal-actions .zerovault-btn {
        flex: 1;
        padding: 10px 16px;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Handle button clicks
    const passwordInput = overlay.querySelector('.zerovault-master-pwd-input') as HTMLInputElement;
    
    if (!passwordInput) {
      console.error('ZeroVault: Password input not found in modal');
      overlay.remove();
      resolve(null);
      return;
    }
    
    overlay.querySelectorAll('.zerovault-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'unlock') {
          const password = passwordInput?.value || '';
          console.log('ZeroVault: Unlock button clicked, password length:', password.length);
          overlay.remove();
          resolve(password);
        } else {
          overlay.remove();
          resolve(null);
        }
      });
    });

    // Handle Enter key
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const password = passwordInput.value;
        overlay.remove();
        resolve(password);
      }
    });

    // Handle Escape key
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        resolve(null);
      }
    });
  });
}

// Inject autofill bubble near password field
function injectAutofillBubble(loginForm: LoginForm, credentials: Credential[]) {
  const { passwordField } = loginForm;

  // Check if bubble already exists
  if (passwordField.parentElement?.querySelector('.zerovault-bubble')) {
    return;
  }

  // Create bubble container with inline styles
  const bubble = document.createElement('div');
  bubble.className = 'zerovault-bubble';
  bubble.style.cssText = `
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #0366d6 !important;
    border: 2px solid #ffffff !important;
    border-radius: 6px !important;
    width: 36px !important;
    height: 36px !important;
    min-width: 36px !important;
    min-height: 36px !important;
    max-width: 36px !important;
    max-height: 36px !important;
    cursor: pointer !important;
    color: white !important;
    transition: all 0.2s !important;
    box-shadow: 0 2px 8px rgba(3, 102, 214, 0.5) !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    margin-left: 8px !important;
    vertical-align: middle !important;
  `;
  bubble.innerHTML = `
    <button class="zerovault-bubble-btn" style="
      background: transparent !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 0 !important;
      margin: 0 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      transition: all 0.2s !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      line-height: 1 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
    " title="Autofill with ZeroVault">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="
        width: 18px !important;
        height: 18px !important;
        flex-shrink: 0 !important;
        opacity: 1 !important;
        visibility: visible !important;
      ">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </button>
  `;

  // Add styles with !important to override website CSS
  const style = document.createElement('style');
  style.textContent = `
    .zerovault-bubble {
      position: absolute !important;
      right: 2px !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      z-index: 2147483647 !important;
      background: #0366d6 !important;
      border: 2px solid #ffffff !important;
      border-radius: 6px !important;
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      min-height: 36px !important;
      max-width: 36px !important;
      max-height: 36px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      transition: all 0.2s !important;
      box-shadow: 0 2px 8px rgba(3, 102, 214, 0.5) !important;
      flex-shrink: 0 !important;
      box-sizing: border-box !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
    }
    .zerovault-bubble:hover {
      background: #0256cc !important;
      transform: translateY(-50%) scale(1.1) !important;
      box-shadow: 0 4px 12px rgba(3, 102, 214, 0.6) !important;
    }
    .zerovault-bubble-btn {
      background: transparent !important;
      border: none !important;
      border-radius: 6px !important;
      padding: 0 !important;
      margin: 0 !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
      transition: all 0.2s !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      line-height: 1 !important;
      width: 100% !important;
      height: 100% !important;
      box-sizing: border-box !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
    }
    .zerovault-bubble-btn:hover {
      background: transparent !important;
    }
    .zerovault-bubble-btn svg {
      width: 18px !important;
      height: 18px !important;
      flex-shrink: 0 !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    .zerovault-dropdown {
      position: absolute !important;
      top: 100% !important;
      right: 0 !important;
      margin-top: 4px !important;
      background: white !important;
      border: 1px solid #e5e7eb !important;
      border-radius: 8px !important;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1) !important;
      min-width: 250px !important;
      max-height: 300px !important;
      overflow-y: auto !important;
      z-index: 999999 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
    }
    .zerovault-credential-item {
      padding: 12px !important;
      cursor: pointer !important;
      border-bottom: 1px solid #f3f4f6 !important;
      transition: background 0.2s !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.4 !important;
    }
    .zerovault-credential-item:hover {
      background: #f9fafb !important;
    }
    .zerovault-credential-username {
      font-weight: 600 !important;
      color: #111827 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 14px !important;
    }
    .zerovault-credential-url {
      font-size: 12px !important;
      color: #6b7280 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-modal-overlay {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0,0,0,0.5) !important;
      z-index: 999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-modal {
      background: white !important;
      border-radius: 12px !important;
      padding: 24px !important;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1) !important;
      max-width: 400px !important;
      width: 90% !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-modal-header {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      margin-bottom: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-modal-header h2 {
      margin: 0 !important;
      font-size: 18px !important;
      font-weight: 600 !important;
      color: #111827 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-modal-content {
      padding: 0 0 16px 0 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-modal-content p {
      margin: 0 0 16px 0 !important;
      color: #374151 !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-master-pwd-input {
      width: 100% !important;
      padding: 10px 12px !important;
      border: 1px solid #d1d5db !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      box-sizing: border-box !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-master-pwd-input:focus {
      outline: none !important;
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 3px rgba(59,130,246,0.1) !important;
    }
    .zerovault-modal-actions {
      display: flex !important;
      gap: 8px !important;
      justify-content: flex-end !important;
      margin-top: 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-btn {
      padding: 8px 16px !important;
      border-radius: 6px !important;
      font-size: 14px !important;
      font-weight: 500 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
      border: none !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    .zerovault-btn-primary {
      background: #3b82f6 !important;
      color: white !important;
    }
    .zerovault-btn-primary:hover {
      background: #2563eb !important;
    }
    .zerovault-btn-ghost {
      background: transparent !important;
      color: #6b7280 !important;
      border: 1px solid #d1d5db !important;
    }
    .zerovault-btn-ghost:hover {
      background: #f3f4f6 !important;
    }
  `;
  document.head.appendChild(style);

  // Position bubble directly after password field (inline approach)
  console.log('ZeroVault: Bubble positioning - Inserting directly after password field');
  console.log('ZeroVault: Bubble positioning - Password field parent:', passwordField.parentElement?.className);
  console.log('ZeroVault: Bubble positioning - Password field classes:', passwordField.className);

  // Insert bubble right after the password field
  passwordField.insertAdjacentElement('afterend', bubble);

  // Fallback: if bubble still doesn't appear, try parent append
  setTimeout(() => {
    if (!document.querySelector('.zerovault-bubble')) {
      console.log('ZeroVault: Bubble not found, trying parent append');
      passwordField.parentElement?.appendChild(bubble);
    }
  }, 100);

  // Debug: Confirm bubble was added and force visibility
  setTimeout(() => {
    const addedBubble = document.querySelector('.zerovault-bubble');
    console.log('ZeroVault: Bubble added to DOM:', !!addedBubble);
    if (addedBubble) {
      // Force visibility with inline styles as fallback
      addedBubble.style.cssText = `
        position: absolute !important;
        right: 2px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 2147483647 !important;
        background: #0366d6 !important;
        border: 2px solid #ffffff !important;
        border-radius: 6px !important;
        width: 36px !important;
        height: 36px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        opacity: 1 !important;
        visibility: visible !important;
        pointer-events: auto !important;
      `;
      
      const rect = addedBubble.getBoundingClientRect();
      console.log('ZeroVault: Bubble position:', {
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom
      });
    }
  }, 50);

  // Handle bubble click
  const bubbleBtn = bubble.querySelector('.zerovault-bubble-btn') as HTMLButtonElement;
  bubbleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showCredentialDropdown(bubble, loginForm, credentials);
  });
}

// Show credential dropdown
function showCredentialDropdown(
  bubble: HTMLElement,
  loginForm: LoginForm,
  credentials: Credential[]
) {
  // Remove existing dropdown
  const existing = bubble.querySelector('.zerovault-dropdown');
  if (existing) {
    existing.remove();
    return;
  }

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'zerovault-dropdown';

  if (credentials.length === 0) {
    // No credentials available - show option to add new one
    const item = document.createElement('div');
    item.className = 'zerovault-credential-item';
    item.innerHTML = `
      <div class="zerovault-credential-username">No saved credentials</div>
      <div class="zerovault-credential-url">Click to add new credentials</div>
    `;

    item.addEventListener('click', async () => {
      // Use master password verification for autofill
      const masterPassword = await showMasterPasswordPrompt();
      
      if (masterPassword) {
        // Send master password to background for verification
        const verifyResult = await sendToBackground<{ success: boolean }>(MessageType.VERIFY_MASTER_PASSWORD, { masterPassword });
        
        if (verifyResult?.success) {
          // Autofill the credentials
          fillForm(loginForm, { username: cred.username, password: cred.password });
          console.log('ZeroVault: Autofilled credentials after master password verification');
          dropdown.remove();
        } else {
          alert('Incorrect master password. Please try again.');
        }
      } else {
        console.log('ZeroVault: Autofill cancelled');
      }
    });

    dropdown.appendChild(item);
  } else {
    credentials.forEach((cred) => {
      const item = document.createElement('div');
      item.className = 'zerovault-credential-item';
      item.innerHTML = `
        <div class="zerovault-credential-username">${cred.username}</div>
        <div class="zerovault-credential-url">${cred.name || extractDomain(cred.url)}</div>
      `;

      item.addEventListener('click', async () => {
        // ALWAYS show master password prompt as per requirement
        const masterPassword = await showMasterPasswordPrompt();

        if (masterPassword) {
          console.log('ZeroVault: Master password provided, sending unlock request');
          console.log('ZeroVault: Password being sent (first 3 chars):', masterPassword.substring(0, 3) + '...');
          try {
            // Send unlock request to background (this also verifies it)
            const unlockResult = await sendToBackground<{ success: boolean }>(MessageType.UNLOCK_VAULT, { masterPassword });
            console.log('ZeroVault: Unlock result:', unlockResult);

            if (unlockResult?.success) {
              fillForm(loginForm, { username: cred.username, password: cred.password });
              dropdown.remove();
              console.log('ZeroVault: Autofilled credentials after unlock');
            } else {
              console.log('ZeroVault: Unlock failed, showing error');
              alert('Incorrect master password. Please try again.');
            }
          } catch (error: any) {
            console.error('ZeroVault: Unlock request failed:', error);
            if (error.message === 'Extension context invalidated') {
              alert('Extension was reloaded. Please refresh the page and try again.');
            } else {
              alert('Failed to unlock vault. Please try again.');
            }
          }
        } else {
          console.log('ZeroVault: Unlock cancelled');
        }
      });

      dropdown.appendChild(item);
    });
  }

  bubble.appendChild(dropdown);

  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', function closeDropdown(e) {
      if (!bubble.contains(e.target as Node)) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    });
  }, 0);
}

// Handle form submission - automatically save credentials without prompt
async function handleFormSubmit(e: Event) {
  const form = e.target as HTMLFormElement;

  // Find if this is a detected login form
  const loginForm = detectedForms.find((lf) => lf.form === form);

  if (loginForm && isLoginForm(form)) {
    let credentials = extractFormCredentials(loginForm);

    // Fallback to last captured state if current extraction fails (e.g. fields cleared by SPA)
    if (!credentials && lastPotentialCredentials && lastPotentialCredentials.form === form) {
      credentials = lastPotentialCredentials.data;
      console.log('ZeroVault: Used fallback credentials');
    }

    if (credentials) {
      console.log('ZeroVault: Form submitted with credentials:', credentials);

      // Automatically save credentials without prompting user
      try {
        await sendToBackground(MessageType.SAVE_CREDENTIAL, credentials);
        console.log('ZeroVault: Credentials auto-saved');
        
        // Show success notification
        const successMsg = document.createElement('div');
        successMsg.textContent = 'ZeroVault: Credentials saved automatically!';
        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px; border-radius: 8px; z-index: 999999;';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } catch (error) {
        console.error('ZeroVault: Error auto-saving credentials:', error);
      }
    }
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('ZeroVault: Content script received message:', message.type);

  if (message.type === MessageType.SHOW_SAVE_PROMPT) {
    showSavePrompt(message.data);
    sendResponse({ success: true });
  } else if (message.type === MessageType.SHOW_UPDATE_PROMPT) {
    showUpdatePrompt(message.data);
    sendResponse({ success: true });
  }

  return true;
});

// Show save password prompt
function showSavePrompt(data: { url: string; username: string; password: string }) {
  // Remove existing prompt
  const existing = document.querySelector('.zerovault-save-prompt');
  if (existing) {
    existing.remove();
  }

  // Create prompt
  const prompt = document.createElement('div');
  prompt.className = 'zerovault-save-prompt';
  prompt.innerHTML = `
    <div class="zerovault-prompt-content">
      <div class="zerovault-prompt-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Save password for ${extractDomain(data.url)}?</span>
      </div>
      <div class="zerovault-prompt-info">
        <div><strong>Username:</strong> ${data.username}</div>
        <div><strong>Password:</strong> ${'•'.repeat(8)}</div>
      </div>
      <div class="zerovault-prompt-actions">
        <button class="zerovault-btn zerovault-btn-primary" data-action="save">Save</button>
        <button class="zerovault-btn zerovault-btn-secondary" data-action="never">Never</button>
        <button class="zerovault-btn zerovault-btn-ghost" data-action="dismiss">Not now</button>
      </div>
    </div>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .zerovault-save-prompt {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .zerovault-prompt-content {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
      padding: 16px;
      min-width: 320px;
      max-width: 400px;
    }
    .zerovault-prompt-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #111827;
      margin-bottom: 12px;
    }
    .zerovault-prompt-header svg {
      color: #3b82f6;
    }
    .zerovault-prompt-info {
      background: #f9fafb;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 13px;
      color: #374151;
    }
    .zerovault-prompt-info div {
      margin-bottom: 4px;
    }
    .zerovault-prompt-info div:last-child {
      margin-bottom: 0;
    }
    .zerovault-prompt-actions {
      display: flex;
      gap: 8px;
    }
    .zerovault-btn {
      flex: 1;
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .zerovault-btn-primary {
      background: #3b82f6;
      color: white;
    }
    .zerovault-btn-primary:hover {
      background: #2563eb;
    }
    .zerovault-btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }
    .zerovault-btn-secondary:hover {
      background: #e5e7eb;
    }
    .zerovault-btn-ghost {
      background: transparent;
      color: #6b7280;
    }
    .zerovault-btn-ghost:hover {
      background: #f9fafb;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(prompt);

  // Handle button clicks
  prompt.querySelectorAll('.zerovault-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = (btn as HTMLElement).dataset.action;

      if (action === 'save') {
        console.log('ZeroVault: User clicked save, data:', data);
        
        // Check if vault is locked
        const vaultStatus = await sendToBackground<{ isLocked: boolean }>(MessageType.GET_VAULT_STATUS, {});
        console.log('ZeroVault: Vault status:', vaultStatus);

        if (vaultStatus?.isLocked) {
          console.log('ZeroVault: Vault is locked, prompting for master password');
          const masterPassword = await showMasterPasswordPrompt();
          if (masterPassword) {
            console.log('ZeroVault: Master password provided, unlocking vault');
            const unlockResult = await sendToBackground<{ success: boolean }>(MessageType.UNLOCK_VAULT, { masterPassword });
            if (unlockResult?.success) {
              console.log('ZeroVault: Vault unlocked, saving credential');
              const saveResult = await sendToBackground(MessageType.SAVE_CREDENTIAL, data);
              console.log('ZeroVault: Save result:', saveResult);
              if (saveResult?.success) {
                console.log('ZeroVault: Credential saved successfully after unlock');
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.textContent = 'Credential saved successfully!';
                successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px; border-radius: 8px; z-index: 999999;';
                document.body.appendChild(successMsg);
                setTimeout(() => successMsg.remove(), 3000);
              } else {
                console.error('ZeroVault: Failed to save credential after unlock');
                alert('Failed to save credential. Please try again.');
              }
            } else {
              console.error('ZeroVault: Incorrect master password');
              alert('Incorrect master password. Could not save credential.');
            }
          } else {
            console.log('ZeroVault: Master password prompt cancelled');
          }
        } else {
          console.log('ZeroVault: Vault is already unlocked, saving credential directly');
          const saveResult = await sendToBackground(MessageType.SAVE_CREDENTIAL, data);
          console.log('ZeroVault: Save result:', saveResult);
          if (saveResult?.success) {
            console.log('ZeroVault: Credential saved successfully');
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.textContent = 'Credential saved successfully!';
            successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 12px; border-radius: 8px; z-index: 999999;';
            document.body.appendChild(successMsg);
            setTimeout(() => successMsg.remove(), 3000);
          } else {
            console.error('ZeroVault: Failed to save credential');
            alert('Failed to save credential. Please try again.');
          }
        }
      } else if (action === 'never') {
        const domain = new URL(data.url).hostname.replace('www.', '');
        await sendToBackground(MessageType.BLACKLIST_DOMAIN, { domain });
        console.log('ZeroVault: Added to blacklist:', domain);
      }

      prompt.remove();
    });
  });

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (document.body.contains(prompt)) {
      prompt.remove();
    }
  }, 15000);
}

// Show update password prompt
function showUpdatePrompt(data: { url: string; username: string; password: string; credentialId: string }) {
  // Remove existing prompt
  const existing = document.querySelector('.zerovault-update-prompt');
  if (existing) {
    existing.remove();
  }

  // Create prompt
  const prompt = document.createElement('div');
  prompt.className = 'zerovault-update-prompt';
  prompt.innerHTML = `
    <div class="zerovault-prompt-content">
      <div class="zerovault-prompt-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span>Update password for ${extractDomain(data.url)}?</span>
      </div>
      <div class="zerovault-prompt-info">
        <div><strong>Username:</strong> ${data.username}</div>
        <div><strong>New Password:</strong> ${'•'.repeat(8)}</div>
      </div>
      <div class="zerovault-prompt-actions">
        <button class="zerovault-btn zerovault-btn-primary" data-action="update">Update</button>
        <button class="zerovault-btn zerovault-btn-ghost" data-action="dismiss">Skip</button>
      </div>
    </div>
  `;

  // Reuse styles from save prompt
  document.body.appendChild(prompt);

  // Handle button clicks
  prompt.querySelectorAll('.zerovault-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = (btn as HTMLElement).dataset.action;

      if (action === 'update') {
        // Check if vault is locked
        const vaultStatus = await sendToBackground<{ isLocked: boolean }>(MessageType.GET_VAULT_STATUS, {});

        if (vaultStatus?.isLocked) {
          const masterPassword = await showMasterPasswordPrompt();
          if (masterPassword) {
            const unlockResult = await sendToBackground<{ success: boolean }>(MessageType.UNLOCK_VAULT, { masterPassword });
            if (unlockResult?.success) {
              await sendToBackground(MessageType.UPDATE_CREDENTIAL, data);
              console.log('ZeroVault: Updated credential after unlock');
            } else {
              alert('Incorrect master password. Could not update credential.');
            }
          }
        } else {
          await sendToBackground(MessageType.UPDATE_CREDENTIAL, data);
          console.log('ZeroVault: Updated credential');
        }
      }

      prompt.remove();
    });
  });

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (document.body.contains(prompt)) {
      prompt.remove();
    }
  }, 15000);
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
