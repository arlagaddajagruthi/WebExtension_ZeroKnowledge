/**
 * VAULT WORKFLOW ENGINE
 * 
 * Implements complete workflows per ARCHITECTURE_DESIGN.md:
 * - User Registration
 * - User Login
 * - Master Password Validation
 * - Vault Encryption/Decryption
 * - Session Management
 * - Auto-Lock
 */

import { deriveMasterKey, generateSalt, encryptVaultData, decryptVaultData } from '../utils/crypto';
import { supabase, authService } from './supabase';
import type { Credential } from '../utils/types';

export interface VaultState {
  credentials: Credential[];
  metadata: {
    createdAt: number;
    modifiedAt: number;
    version: number;
    deviceId: string;
    lastSyncedAt?: number;
  };
}

/**
 * WORKFLOW 1: USER REGISTRATION
 * 
 * Flow:
 * 1. Validate input
 * 2. Derive master key (ZERO-KNOWLEDGE)
 * 3. Register account on backend
 * 4. Initialize encrypted vault locally
 * 5. Setup auto-lock timer
 */
export async function registerUserWorkflow(
  email: string,
  accountPassword: string,
  masterPassword: string
): Promise<{ success: boolean; userId?: string; error?: string }> {
  try {
    console.log('[REGISTRATION] Starting registration workflow');

    // STEP 1: Input Validation
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    if (masterPassword.length < 12) {
      throw new Error('Master password must be at least 12 characters');
    }
    if (accountPassword.length < 8) {
      throw new Error('Account password must be at least 8 characters');
    }

    console.log('[REGISTRATION] Input validation passed');

    // STEP 2: Generate salt and derive master key (CLIENT-SIDE ONLY)
    const masterSalt = generateSalt();
    const masterKey = await deriveMasterKey(masterPassword, masterSalt);

    console.log('[REGISTRATION] Master key derived (never sent to server)');
    console.log('[REGISTRATION] Salt:', masterSalt.substring(0, 10) + '...');

    // STEP 3: Create master password hash for verification
    const masterPasswordHash = await deriveMasterKey(masterPassword, masterSalt);

    // STEP 4: Register account on backend (email + account password only)
    console.log('[REGISTRATION] Registering account on Supabase');
    const authResult = await authService.signUp(email, accountPassword);

    if (!authResult.success) {
      throw new Error((authResult.error as any)?.message || 'Registration failed');
    }

    const userId = authResult.data?.user?.id;
    if (!userId) {
      throw new Error('No user ID returned from registration');
    }

    console.log('[REGISTRATION] Account registered, userId:', userId);

    // STEP 5: Initialize empty vault locally
    const deviceId = crypto.randomUUID();
    const emptyVault: VaultState = {
      credentials: [],
      metadata: {
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        version: 1,
        deviceId,
        lastSyncedAt: undefined,
      },
    };

    // STEP 6: Encrypt vault with master key
    const vaultJson = JSON.stringify(emptyVault);
    const encryptedVault = await encryptVaultData(vaultJson, masterKey);

    // STEP 7: Save to local storage
    await chrome.storage.local.set({
      zerovault_vault: encryptedVault,
      zerovault_vault_hash: await hashData(encryptedVault),
      zerovault_vault_version: 1,
      zerovault_master_salt: masterSalt,
      zerovault_master_password_hash: masterPasswordHash,
      zerovault_device_id: deviceId,
      zerovault_user_id: userId,
      zerovault_registered: true,
    });

    console.log('[REGISTRATION] Vault initialized and encrypted locally');

    // STEP 8: Setup auto-lock timer
    await chrome.alarms.create('autoLock', { delayInMinutes: 15 });

    return { success: true, userId };
  } catch (error: any) {
    console.error('[REGISTRATION] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 2: USER LOGIN
 * 
 * Flow:
 * 1. Authenticate account (email + password)
 * 2. Retrieve salt from local storage
 * 3. Derive master key from user input
 * 4. Decrypt vault
 * 5. Store session key (volatile)
 * 6. Setup auto-lock timer
 */
export async function loginUserWorkflow(
  email: string,
  accountPassword: string,
  masterPassword: string
): Promise<{ success: boolean; vault?: VaultState; error?: string }> {
  try {
    console.log('[LOGIN] Starting login workflow');

    // STEP 1: Authenticate account on backend
    console.log('[LOGIN] Authenticating account:', email);
    const authResult = await authService.signIn(email, accountPassword);

    if (!authResult.success) {
      throw new Error('Invalid email or password');
    }

    console.log('[LOGIN] Account authentication successful');

    // STEP 2: Retrieve stored salt from local storage
    const stored = await chrome.storage.local.get([
      'zerovault_master_salt',
      'zerovault_master_password_hash',
      'zerovault_vault',
      'zerovault_user_id',
    ]);

    if (!stored.zerovault_master_salt) {
      throw new Error('Vault not initialized on this device');
    }

    console.log('[LOGIN] Salt retrieved from local storage');

    // STEP 3: Derive master key from user input
    const masterKey = await deriveMasterKey(masterPassword, stored.zerovault_master_salt as string);

    // STEP 4: Verify master password by checking hash
    if (masterKey !== stored.zerovault_master_password_hash) {
      console.error('[LOGIN] Master password verification failed');
      throw new Error('Incorrect master password');
    }

    console.log('[LOGIN] Master password verified');

    // STEP 5: Decrypt vault
    console.log('[LOGIN] Decrypting vault...');
    const decryptedVaultJson = await decryptVaultData(stored.zerovault_vault, masterKey);
    const vault: VaultState = JSON.parse(decryptedVaultJson);

    console.log('[LOGIN] Vault decrypted successfully, credentials:', vault.credentials.length);

    // STEP 6: Store session key (VOLATILE - chrome.storage.session)
    await chrome.storage.session.set({
      zerovault_master_key: masterKey,
      zerovault_session_token: authResult.data?.session?.access_token,
      zerovault_session_expiry: Date.now() + 24 * 60 * 60 * 1000,
      zerovault_is_locked: false,
    });

    console.log('[LOGIN] Session key stored (volatile)');

    // STEP 7: Setup auto-lock timer
    await chrome.alarms.create('autoLock', { delayInMinutes: 15 });

    return { success: true, vault };
  } catch (error: any) {
    console.error('[LOGIN] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 3: UNLOCK VAULT (after lock or on demand)
 * 
 * Flow:
 * 1. Verify master password
 * 2. Restore session key
 * 3. Set unlock status
 */
export async function unlockVaultWorkflow(masterPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[UNLOCK] Starting vault unlock');

    // Get stored salt
    const stored = await chrome.storage.local.get(['zerovault_master_salt', 'zerovault_master_password_hash']);

    // Verify password
    const masterKey = await deriveMasterKey(masterPassword, stored.zerovault_master_salt as string);

    if (masterKey !== stored.zerovault_master_password_hash) {
      throw new Error('Incorrect master password');
    }

    // Restore session key
    await chrome.storage.session.set({
      zerovault_master_key: masterKey,
      zerovault_is_locked: false,
    });

    // Restart auto-lock timer
    await chrome.alarms.create('autoLock', { delayInMinutes: 15 });

    console.log('[UNLOCK] Vault unlocked');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 4: LOCK VAULT (manual lock)
 * 
 * Flow:
 * 1. Clear session key
 * 2. Set locked status
 * 3. Clear from memory
 */
export async function lockVaultWorkflow(): Promise<void> {
  console.log('[LOCK] Locking vault');

  // Clear session key (volatile)
  await chrome.storage.session.remove(['zerovault_master_key', 'zerovault_session_token']);

  // Set locked status
  await chrome.storage.session.set({
    zerovault_is_locked: true,
  });

  console.log('[LOCK] Vault locked, session key cleared');
}

/**
 * WORKFLOW 5: AUTO-LOCK (triggered by alarm)
 * 
 * Called when auto-lock timer fires
 */
export async function autoLockVaultWorkflow(): Promise<void> {
  console.log('[AUTO-LOCK] Auto-lock timer triggered');

  await lockVaultWorkflow();
}

/**
 * WORKFLOW 6: LOGOUT
 * 
 * Flow:
 * 1. Clear all session data
 * 2. Logout from backend
 * 3. Clear UI state
 */
export async function logoutUserWorkflow(): Promise<void> {
  console.log('[LOGOUT] Starting logout workflow');

  // Clear session storage (volatile)
  await chrome.storage.session.clear();

  // Logout from backend
  await authService.signOut();

  console.log('[LOGOUT] User logged out');
}

/**
 * GET CURRENT VAULT STATE
 * 
 * Requires unlocked vault (master key in session)
 */
export async function getVaultState(): Promise<{ vault?: VaultState; error?: string }> {
  try {
    // Check if locked
    const session = await chrome.storage.session.get('zerovault_is_locked');
    if (session.zerovault_is_locked) {
      return { error: 'Vault is locked' };
    }

    // Get master key
    const sessionData = await chrome.storage.session.get('zerovault_master_key');
    const masterKey = sessionData.zerovault_master_key;

    if (!masterKey) {
      return { error: 'No session key' };
    }

    // Get encrypted vault
    const localData = await chrome.storage.local.get('zerovault_vault');
    const encryptedVault = localData.zerovault_vault as string;

    // Decrypt
    const vaultJson = await decryptVaultData(encryptedVault, masterKey as string);
    const vault: VaultState = JSON.parse(vaultJson);

    return { vault };
  } catch (error: any) {
    return { error: error.message };
  }
}

/**
 * SAVE VAULT STATE
 * 
 * After modifying vault (adding/editing/deleting credentials)
 * Re-encrypts and saves entire vault
 */
export async function saveVaultState(vault: VaultState): Promise<{ success: boolean; error?: string }> {
  try {
    // Get master key
    const sessionData = await chrome.storage.session.get('zerovault_master_key');
    const masterKey = sessionData.zerovault_master_key;

    if (!masterKey) {
      throw new Error('No session key - vault is locked');
    }

    // Update modified timestamp
    vault.metadata.modifiedAt = Date.now();
    vault.metadata.version++;

    // Encrypt
    const vaultJson = JSON.stringify(vault);
    const encryptedVault = await encryptVaultData(vaultJson, masterKey as string);

    // Save to storage
    await chrome.storage.local.set({
      zerovault_vault: encryptedVault,
      zerovault_vault_hash: await hashData(encryptedVault),
      zerovault_vault_version: vault.metadata.version,
      zerovault_pending_sync: true,
    });

    console.log('[VAULT] Saved, version:', vault.metadata.version);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * HELPER: Email validation
 */
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * HELPER: Hash data for integrity checking
 */
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
