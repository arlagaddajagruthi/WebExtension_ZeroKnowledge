/**
 * apiSync.service.ts
 * 
 * Background synchronization service using the Render backend API.
 * Handles fetching, pushing, and polling for vault updates.
 */
import { apiService } from './api.service';
import { encryptVaultData, decryptVaultData } from '../utils/crypto';

export const apiSyncService = {
    /**
     * Fetch the complete vault from the server
     */
    async fetchVault(masterKey: string) {
        try {
            const data = await apiService.getVault();
            if (!data || !data.encrypted_data) {
                return { success: true, vault: null };
            }

            // Decrypt the vault container
            const decrypted = await decryptVaultData(data.encrypted_data, masterKey);
            const credentials = JSON.parse(decrypted);

            return {
                success: true,
                credentials,
                version: data.version,
                updatedAt: data.updated_at
            };
        } catch (error: any) {
            console.error('ZeroVault: Fetch vault failed:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Push the current local vault to the server
     */
    async pushVault(credentials: any[], masterKey: string) {
        try {
            // Encrypt the entire vault
            const json = JSON.stringify(credentials);
            const encryptedData = await encryptVaultData(json, masterKey);

            // Sync with backend (the backend handles versioning)
            const result = await apiService.syncVault({
                encrypted_data: encryptedData,
                entry_count: credentials.length
            });

            return {
                success: true,
                version: result.version,
                updatedAt: result.updatedAt
            };
        } catch (error: any) {
            console.error('ZeroVault: Push vault failed:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Create/Update/Delete individual entries if the backend supports it (granular sync)
     * For now, we reuse pushVault for full sync, but we can add more granular ones if needed.
     */
    async createEntry(entry: any, masterKey: string) {
        return apiService.createEntry(entry);
    },

    async updateEntry(id: string | number, entry: any) {
        return apiService.updateEntry(id, entry);
    },

    async deleteEntry(id: string | number) {
        return apiService.deleteEntry(id);
    }
};
