import { MessageType, type Message } from '../../utils/messaging';
import { matchURL } from '../../utils/urlMatcher';
import { encryptVaultData, decryptVaultData, deriveMasterKey } from '../../utils/crypto';
import { authService } from '../../services/supabase';

console.log('ZeroVault: Background script initialized');

interface StoredCredential {
    id: string;
    name: string;
    url: string;
    username: string;
    password: string;
    notes?: string;
    createdAt: string;
}

let sessionKey: string | null = null;

// Store last submitted credentials so we can re-show the save
// prompt even after a redirect (e.g. Gmail redirects after login).
let pendingSavePrompt: { url: string; username: string; password: string; createdAt: number } | null = null;

// Track short-lived OTP approval for autofill to avoid asking the user
// to enter OTP multiple times in a row.
let autofillOtpApprovedUntil: number | null = null;

// Initialize session key from storage.session (if available)
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
    chrome.storage.session.get('sessionKey').then((result) => {
        if (result.sessionKey) {
            sessionKey = result.sessionKey as string;
            console.log('ZeroVault: Restored session key from session storage');
        }
    });
}

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('ZeroVault: Extension installed');
    chrome.storage.local.set({
        zerovault_initialized: true,
        install_date: new Date().toISOString(),
    });
});

// Handle messages
chrome.runtime.onMessage.addListener((
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
) => {
    console.log('ZeroVault: Background received message:', message.type);

    switch (message.type) {
        case MessageType.SET_SESSION_KEY:
            if (message.data?.key) {
                sessionKey = message.data.key;
                if (chrome.storage.session) {
                    chrome.storage.session.set({ sessionKey });
                }
                console.log('ZeroVault: Session key set');
                sendResponse({ success: true });
            }
            break;

        case MessageType.REQUEST_CREDENTIALS:
            handleRequestCredentials(message.data, sendResponse);
            return true; // Async

        case MessageType.REQUEST_CREDENTIALS_AFTER_UNLOCK:
            handleRequestCredentialsAfterUnlock(message.data, sendResponse);
            return true; // Async

        case MessageType.GET_VAULT_STATUS:
            sendResponse({ isLocked: !sessionKey });
            return true;

        case MessageType.UNLOCK_VAULT:
            handleUnlockVault(message.data, sendResponse);
            return true; // Async

        case MessageType.FORM_SUBMITTED:
            handleFormSubmitted(message.data, sender.tab);
            sendResponse({ success: true });
            break;

        case MessageType.GET_PENDING_SAVE_PROMPT:
            handleGetPendingSavePrompt(message.data, sendResponse);
            return true; // Async

        case MessageType.SAVE_CREDENTIAL:
            handleSaveCredential(message.data);
            sendResponse({ success: true });
            break;

        case MessageType.UPDATE_CREDENTIAL:
            handleUpdateCredential(message.data);
            sendResponse({ success: true });
            break;

        case MessageType.BLACKLIST_DOMAIN:
            handleBlacklistDomain(message.data);
            sendResponse({ success: true });
            break;

        case MessageType.REQUEST_AUTOFILL_OTP:
            handleRequestAutofillOtp(sendResponse);
            return true; // Async

        case MessageType.VERIFY_AUTOFILL_OTP:
            handleVerifyAutofillOtp(message.data, sendResponse);
            return true; // Async

        default:
            console.log('ZeroVault: Unknown message type:', message.type);
    }

    return false;
});

async function getDecryptedCredentials(): Promise<StoredCredential[]> {
    if (!sessionKey) {
        console.log('ZeroVault: Locked (no session key)');
        return [];
    }

    try {
        const result = await chrome.storage.local.get('vault_credentials');
        const encrypted = result.vault_credentials;

        if (!encrypted) return [];

        // Check if data is already array (legacy/migration) or string (encrypted)
        if (Array.isArray(encrypted)) {
            // Potentially handle legacy plain text migration here if needed
            // For now we assume encrypted
            console.warn('ZeroVault: Found unencrypted array in storage, ignored for security');
            return [];
        }

        const decrypted = await decryptVaultData(encrypted as string, sessionKey);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('ZeroVault: Decryption failed:', error);
        return [];
    }
}

async function saveEncryptedCredentials(credentials: StoredCredential[]) {
    if (!sessionKey) {
        console.error('ZeroVault: Cannot save, no session key');
        return;
    }

    try {
        const json = JSON.stringify(credentials);
        const encrypted = await encryptVaultData(json, sessionKey);
        await chrome.storage.local.set({ vault_credentials: encrypted });
    } catch (error) {
        console.error('ZeroVault: Encryption failed:', error);
    }
}

async function handleRequestCredentials(
    data: { url: string },
    sendResponse: (response: any) => void
) {
    const credentials = await getDecryptedCredentials();
    const matching = credentials.filter((c) => matchURL(c.url, data.url));
    
    // If vault is locked (no sessionKey), return only metadata without passwords
    if (!sessionKey) {
        console.log(`ZeroVault: Vault locked, returning credential metadata only`);
        const safeCredentials = matching.map(c => ({
            id: c.id,
            name: c.name,
            url: c.url,
            username: c.username,
            // Don't include password when vault is locked
            password: ''
        }));
        sendResponse({ credentials: safeCredentials, isLocked: true });
    } else {
        console.log(`ZeroVault: Found ${matching.length} matching credentials`);
        sendResponse({ credentials: matching, isLocked: false });
    }
}

// Handler for requesting credentials after vault is unlocked (returns full credentials with passwords)
async function handleRequestCredentialsAfterUnlock(
    data: { url: string },
    sendResponse: (response: any) => void
) {
    // This handler is called after unlock, so sessionKey should be available
    const credentials = await getDecryptedCredentials();
    const matching = credentials.filter((c) => matchURL(c.url, data.url));
    
    console.log(`ZeroVault: Returning ${matching.length} credentials after unlock`);
    sendResponse({ credentials: matching, isLocked: false });
}

async function handleFormSubmitted(
    data: { url: string; username: string; password: string },
    tab?: chrome.tabs.Tab
) {
    if (!tab?.id) return;

    // Remember this submission so we can show the save prompt again
    // after a redirect on the same site (e.g. Gmail).
    pendingSavePrompt = {
        ...data,
        createdAt: Date.now(),
    };

    // Always give user a chance to save/update on form submit,
    // regardless of blacklist state, so that credentials are never silently ignored.
    if (sessionKey) {
        const credentials = await getDecryptedCredentials();
        const existing = credentials.find((c) =>
            matchURL(c.url, data.url) && c.username === data.username
        );

        if (existing) {
            if (existing.password !== data.password) {
                console.log('ZeroVault: Password changed');
                chrome.tabs.sendMessage(tab.id, {
                    type: MessageType.SHOW_UPDATE_PROMPT,
                    data: {
                        ...data,
                        oldPassword: existing.password,
                        credentialId: existing.id,
                    },
                });
            }
        } else {
            chrome.tabs.sendMessage(tab.id, {
                type: MessageType.SHOW_SAVE_PROMPT,
                data,
            });
        }
    } else {
        // Vault locked: still show save prompt and handle unlock when user chooses Save.
        chrome.tabs.sendMessage(tab.id, {
            type: MessageType.SHOW_SAVE_PROMPT,
            data,
        });
    }
}

// Allow content scripts on subsequent pages (after redirect) to ask
// if there is a recent submitted credential that still needs a save
// prompt to be shown.
async function handleGetPendingSavePrompt(
    data: { url: string },
    sendResponse: (response: any) => void
) {
    try {
        if (
            !pendingSavePrompt ||
            Date.now() - pendingSavePrompt.createdAt > 30000 // older than 30s
        ) {
            pendingSavePrompt = null;
            sendResponse({ pending: null });
            return;
        }

        // Only return if it's for the same site (domain match)
        if (!matchURL(pendingSavePrompt.url, data.url)) {
            sendResponse({ pending: null });
            return;
        }

        const pending = pendingSavePrompt;
        // Clear so we don't repeatedly show on every page
        pendingSavePrompt = null;
        sendResponse({ pending });
    } catch (e) {
        console.error('ZeroVault: Failed to get pending save prompt', e);
        sendResponse({ pending: null });
    }
}

async function handleSaveCredential(data: { url: string; username: string; password: string }) {
    if (!sessionKey) return;

    const credentials = await getDecryptedCredentials();

    const newCredential: StoredCredential = {
        id: crypto.randomUUID(),
        name: new URL(data.url).hostname.replace('www.', ''),
        url: data.url,
        username: data.username,
        password: data.password,
        notes: '',
        createdAt: new Date().toISOString(),
    };

    credentials.push(newCredential);
    await saveEncryptedCredentials(credentials);
    console.log('ZeroVault: Credential saved', {
        id: newCredential.id,
        url: newCredential.url,
        username: newCredential.username,
    });
}

async function handleUpdateCredential(data: { url: string; username: string; password: string; credentialId: string }) {
    if (!sessionKey) return;

    const credentials = await getDecryptedCredentials();
    const credentialIndex = credentials.findIndex(c => c.id === data.credentialId);

    if (credentialIndex !== -1) {
        // Update the password
        credentials[credentialIndex].password = data.password;
        credentials[credentialIndex].createdAt = new Date().toISOString();

        await saveEncryptedCredentials(credentials);
        console.log('ZeroVault: Credential password updated');
    } else {
        console.warn('ZeroVault: Credential not found for update:', data.credentialId);
    }
}

async function handleUnlockVault(data: { masterPassword: string }, sendResponse: (response?: any) => void) {
    try {
        // Get stored salt and password hash
        const stored = await chrome.storage.local.get([
            'zerovault_master_salt',
            'zerovault_master_password_hash'
        ]);

        if (!stored.zerovault_master_salt || !stored.zerovault_master_password_hash) {
            sendResponse({ success: false, error: 'Vault not initialized' });
            return;
        }

        // Derive the key using provided master password and stored salt
        const derivedKey = await deriveMasterKey(data.masterPassword, stored.zerovault_master_salt as string);

        // Verify if it matches the stored hash (which is also a derived key)
        if (derivedKey === stored.zerovault_master_password_hash as string) {
            sessionKey = derivedKey;
            if (chrome.storage.session) {
                await chrome.storage.session.set({ sessionKey });
            }
            console.log('ZeroVault: Vault unlocked successfully');
            sendResponse({ success: true });
        } else {
            console.log('ZeroVault: Invalid master password');
            sendResponse({ success: false, error: 'Invalid master password' });
        }
    } catch (error: any) {
        console.error('ZeroVault: Unlock error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

async function handleBlacklistDomain(data: { domain: string }) {
    if (!data?.domain) return;
    await addToBlacklist(data.domain);
}

async function handleRequestAutofillOtp(sendResponse: (response?: any) => void) {
    try {
        // If we already have a recent approval, no need to send again
        if (autofillOtpApprovedUntil && Date.now() < autofillOtpApprovedUntil) {
            sendResponse({ success: true, alreadyApproved: true });
            return;
        }

        const session = await authService.getSession();
        const email = session.success ? session.session?.user?.email : undefined;

        if (!email) {
            sendResponse({ success: false, error: 'No authenticated user email' });
            return;
        }

        const result = await authService.sendOtpToEmail(email);
        if (!result.success) {
            sendResponse({ success: false, error: 'Failed to send OTP' });
            return;
        }

        sendResponse({ success: true });
    } catch (e: any) {
        console.error('ZeroVault: Request autofill OTP failed', e);
        sendResponse({ success: false, error: e?.message || 'Unknown error' });
    }
}

async function handleVerifyAutofillOtp(
    data: { token: string },
    sendResponse: (response?: any) => void
) {
    try {
        const session = await authService.getSession();
        const email = session.success ? session.session?.user?.email : undefined;

        if (!email) {
            sendResponse({ success: false, error: 'No authenticated user email' });
            return;
        }

        const result = await authService.verifyEmailOtp(email, data.token);
        if (!result.success) {
            sendResponse({ success: false, error: 'Invalid OTP' });
            return;
        }

        // Grant 10 minutes of OTP-approved autofill
        autofillOtpApprovedUntil = Date.now() + 10 * 60 * 1000;
        sendResponse({ success: true });
    } catch (e: any) {
        console.error('ZeroVault: Verify autofill OTP failed', e);
        sendResponse({ success: false, error: e?.message || 'Unknown error' });
    }
}

// Auto-lock timer
let autoLockTimer: any = null;
const DEFAULT_AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes

async function getAutoLockTimeout(): Promise<number> {
    try {
        const result = await chrome.storage.local.get('autoLockTimeout');
        const timeout = result.autoLockTimeout as number | undefined;
        if (timeout === -1) return -1; // Never lock
        return ((timeout as number) || 15) * 60 * 1000; // Convert minutes to ms
    } catch (e) {
        return DEFAULT_AUTO_LOCK_TIMEOUT;
    }
}

function resetAutoLockTimer() {
    if (autoLockTimer) clearTimeout(autoLockTimer);
    
    getAutoLockTimeout().then(timeout => {
        if (timeout === -1) return; // Never lock
        
        autoLockTimer = setTimeout(() => {
            console.log('ZeroVault: Auto-locking');
            sessionKey = null;
            if (chrome.storage.session) {
                chrome.storage.session.remove('sessionKey');
            }
        }, timeout);
    });
}

// Blacklist functions
const BLACKLIST_KEY = 'zerovault_blacklist';

async function checkBlacklist(url: string): Promise<boolean> {
    try {
        const result = await chrome.storage.local.get(BLACKLIST_KEY);
        const blacklist: string[] = (result[BLACKLIST_KEY] as string[]) || [];
        const domain = new URL(url).hostname.replace('www.', '');
        return blacklist.some(blacklisted => domain.includes(blacklisted));
    } catch (e) {
        return false;
    }
}

async function addToBlacklist(domain: string): Promise<void> {
    try {
        const result = await chrome.storage.local.get(BLACKLIST_KEY);
        const blacklist: string[] = (result[BLACKLIST_KEY] as string[]) || [];
        if (!blacklist.includes(domain)) {
            blacklist.push(domain);
            await chrome.storage.local.set({ [BLACKLIST_KEY]: blacklist });
            console.log('ZeroVault: Added to blacklist:', domain);
        }
    } catch (e) {
        console.error('ZeroVault: Failed to add to blacklist:', e);
    }
}

async function removeFromBlacklist(domain: string): Promise<void> {
    try {
        const result = await chrome.storage.local.get(BLACKLIST_KEY);
        const blacklist: string[] = (result[BLACKLIST_KEY] as string[]) || [];
        const updated = blacklist.filter(d => d !== domain);
        await chrome.storage.local.set({ [BLACKLIST_KEY]: updated });
        console.log('ZeroVault: Removed from blacklist:', domain);
    } catch (e) {
        console.error('ZeroVault: Failed to remove from blacklist:', e);
    }
}

async function getBlacklist(): Promise<string[]> {
    try {
        const result = await chrome.storage.local.get(BLACKLIST_KEY);
        return (result[BLACKLIST_KEY] as string[]) || [];
    } catch (e) {
        return [];
    }
}

chrome.runtime.onMessage.addListener(resetAutoLockTimer);
