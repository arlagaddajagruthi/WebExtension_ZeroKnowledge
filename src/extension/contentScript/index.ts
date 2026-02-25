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
    }
  } catch (error) {
    console.error('ZeroVault: Error requesting credentials:', error);
  }
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
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <h2>Unlock Vault</h2>
        </div>
        <div class="zerovault-modal-content">
          <p>Enter your master password to autofill credentials</p>
          <input type="password" class="zerovault-password-input" placeholder="Master Password" autofocus />
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
      .zerovault-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        backdrop-filter: blur(4px);
      }
      .zerovault-modal {
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        width: 90%;
        overflow: hidden;
      }
      .zerovault-modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
      }
      .zerovault-modal-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      .zerovault-modal-header svg {
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
    const passwordInput = overlay.querySelector('.zerovault-password-input') as HTMLInputElement;
    overlay.querySelectorAll('.zerovault-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = (btn as HTMLElement).dataset.action;
        if (action === 'unlock') {
          const password = passwordInput.value;
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

  // Create bubble container
  const bubble = document.createElement('div');
  bubble.className = 'zerovault-bubble';
  bubble.innerHTML = `
    <button class="zerovault-bubble-btn" title="Autofill with ZeroVault">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </button>
  `;

  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .zerovault-bubble {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 999999;
    }
    .zerovault-bubble-btn {
      background: #3b82f6;
      border: none;
      border-radius: 4px;
      padding: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      transition: background 0.2s;
    }
    .zerovault-bubble-btn:hover {
      background: #2563eb;
    }
    .zerovault-dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      min-width: 250px;
      max-height: 300px;
      overflow-y: auto;
      z-index: 999999;
    }
    .zerovault-credential-item {
      padding: 12px;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: background 0.2s;
    }
    .zerovault-credential-item:hover {
      background: #f9fafb;
    }
    .zerovault-credential-item:last-child {
      border-bottom: none;
    }
    .zerovault-credential-username {
      font-weight: 600;
      color: #111827;
      font-size: 14px;
    }
    .zerovault-credential-url {
      color: #6b7280;
      font-size: 12px;
      margin-top: 2px;
    }
  `;
  document.head.appendChild(style);

  // Position bubble relative to password field
  const parent = passwordField.parentElement;

  if (parent) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }
    parent.appendChild(bubble);
  }

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

  credentials.forEach((cred) => {
    const item = document.createElement('div');
    item.className = 'zerovault-credential-item';
    item.innerHTML = `
      <div class="zerovault-credential-username">${cred.username}</div>
      <div class="zerovault-credential-url">${cred.name || extractDomain(cred.url)}</div>
    `;

    item.addEventListener('click', async () => {
      // Check if vault is locked and prompt for master password
      const vaultStatus = await sendToBackground<{ isLocked: boolean }>(MessageType.GET_VAULT_STATUS, {});

      if (vaultStatus?.isLocked) {
        // Show master password prompt
        const masterPassword = await showMasterPasswordPrompt();
        if (masterPassword) {
          // Send unlock request to background
          await sendToBackground(MessageType.UNLOCK_VAULT, { masterPassword });
          fillForm(loginForm, { username: cred.username, password: cred.password });
          dropdown.remove();
          console.log('ZeroVault: Autofilled credentials after unlock');
        } else {
          console.log('ZeroVault: Master password required');
        }
      } else {
        fillForm(loginForm, { username: cred.username, password: cred.password });
        dropdown.remove();
        console.log('ZeroVault: Autofilled credentials');
      }
    });

    dropdown.appendChild(item);
  });

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

// Handle form submission
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
      console.log('ZeroVault: Form submitted with credentials');

      // Send to background script to check if we should save
      try {
        // Determine if this is a login or signup based on button text if we were ambiguous before
        // For now, we assume if we have credentials, we want to offer to save/update
        await sendToBackground(MessageType.FORM_SUBMITTED, credentials);
      } catch (error) {
        console.error('ZeroVault: Error sending form data:', error);
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
        await sendToBackground(MessageType.SAVE_CREDENTIAL, data);
        console.log('ZeroVault: Saved credential');
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
        await sendToBackground(MessageType.UPDATE_CREDENTIAL, data);
        console.log('ZeroVault: Updated credential');
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
