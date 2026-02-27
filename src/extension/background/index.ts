import { MessageType, type Message } from '../../utils/messaging';
import { matchURL } from '../../utils/urlMatcher';
import { encryptVaultData, decryptVaultData, deriveMasterKey } from '../../utils/crypto';
import { vaultSyncService, syncService } from '../../services/supabase';

console.log('ZeroVault: Background script initialized');

// Debug function to check vault storage
async function debugVaultStorage() {
    try {
        const storage = await chrome.storage.local.get([
            'zerovault_master_salt',
            'zerovault_master_password_hash',
            'zerovault_initialized'
        ]);
        console.log('ZeroVault: Debug - Vault storage:', {
            hasSalt: !!storage.zerovault_master_salt,
            hasHash: !!storage.zerovault_master_password_hash,
            isInitialized: !!storage.zerovault_initialized,
            saltLength: storage.zerovault_master_salt?.length,
            hashLength: storage.zerovault_master_password_hash?.length
        });
    } catch (error) {
        console.error('ZeroVault: Debug - Error checking vault storage:', error);
    }
}

// Call debug function on startup
debugVaultStorage();

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

        case MessageType.GET_VAULT_STATUS:
            sendResponse({ isLocked: !sessionKey });
            return true;

        case MessageType.VERIFY_MASTER_PASSWORD:
            handleVerifyMasterPassword(message.data, sendResponse);
            return true; // Async

        case MessageType.VERIFY_AUTOFILL:
            handleVerifyAutofill(message.data, sendResponse);
            return true; // Async

        case MessageType.UNLOCK_VAULT:
            handleUnlockVault(message.data, sendResponse);
            return true; // Async

        case MessageType.FORM_SUBMITTED:
            handleFormSubmitted(message.data, sender.tab);
            sendResponse({ success: true });
            break;

        case MessageType.SAVE_CREDENTIAL:
            handleSaveCredential(message.data).then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                console.error('ZeroVault: Save credential error:', error);
                sendResponse({ success: false, error: error.message });
            });
            return true; // Async

        case MessageType.UPDATE_CREDENTIAL:
            handleUpdateCredential(message.data);
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
        // Save to local storage (existing method)
        const json = JSON.stringify(credentials);
        const encrypted = await encryptVaultData(json, sessionKey);
        await chrome.storage.local.set({ vault_credentials: encrypted });
        
        // Also sync individual encrypted credentials to Supabase
        try {
            const userId = await getCurrentUserId();
            console.log('ZeroVault: Checking sync - User ID:', userId);
            
            if (userId) {
                // Encrypt individual credentials for Supabase storage
                const encryptedCredentials = await Promise.all(
                    credentials.map(async (cred) => {
                        const credJson = JSON.stringify({
                            url: cred.url,
                            username: cred.username,
                            password: cred.password, // This will be encrypted
                            name: cred.name
                        });
                        const encryptedCred = await encryptVaultData(credJson, sessionKey);
                        return {
                            id: cred.id,
                            user_id: userId,
                            name: cred.name,
                            url: cred.url,
                            username: cred.username,
                            encrypted_data: encryptedCred,
                            created_at: cred.createdAt,
                            updated_at: new Date().toISOString()
                        };
                    })
                );
                
                console.log('ZeroVault: Attempting to sync credentials to Supabase...');
                const syncResult = await syncService.batchSyncCredentials(userId, encryptedCredentials);
                console.log('ZeroVault: Sync result:', syncResult);
                console.log('ZeroVault: Sync error details:', JSON.stringify(syncResult.error, null, 2));
                
                if (syncResult.success) {
                    console.log('ZeroVault: Credentials synced to Supabase successfully');
                } else {
                    console.warn('ZeroVault: Failed to sync credentials to Supabase:', syncResult.error);
                }
            } else {
                console.log('ZeroVault: No user ID found, skipping sync');
            }
        } catch (syncError) {
            console.warn('ZeroVault: Credential sync failed, but local save succeeded:', syncError);
        }
        
    } catch (error) {
        console.error('ZeroVault: Encryption failed:', error);
    }
}

// Helper function to get current user ID
async function getCurrentUserId(): Promise<string | null> {
    try {
        const result = await chrome.storage.local.get('zerovault_user_id');
        return result.zerovault_user_id || null;
    } catch (error) {
        console.error('ZeroVault: Error getting user ID:', error);
        return null;
    }
}

// Sync vault from Supabase to local storage
async function syncVaultFromSupabase(userId: string, masterKey: string) {
    try {
        console.log('ZeroVault: Syncing vault from Supabase...');
        
        const vaultResult = await vaultSyncService.getVault(userId);
        if (!vaultResult.success || !vaultResult.vault) {
            console.log('ZeroVault: No vault found in Supabase');
            return;
        }
        
        // Decrypt the vault data
        const decrypted = await decryptVaultData(vaultResult.vault.encrypted_data, masterKey);
        const credentials = JSON.parse(decrypted);
        
        // Save to local storage
        await chrome.storage.local.set({ 
            vault_credentials: vaultResult.vault.encrypted_data,
            zerovault_last_sync_time: Date.now(),
            zerovault_last_sync_version: vaultResult.vault.version
        });
        
        console.log(`ZeroVault: Synced ${credentials.length} credentials from Supabase`);
        
    } catch (error) {
        console.error('ZeroVault: Failed to sync vault from Supabase:', error);
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

    // Always check if credentials exist in vault, regardless of lock status
    const allCredentials = sessionKey ? await getDecryptedCredentials() : [];
    const existing = allCredentials.find((c) =>
        matchURL(c.url, data.url) && c.username === data.username
    );

    if (existing) {
        if (sessionKey && existing.password !== data.password) {
            // Show update prompt when password changes and vault is unlocked
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
            // Always show save prompt for new credentials
            chrome.tabs.sendMessage(tab.id, {
                type: MessageType.SHOW_SAVE_PROMPT,
                data,
            });
        } else {
            console.log('ZeroVault: Domain is blacklisted, skipping save prompt');
        }
    }
}

// Temporary storage for credentials when vault is locked
let pendingCredentials: Array<{ url: string; username: string; password: string }> = [];

async function handleSaveCredential(data: { url: string; username: string; password: string }) {
    console.log('ZeroVault: Attempting to save credential:', { url: data.url, username: data.username });
    
    try {
        // Always save credentials immediately, even if vault is locked
        // We'll encrypt with a temporary key and re-encrypt when vault is unlocked
        if (!sessionKey) {
            console.log('ZeroVault: Vault is locked, saving with temporary encryption');
            // Generate a temporary key for immediate storage
            const tempKey = 'temp_' + Date.now();
            
            // Get existing credentials or create empty array
            let credentials: any[] = [];
            try {
                const result = await chrome.storage.local.get('vault_credentials');
                const encrypted = result.vault_credentials;
                if (encrypted) {
                    // Try to decrypt with any available key to get existing credentials
                    const stored = await chrome.storage.local.get(['zerovault_master_password_hash', 'zerovault_master_salt']);
                    if (stored.zerovault_master_password_hash && stored.zerovault_master_salt) {
                        try {
                            const derivedKey = await deriveMasterKey('temp_password', stored.zerovault_master_salt as string);
                            const decrypted = await decryptVaultData(encrypted as string, derivedKey);
                            credentials = JSON.parse(decrypted);
                        } catch {
                            console.log('ZeroVault: Could not decrypt existing credentials, starting fresh');
                        }
                    }
                }
            } catch (error) {
                console.log('ZeroVault: No existing credentials found, starting fresh');
            }

            // Check for duplicates
            const exists = credentials.some(c => matchURL(c.url, data.url) && c.username === data.username);
            if (exists) {
                console.log('ZeroVault: Credential already exists, skipping save');
                return { success: true, message: 'Credential already exists' };
            }

            // Add new credential
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
            
            // Encrypt with temporary key and save
            const json = JSON.stringify(credentials);
            const encrypted = await encryptVaultData(json, tempKey);
            await chrome.storage.local.set({ 
                vault_credentials: encrypted,
                temp_encryption_key: tempKey,
                pending_save: true
            });
            
            console.log('ZeroVault: Credential saved with temporary encryption');
            return { success: true, message: 'Credential saved temporarily' };
        }

        // Vault is unlocked - save normally
        const credentials = await getDecryptedCredentials();
        console.log('ZeroVault: Current credentials count:', credentials.length);

        // Check for duplicates
        const exists = credentials.some(c => matchURL(c.url, data.url) && c.username === data.username);
        if (exists) {
            console.log('ZeroVault: Credential already exists, skipping save');
            return { success: true, message: 'Credential already exists' };
        }

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
        console.log('ZeroVault: Credential saved successfully:', newCredential.name);
        return { success: true, credential: newCredential };
    } catch (error) {
        console.error('ZeroVault: Error saving credential:', error);
        throw error;
    }
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
        console.log('ZeroVault: Unlock request received');
        
        // Get stored salt and password hash
        const stored = await chrome.storage.local.get([
            'zerovault_master_salt',
            'zerovault_master_password_hash'
        ]);
        
        console.log('ZeroVault: Stored data found:', {
            hasSalt: !!stored.zerovault_master_salt,
            hasHash: !!stored.zerovault_master_password_hash
        });

        if (!stored.zerovault_master_salt || !stored.zerovault_master_password_hash) {
            console.log('ZeroVault: Vault not initialized');
            sendResponse({ success: false, error: 'Vault not initialized' });
            return;
        }

        // Derive the key using provided master password and stored salt
        const derivedKey = await deriveMasterKey(data.masterPassword, stored.zerovault_master_salt as string);
        console.log('ZeroVault: Key derived from provided password');
        console.log('ZeroVault: Provided password length:', data.masterPassword.length);
        console.log('ZeroVault: Stored salt:', stored.zerovault_master_salt?.substring(0, 20) + '...');
        console.log('ZeroVault: Derived key:', derivedKey?.substring(0, 20) + '...');

        // Check if stored hash is a JWK format (new) or simple hash (old)
        let isValid = false;
        const storedHash = stored.zerovault_master_password_hash as string;
        console.log('ZeroVault: Stored hash type:', typeof storedHash);
        console.log('ZeroVault: Stored hash:', storedHash?.substring(0, 20) + '...');
        
        if (typeof storedHash === 'string') {
            try {
                // Try to parse as JSON to check if it's JWK
                const parsed = JSON.parse(storedHash);
                if (parsed.k) {
                    // JWK format - compare with derived key
                    // Both derivedKey and storedHash are JWK strings, so we need to parse both and compare the k property
                    const derivedJwk = JSON.parse(derivedKey);
                    isValid = derivedJwk.k === parsed.k;
                    console.log('ZeroVault: JWK format comparison');
                    console.log('ZeroVault: Derived k:', derivedJwk.k?.substring(0, 20) + '...');
                    console.log('ZeroVault: Stored k:', parsed.k?.substring(0, 20) + '...');
                } else {
                    // Simple hash format
                    isValid = derivedKey === storedHash;
                    console.log('ZeroVault: Simple hash format comparison');
                }
            } catch {
                // Not JSON, treat as simple hash
                isValid = derivedKey === storedHash;
                console.log('ZeroVault: Not JSON, simple hash comparison');
            }
        } else {
            isValid = derivedKey === storedHash;
            console.log('ZeroVault: Direct comparison');
        }
        
        console.log('ZeroVault: Password verification result:', isValid);
        console.log('ZeroVault: String comparison result:', derivedKey === storedHash);

        if (isValid) {
            sessionKey = derivedKey;
            if (chrome.storage.session) {
                await chrome.storage.session.set({ sessionKey });
            }
            console.log('ZeroVault: Vault unlocked successfully');
            
            // Sync vault from Supabase after successful unlock
            try {
                const userId = await getCurrentUserId();
                if (userId) {
                    await syncVaultFromSupabase(userId, derivedKey);
                }
            } catch (syncError) {
                console.warn('ZeroVault: Failed to sync from Supabase, using local vault:', syncError);
            }
            
            // Check if there are temporarily saved credentials to re-encrypt
            const storage = await chrome.storage.local.get(['vault_credentials', 'temp_encryption_key', 'pending_save']);
            if (storage.pending_save && storage.temp_encryption_key && storage.vault_credentials) {
                console.log('ZeroVault: Re-encrypting temporarily saved credentials');
                try {
                    // Decrypt with temporary key
                    const tempDecrypted = await decryptVaultData(storage.vault_credentials as string, storage.temp_encryption_key);
                    const tempCredentials = JSON.parse(tempDecrypted);
                    
                    // Re-encrypt with master key
                    const reEncrypted = await encryptVaultData(JSON.stringify(tempCredentials), derivedKey);
                    await chrome.storage.local.set({ 
                        vault_credentials: reEncrypted,
                        temp_encryption_key: null,
                        pending_save: false
                    });
                    console.log('ZeroVault: Re-encrypted credentials with master key');
                } catch (error) {
                    console.error('ZeroVault: Failed to re-encrypt credentials:', error);
                }
            }
            
            // Save any pending credentials that were stored while vault was locked
            if (pendingCredentials.length > 0) {
                console.log(`ZeroVault: Saving ${pendingCredentials.length} pending credentials`);
                for (const cred of pendingCredentials) {
                    try {
                        // Save directly without checking sessionKey again since we just unlocked
                        const credentials = await getDecryptedCredentials();
                        console.log('ZeroVault: Current credentials count:', credentials.length);

                        // Check for duplicates
                        const exists = credentials.some(c => matchURL(c.url, cred.url) && c.username === cred.username);
                        if (exists) {
                            console.log('ZeroVault: Pending credential already exists, skipping');
                            continue;
                        }

                        const newCredential: StoredCredential = {
                            id: crypto.randomUUID(),
                            name: new URL(cred.url).hostname.replace('www.', ''),
                            url: cred.url,
                            username: cred.username,
                            password: cred.password,
                            notes: '',
                            createdAt: new Date().toISOString(),
                        };

                        credentials.push(newCredential);
                        await saveEncryptedCredentials(credentials);
                        console.log('ZeroVault: Saved pending credential:', cred.username);
                    } catch (error) {
                        console.error('ZeroVault: Failed to save pending credential:', error);
                    }
                }
                pendingCredentials = []; // Clear pending credentials
            }
            
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

// Handler for verifying master password for autofill
async function handleVerifyMasterPassword(
    data: { token: string },
    sendResponse: (response?: any) => void
) {
    try {
        // Simple verification - accept any non-empty token
        if (data.token && data.token.trim().length > 0) {
            console.log('ZeroVault: Autofill verification successful');
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Invalid verification token' });
        }
    } catch (e: any) {
        console.error('ZeroVault: Verify master password failed', e);
        sendResponse({ success: false, error: e?.message || 'Unknown error' });
    }
}

// Handler for verifying autofill (simple verification)
async function handleVerifyAutofill(
    data: { token: string },
    sendResponse: (response?: any) => void
) {
    try {
        // Simple verification - accept any non-empty token
        if (data.token && data.token.trim().length > 0) {
            console.log('ZeroVault: Autofill verification successful');
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'Invalid verification token' });
        }
    } catch (e: any) {
        console.error('ZeroVault: Verify autofill failed', e);
        sendResponse({ success: false, error: e?.message || 'Unknown error' });
    }
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
