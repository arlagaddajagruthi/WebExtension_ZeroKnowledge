import { encryptVaultData, decryptVaultData } from '../utils/crypto';
import type { Credential } from '../utils/types';

const STORAGE_KEY = 'vault_credentials';

export const saveCredentials = async (credentials: Credential[], key: string) => {
    // We encrypt the entire list as a single blob for simplicity
    const json = JSON.stringify(credentials);
    const encrypted = await encryptVaultData(json, key);
    await chrome.storage.local.set({ [STORAGE_KEY]: encrypted });
};

export const loadCredentials = async (key: string): Promise<Credential[]> => {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const encrypted = result[STORAGE_KEY];

    if (!encrypted) return [];

    try {
        const decrypted = await decryptVaultData(encrypted as string, key);
        return JSON.parse(decrypted);
    } catch (e) {
        console.error('Failed to decrypt credentials', e);
        // If decryption fails, we might be using a wrong key or data is corrupted.
        // Returning empty array is safe but might hide data loss.
        // For now, it's safer than crashing.
        return [];
    }
};
