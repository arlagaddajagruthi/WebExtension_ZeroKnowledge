/**
 * CREDENTIAL MANAGEMENT WORKFLOW
 * 
 * Implements workflows for:
 * - Adding credentials
 * - Editing credentials
 * - Deleting credentials (soft delete for sync)
 * - Searching credentials
 */

import { getVaultState, saveVaultState } from './vault-workflow';
import type { Credential } from '../utils/types';
import type { VaultState } from './vault-workflow';

/**
 * WORKFLOW 1: ADD NEW CREDENTIAL
 * 
 * Flow:
 * 1. Validate input
 * 2. Generate credential ID and metadata
 * 3. Add to vault
 * 4. Re-encrypt and save vault
 * 5. Mark as pending sync
 */
export async function addCredentialWorkflow(
  data: {
    url: string;
    username: string;
    password: string;
    notes?: string;
    tags?: string[];
  }
): Promise<{ success: boolean; credential?: Credential; error?: string }> {
  try {
    console.log('[ADD_CREDENTIAL] Starting add credential workflow');

    // STEP 1: Validate input
    if (!validateUrl(data.url)) {
      throw new Error('Invalid URL format');
    }
    if (!data.username || data.username.length === 0) {
      throw new Error('Username cannot be empty');
    }
    if (!data.password || data.password.length === 0) {
      throw new Error('Password cannot be empty');
    }
    if (data.username.length > 512) {
      throw new Error('Username too long (max 512 characters)');
    }
    if (data.password.length > 1024) {
      throw new Error('Password too long (max 1024 characters)');
    }

    console.log('[ADD_CREDENTIAL] Input validation passed');

    // STEP 2: Get current vault state
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error(vaultResult.error || 'Failed to load vault');
    }
    const vault = vaultResult.vault;

    // STEP 3: Check for duplicates
    const exists = vault.credentials.some(
      c => c.url === data.url && c.username === data.username
    );
    if (exists) {
      throw new Error('Credential already exists for this URL and username');
    }

    // STEP 4: Generate credential
    const newCredential: Credential = {
      id: crypto.randomUUID(),
      url: data.url,
      username: data.username,
      password: data.password,
      notes: data.notes || '',
      tags: data.tags || [],
      lastUpdated: Date.now(),
      version: 1,
      _deviceId: (vault.metadata.deviceId),
      _createdAt: Date.now(),
    };

    console.log('[ADD_CREDENTIAL] Credential generated:', newCredential.id);

    // STEP 5: Add to vault
    vault.credentials.push(newCredential);

    // STEP 6: Save vault (re-encrypts)
    const saveResult = await saveVaultState(vault);
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save vault');
    }

    console.log('[ADD_CREDENTIAL] Vault saved and encrypted');

    return { success: true, credential: newCredential };
  } catch (error: any) {
    console.error('[ADD_CREDENTIAL] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 2: EDIT CREDENTIAL
 * 
 * Flow:
 * 1. Get vault and find credential
 * 2. Validate updates
 * 3. Update fields (keep ID, update version & timestamp)
 * 4. Re-encrypt and save
 * 5. Mark as pending sync
 */
export async function editCredentialWorkflow(
  id: string,
  updates: Partial<Omit<Credential, 'id' | 'version' | 'lastUpdated' | '_deviceId' | '_createdAt'>>
): Promise<{ success: boolean; credential?: Credential; error?: string }> {
  try {
    console.log('[EDIT_CREDENTIAL] Starting edit credential workflow');

    // Get vault
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error(vaultResult.error || 'Failed to load vault');
    }
    const vault = vaultResult.vault;

    // Find credential
    const credential = vault.credentials.find(c => c.id === id);
    if (!credential) {
      throw new Error('Credential not found');
    }

    // Validate updates
    if (updates.url && !validateUrl(updates.url)) {
      throw new Error('Invalid URL format');
    }
    if (updates.username && updates.username.length === 0) {
      throw new Error('Username cannot be empty');
    }
    if (updates.password && updates.password.length === 0) {
      throw new Error('Password cannot be empty');
    }

    // Update credential
    const updatedCredential: Credential = {
      ...credential,
      ...updates,
      lastUpdated: Date.now(),
      version: (credential.version || 0) + 1,
    };

    console.log('[EDIT_CREDENTIAL] Credential updated, version:', updatedCredential.version);

    // Replace in vault
    const index = vault.credentials.findIndex(c => c.id === id);
    vault.credentials[index] = updatedCredential;

    // Save vault
    const saveResult = await saveVaultState(vault);
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save vault');
    }

    return { success: true, credential: updatedCredential };
  } catch (error: any) {
    console.error('[EDIT_CREDENTIAL] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 3: DELETE CREDENTIAL (soft delete for sync)
 * 
 * Soft delete: Keep credential but mark as deleted
 * Allows sync to propagate deletion across devices
 * 
 * Flow:
 * 1. Find credential
 * 2. Mark as deleted with timestamp
 * 3. Keep in vault (for sync)
 * 4. Filter from UI display
 * 5. On sync: Send deletion to server
 */
export async function deleteCredentialWorkflow(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[DELETE_CREDENTIAL] Starting delete credential workflow');

    // Get vault
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error(vaultResult.error || 'Failed to load vault');
    }
    const vault = vaultResult.vault;

    // Find credential
    const credential = vault.credentials.find(c => c.id === id);
    if (!credential) {
      throw new Error('Credential not found');
    }

    // Mark as deleted (soft delete)
    credential._isDeleted = true;
    credential._deletedAt = Date.now();
    credential.version++;

    console.log('[DELETE_CREDENTIAL] Credential marked as deleted (soft delete)');

    // Save vault
    const saveResult = await saveVaultState(vault);
    if (!saveResult.success) {
      throw new Error(saveResult.error || 'Failed to save vault');
    }

    return { success: true };
  } catch (error: any) {
    console.error('[DELETE_CREDENTIAL] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 4: HARD DELETE (immediate, no sync)
 * 
 * Use only for credentials never synced
 */
export async function hardDeleteCredentialWorkflow(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[HARD_DELETE_CREDENTIAL] Starting hard delete');

    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error('Failed to load vault');
    }
    const vault = vaultResult.vault;

    // Remove from vault entirely
    vault.credentials = vault.credentials.filter(c => c.id !== id);

    // Save vault
    const saveResult = await saveVaultState(vault);
    if (!saveResult.success) {
      throw new Error('Failed to save vault');
    }

    console.log('[HARD_DELETE_CREDENTIAL] Credential removed permanently');
    return { success: true };
  } catch (error: any) {
    console.error('[HARD_DELETE_CREDENTIAL] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 5: GET ALL CREDENTIALS (filtered)
 * 
 * Returns only active (non-deleted) credentials
 */
export async function getCredentialsWorkflow(): Promise<{ credentials: Credential[]; error?: string }> {
  try {
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      return { credentials: [], error: vaultResult.error };
    }

    // Filter out deleted credentials for UI display
    const credentials = vaultResult.vault.credentials.filter(c => !c._isDeleted);

    return { credentials };
  } catch (error: any) {
    return { credentials: [], error: error.message };
  }
}

/**
 * WORKFLOW 6: SEARCH CREDENTIALS
 * 
 * Search by URL, username, or notes
 */
export async function searchCredentialsWorkflow(query: string): Promise<{ credentials: Credential[]; error?: string }> {
  try {
    const { credentials } = await getCredentialsWorkflow();

    const lowerQuery = query.toLowerCase();
    const results = credentials.filter(c =>
      c.url.toLowerCase().includes(lowerQuery) ||
      c.username.toLowerCase().includes(lowerQuery) ||
      c.notes.toLowerCase().includes(lowerQuery) ||
      c.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );

    return { credentials: results };
  } catch (error: any) {
    return { credentials: [], error: error.message };
  }
}

/**
 * WORKFLOW 7: GET CREDENTIALS BY DOMAIN
 * 
 * Used for autofill matching
 */
export async function getCredentialsByDomainWorkflow(domain: string): Promise<{ credentials: Credential[]; error?: string }> {
  try {
    const { credentials } = await getCredentialsWorkflow();

    // Match by domain
    const matched = credentials.filter(c => {
      try {
        const credUrl = new URL(c.url);
        const credDomain = credUrl.hostname.replace('www.', '');
        return domain.includes(credDomain) || credDomain.includes(domain);
      } catch {
        return false;
      }
    });

    return { credentials: matched };
  } catch (error: any) {
    return { credentials: [], error: error.message };
  }
}

/**
 * HELPER: Validate URL format
 */
function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extend Credential type to include internal fields
 */
declare global {
  interface CredentialInternal extends Credential {
    _deviceId?: string;
    _createdAt?: number;
    _isDeleted?: boolean;
    _deletedAt?: number;
  }
}
