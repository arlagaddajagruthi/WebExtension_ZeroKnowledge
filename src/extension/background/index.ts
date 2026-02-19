import { MessageType, type Message } from '../../utils/messaging';
import { matchURL } from '../../utils/urlMatcher';
import { encryptVaultData, decryptVaultData } from '../../utils/crypto';

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

// Initialize session key from storage.session (if available)
chrome.storage.session.get('sessionKey').then((result) => {
    if (result.sessionKey) {
        sessionKey = result.sessionKey as string;
        console.log('ZeroVault: Restored session key from session storage');
    }
});

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
                chrome.storage.session.set({ sessionKey });
                console.log('ZeroVault: Session key set');
                sendResponse({ success: true });
            }
            break;

        case MessageType.REQUEST_CREDENTIALS:
            handleRequestCredentials(message.data, sendResponse);
            return true; // Async

        case MessageType.FORM_SUBMITTED:
            handleFormSubmitted(message.data, sender.tab);
            sendResponse({ success: true });
            break;

        case MessageType.SAVE_CREDENTIAL:
            handleSaveCredential(message.data);
            sendResponse({ success: true });
            break;

        case MessageType.BLACKLIST_DOMAIN:
            handleBlacklistDomain(message.data);
            sendResponse({ success: true });
            break;

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
    console.log(`ZeroVault: Found ${matching.length} matching credentials`);
    sendResponse({ credentials: matching });
}

async function handleFormSubmitted(
    data: { url: string; username: string; password: string },
    tab?: chrome.tabs.Tab
) {
    if (!tab?.id) return;
    if (!sessionKey) return; // Ignore if locked

    const credentials = await getDecryptedCredentials();
    const existing = credentials.find((c) =>
        matchURL(c.url, data.url) && c.username === data.username
    );

    if (existing) {
        if (existing.password !== data.password) {
            // Show update prompt when password changes
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
        // Check blacklist before showing save prompt
        const isBlacklisted = await checkBlacklist(data.url);
        if (!isBlacklisted) {
            chrome.tabs.sendMessage(tab.id, {
                type: MessageType.SHOW_SAVE_PROMPT,
                data,
            });
        } else {
            console.log('ZeroVault: Domain is blacklisted, skipping save prompt');
        }
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
    console.log('ZeroVault: Credential saved');
}

async function handleBlacklistDomain(data: { domain: string }) {
    if (!data?.domain) return;
    await addToBlacklist(data.domain);
}

// Auto-lock timer
let autoLockTimer: any = null;
const DEFAULT_AUTO_LOCK_TIMEOUT = 15 * 60 * 1000; // 15 minutes

async function getAutoLockTimeout(): Promise<number> {
    try {
        const result = await chrome.storage.local.get('autoLockTimeout');
        const timeout = result.autoLockTimeout;
        if (timeout === -1) return -1; // Never lock
        return (timeout || 15) * 60 * 1000; // Convert minutes to ms
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
            chrome.storage.session.remove('sessionKey');
        }, timeout);
    });
}

// Blacklist functions
const BLACKLIST_KEY = 'zerovault_blacklist';

async function checkBlacklist(url: string): Promise<boolean> {
    try {
        const result = await chrome.storage.local.get(BLACKLIST_KEY);
        const blacklist: string[] = result[BLACKLIST_KEY] || [];
        const domain = new URL(url).hostname.replace('www.', '');
        return blacklist.some(blacklisted => domain.includes(blacklisted));
    } catch (e) {
        return false;
    }
}

async function addToBlacklist(domain: string): Promise<void> {
    try {
        const result = await chrome.storage.local.get(BLACKLIST_KEY);
        const blacklist: string[] = result[BLACKLIST_KEY] || [];
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
        const blacklist: string[] = result[BLACKLIST_KEY] || [];
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
        return result[BLACKLIST_KEY] || [];
    } catch (e) {
        return [];
    }
}

chrome.runtime.onMessage.addListener(resetAutoLockTimer);
