/**
 * MULTI-DEVICE SYNC WORKFLOW
 * 
 * Complete implementation of:
 * - Encrypted vault upload (push)
 * - Encrypted vault download (pull)
 * - Conflict resolution (last-write-wins)
 * - Version tracking
 * - Offline queue management
 */

import { getVaultState, saveVaultState } from './vault-workflow';
import { encryptVaultData, decryptVaultData } from '../utils/crypto';
import { supabase, syncService } from './supabase';
import type { VaultState } from './vault-workflow';
import type { Credential } from '../utils/types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

interface SyncMetadata {
  lastSyncTime: number;
  lastSyncVersion: number;
  pendingChanges: number;
}

/**
 * WORKFLOW 1: PUSH SYNC (Upload to server)
 * 
 * Flow:
 * 1. Check if vault has pending changes
 * 2. Get current vault state
 * 3. Encrypt vault with master key
 * 4. Create sync payload with metadata
 * 5. POST to server
 * 6. Update last sync time
 */
export async function pushSyncWorkflow(): Promise<{
  success: boolean;
  serverVersion?: number;
  error?: string;
}> {
  try {
    console.log('[PUSH_SYNC] Starting push sync workflow');

    // STEP 1: Check if online
    if (!navigator.onLine) {
      console.log('[PUSH_SYNC] Offline - queueing changes');
      return { success: false, error: 'Offline - changes will sync when online' };
    }

    // STEP 2: Get vault state
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error('Vault not available');
    }
    const vault = vaultResult.vault;

    // STEP 3: Get master key and session token
    const sessionData = await chrome.storage.session.get(['zerovault_master_key', 'zerovault_session_token']);
    const masterKey = sessionData.zerovault_master_key;
    const sessionToken = sessionData.zerovault_session_token;

    if (!masterKey) {
      throw new Error('Vault is locked');
    }

    console.log('[PUSH_SYNC] Vault loaded, version:', vault.metadata.version);

    // STEP 4: Encrypt entire vault (ZERO-KNOWLEDGE POINT)
    console.log('[PUSH_SYNC] Encrypting vault...');
    const vaultJson = JSON.stringify(vault);
    const encryptedVault = await encryptVaultData(vaultJson, masterKey as string);

    // STEP 5: Get local storage metadata
    const localStorage = await chrome.storage.local.get([
      'zerovault_user_id',
      'zerovault_device_id',
      'zerovault_vault_version',
    ]);

    // STEP 6: Create sync payload
    const syncPayload = {
      userId: localStorage.zerovault_user_id,
      deviceId: localStorage.zerovault_device_id,
      timestamp: Date.now(),
      vaultVersion: vault.metadata.version,
      encryptedVault: encryptedVault,
      credentialCount: vault.credentials.length,
      // Track changes for incremental sync
      changes: vault.credentials.map(c => ({
        id: c.id,
        action: 'created|updated|deleted',
        version: c.version,
        timestamp: c.lastUpdated,
      })),
    };

    // STEP 7: Create signature (HMAC-SHA256)
    const signature = await createSignature(
      JSON.stringify(syncPayload),
      (sessionToken as string) || 'unsigned'
    );

    console.log('[PUSH_SYNC] Payload created, size:', encryptedVault.length, 'bytes');

    // STEP 8: POST to server with retry logic
    const pushResult = await pushWithRetry(syncPayload, signature, (sessionToken as string) || '');

    if (!pushResult.success) {
      throw new Error(pushResult.error || 'Push failed');
    }

    // STEP 9: Update local sync metadata
    const newVersion = pushResult.serverVersion || vault.metadata.version;
    await chrome.storage.local.set({
      zerovault_last_sync_time: Date.now(),
      zerovault_last_sync_version: newVersion,
      zerovault_pending_sync: false,
    });

    console.log('[PUSH_SYNC] Push completed, server version:', newVersion);

    return { success: true, serverVersion: newVersion };
  } catch (error: any) {
    console.error('[PUSH_SYNC] Error:', error.message);

    // Queue for retry
    await queuePendingSync();

    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 2: PULL SYNC (Download from server)
 * 
 * Flow:
 * 1. Check last sync version
 * 2. Request changes since last sync
 * 3. Decrypt received changes
 * 4. Merge with local vault (conflict resolution)
 * 5. Save merged vault
 * 6. Update sync metadata
 */
export async function pullSyncWorkflow(): Promise<{
  success: boolean;
  changesCount?: number;
  conflictCount?: number;
  error?: string;
}> {
  try {
    console.log('[PULL_SYNC] Starting pull sync workflow');

    // STEP 1: Check if online
    if (!navigator.onLine) {
      console.log('[PULL_SYNC] Offline - cannot pull');
      return { success: false, error: 'Offline' };
    }

    // STEP 2: Get current vault
    const vaultResult = await getVaultState();
    if (!vaultResult.vault) {
      throw new Error('Vault not available');
    }
    const localVault = vaultResult.vault;

    // STEP 3: Get sync metadata
    const localSync = await chrome.storage.local.get([
      'zerovault_last_sync_time',
      'zerovault_last_sync_version',
      'zerovault_user_id',
    ]);

    const lastSyncTime = (localSync.zerovault_last_sync_time as number) || 0;
    const lastSyncVersion = (localSync.zerovault_last_sync_version as number) || 0;

    console.log('[PULL_SYNC] Requesting changes since version:', lastSyncVersion);

    // STEP 4: Request changes from server
    const pullResult = await pullWithRetry(lastSyncTime, (lastSyncVersion as number) || 0);

    if (!pullResult.success || !pullResult.remoteVault) {
      console.log('[PULL_SYNC] No changes available');
      return { success: true, changesCount: 0 };
    }

    // STEP 5: Decrypt remote vault
    const sessionData = await chrome.storage.session.get('zerovault_master_key');
    const masterKey = sessionData.zerovault_master_key;

    if (!masterKey) {
      throw new Error('Vault is locked');
    }

    console.log('[PULL_SYNC] Decrypting remote vault...');
    const remoteVaultJson = await decryptVaultData(pullResult.remoteVault as string, masterKey as string);
    const remoteVault: VaultState = JSON.parse(remoteVaultJson);

    // STEP 6: Merge with conflict resolution
    console.log('[PULL_SYNC] Merging with local vault...');
    const mergeResult = mergeVaults(localVault, remoteVault);

    // STEP 7: Save merged vault
    const saveResult = await saveVaultState(mergeResult.merged);
    if (!saveResult.success) {
      throw new Error('Failed to save merged vault');
    }

    // STEP 8: Update sync metadata
    await chrome.storage.local.set({
      zerovault_last_sync_time: Date.now(),
      zerovault_last_sync_version: remoteVault.metadata.version,
    });

    console.log('[PULL_SYNC] Pull completed, merged', mergeResult.changesCount, 'credentials');

    return {
      success: true,
      changesCount: mergeResult.changesCount,
      conflictCount: mergeResult.conflictCount,
    };
  } catch (error: any) {
    console.error('[PULL_SYNC] Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * WORKFLOW 3: FULL SYNC (Push then Pull)
 * 
 * Coordinated sync: Upload local changes, then download remote
 */
export async function fullSyncWorkflow(): Promise<{
  success: boolean;
  status: SyncStatus;
  error?: string;
}> {
  try {
    console.log('[FULL_SYNC] Starting full sync workflow');

    if (!navigator.onLine) {
      await queuePendingSync();
      return { success: false, status: 'offline', error: 'Offline' };
    }

    // STEP 1: Push local changes
    console.log('[FULL_SYNC] Pushing changes...');
    const pushResult = await pushSyncWorkflow();

    // STEP 2: Pull remote changes
    console.log('[FULL_SYNC] Pulling changes...');
    const pullResult = await pullSyncWorkflow();

    if (pushResult.success && pullResult.success) {
      console.log('[FULL_SYNC] Sync completed successfully');
      return { success: true, status: 'synced' };
    }

    return {
      success: false,
      status: 'error',
      error: pushResult.error || pullResult.error || 'Sync failed',
    };
  } catch (error: any) {
    console.error('[FULL_SYNC] Error:', error.message);
    return { success: false, status: 'error', error: error.message };
  }
}

/**
 * WORKFLOW 4: MERGE VAULTS (Conflict Resolution)
 * 
 * Algorithm: Last-Write-Wins (LWW)
 * 
 * For each credential:
 * - If only in local: Keep local
 * - If only in remote: Add remote
 * - If in both:
 *   - If local.lastUpdated > remote.lastUpdated: Keep local
 *   - If remote.lastUpdated > local.lastUpdated: Use remote
 *   - If equal: Use deterministic tiebreaker (alphabetically first deviceId)
 */
function mergeVaults(local: VaultState, remote: VaultState): {
  merged: VaultState;
  changesCount: number;
  conflictCount: number;
} {
  console.log('[MERGE] Merging vaults...');
  console.log('[MERGE] Local version:', local.metadata.version, 'credentials:', local.credentials.length);
  console.log('[MERGE] Remote version:', remote.metadata.version, 'credentials:', remote.credentials.length);

  const localMap = new Map(local.credentials.map(c => [c.id, c]));
  const remoteMap = new Map(remote.credentials.map(c => [c.id, c]));

  const merged = new Map(localMap);
  let changesCount = 0;
  let conflictCount = 0;

  // Process all remote credentials
  for (const [id, remoteCred] of remoteMap) {
    const localCred = localMap.get(id);

    if (!localCred) {
      // Remote only: Add to merged
      console.log('[MERGE] New credential from remote:', id);
      merged.set(id, remoteCred);
      changesCount++;
    } else {
      // Both exist: Resolve conflict
      const resolved = resolveCredentialConflict(localCred, remoteCred);

      if (resolved.id !== localCred.id) {
        console.log('[MERGE] Conflict resolved, using remote:', id);
        conflictCount++;
      }

      merged.set(id, resolved);
    }
  }

  // Update vault metadata
  const mergedVault: VaultState = {
    credentials: Array.from(merged.values()),
    metadata: {
      ...local.metadata,
      version: Math.max(local.metadata.version, remote.metadata.version) + 1,
      modifiedAt: Date.now(),
      lastSyncedAt: Date.now(),
    },
  };

  console.log('[MERGE] Merge complete: changes=', changesCount, 'conflicts=', conflictCount);

  return { merged: mergedVault, changesCount, conflictCount };
}

/**
 * HELPER: Resolve single credential conflict
 * 
 * Algorithm: Last-Write-Wins
 */
function resolveCredentialConflict(local: Credential, remote: Credential): Credential {
  const localTime = local.lastUpdated || 0;
  const remoteTime = remote.lastUpdated || 0;

  if (localTime > remoteTime) {
    console.log('[CONFLICT] Local wins (newer timestamp)');
    return local;
  }

  if (remoteTime > localTime) {
    console.log('[CONFLICT] Remote wins (newer timestamp)');
    return remote;
  }

  // Same timestamp: Use deterministic tiebreaker
  const localDeviceId = (local as any)._deviceId || '';
  const remoteDeviceId = (remote as any)._deviceId || '';

  const winner = localDeviceId > remoteDeviceId ? remote : local;
  console.log('[CONFLICT] Tie, using tiebreaker:', winner === local ? 'local' : 'remote');

  return winner;
}

/**
 * HELPER: Push with retry logic
 * 
 * Exponential backoff: 1s, 2s, 4s, 8s...
 */
async function pushWithRetry(
  payload: any,
  signature: string,
  sessionToken: string
): Promise<{ success: boolean; serverVersion?: number; error?: string }> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log('[PUSH_RETRY] Attempt', attempt + 1, 'of', maxRetries);

      // POST /api/vault/sync/push
      const response = await fetch('http://localhost:3000/api/vault/sync/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`,
          'X-Signature': signature,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, serverVersion: result.vaultVersion };
      }

      if (response.status === 503) {
        // Server unavailable: Don't retry aggressively
        throw new Error('Service temporarily unavailable');
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error: any) {
      attempt++;
      const delay = Math.pow(2, attempt) * 1000;

      if (attempt >= maxRetries) {
        return { success: false, error: error.message };
      }

      console.log('[PUSH_RETRY] Retrying in', delay, 'ms');
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * HELPER: Pull with retry logic
 */
async function pullWithRetry(
  lastSyncTime: number,
  lastSyncVersion: number
): Promise<{ success: boolean; remoteVault?: string; error?: string }> {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log('[PULL_RETRY] Attempt', attempt + 1, 'of', maxRetries);

      // GET /api/vault/sync/pull
      const response = await fetch(
        `http://localhost:3000/api/vault/sync/pull?since=${lastSyncTime}&version=${lastSyncVersion}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${(await chrome.storage.session.get('zerovault_session_token')).zerovault_session_token}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        return { success: true, remoteVault: result.encryptedVault };
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error: any) {
      attempt++;
      const delay = Math.pow(2, attempt) * 1000;

      if (attempt >= maxRetries) {
        return { success: false, error: error.message };
      }

      console.log('[PULL_RETRY] Retrying in', delay, 'ms');
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

/**
 * HELPER: Queue changes for offline sync
 */
async function queuePendingSync(): Promise<void> {
  const queue = ((await chrome.storage.local.get('zerovault_sync_queue')).zerovault_sync_queue as any[]) || [];

  queue.push({
    type: 'SYNC',
    timestamp: Date.now(),
  });

  await chrome.storage.local.set({ zerovault_sync_queue: queue });
  console.log('[QUEUE] Sync queued for later');
}

/**
 * HELPER: Create HMAC signature
 */
async function createSignature(data: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
