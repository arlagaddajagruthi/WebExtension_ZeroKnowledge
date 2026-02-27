import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

console.log('ZeroVault: Supabase URL:', SUPABASE_URL);
console.log('ZeroVault: Supabase Key configured:', !!SUPABASE_ANON_KEY);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('ZeroVault: Supabase credentials not configured. Sync will not work.');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test Supabase connection
export const testSupabaseConnection = async () => {
    try {
        const { data, error } = await supabase.from('test_connection').select('id').single();
        if (error) {
            console.error('ZeroVault: Supabase connection test failed:', error);
            return false;
        }
        console.log('ZeroVault: Supabase connection successful');
        return true;
    } catch (error) {
        console.error('ZeroVault: Supabase connection error:', error);
        return false;
    }
};

/**
 * Authentication service
 */
export const authService = {
    /**
     * Sign up a new user with email and password
     */
    async signUp(email: string, password: string) {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Supabase signup failed:', error);
            return { success: false, error };
        }
    },

    /**
     * Sign in a user with email and password
     */
    async signIn(email: string, password: string) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Supabase signin failed:', error);
            return { success: false, error };
        }
    },

    /**
     * Sign out the current user
     */
    async signOut() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Supabase signout failed:', error);
            return { success: false, error };
        }
    },

    /**
     * Get the current session
     */
    async getSession() {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return { success: true, session: data.session };
        } catch (error) {
            console.error('Failed to get session:', error);
            return { success: false, error };
        }
    },

    /**
     * Reset password
     */
    async resetPassword(email: string) {
        try {
            const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: chrome.runtime.getURL('options.html'),
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Password reset failed:', error);
            return { success: false, error };
        }
    },

    /**
     * Update password
     */
    async updatePassword(newPassword: string) {
        try {
            const { data, error } = await supabase.auth.updateUser({
                password: newPassword,
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Password update failed:', error);
            return { success: false, error };
        }
    },
};

/**
 * Sync service for credentials
 */
export const syncService = {
    /**
     * Get all encrypted credentials for the current user from the server
     */
    async getCredentials(userId: string) {
        try {
            const { data, error } = await supabase
                .from('credentials')
                .select('*')
                .eq('user_id', userId);
            if (error) throw error;
            return { success: true, credentials: data || [] };
        } catch (error) {
            console.error('Failed to fetch credentials:', error);
            return { success: false, error };
        }
    },

    /**
     * Save an encrypted credential to the server
     */
    async saveCredential(userId: string, credential: {
        id: string;
        name: string;
        url: string;
        encrypted_data: string;
        iv: string;
        version: number;
        lastUpdated: number;
    }) {
        try {
            const { data, error } = await supabase
                .from('credentials')
                .upsert([{
                    ...credential,
                    user_id: userId,
                }])
                .select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Failed to save credential:', error);
            return { success: false, error };
        }
    },

    /**
     * Delete a credential from the server
     */
    async deleteCredential(userId: string, credentialId: string) {
        try {
            const { error } = await supabase
                .from('credentials')
                .delete()
                .eq('user_id', userId)
                .eq('id', credentialId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to delete credential:', error);
            return { success: false, error };
        }
    },

    /**
     * Get changes since last sync
     */
    async getChangesSince(userId: string, lastSyncTime: number) {
        try {
            const { data, error } = await supabase
                .from('credentials')
                .select('*')
                .eq('user_id', userId)
                .gt('lastUpdated', lastSyncTime);
            if (error) throw error;
            return { success: true, changes: data || [] };
        } catch (error) {
            console.error('Failed to fetch changes:', error);
            return { success: false, error };
        }
    },

    /**
     * Sync multiple credentials at once (batch operation)
     */
    async batchSyncCredentials(userId: string, credentials: any[]) {
        try {
            const credentialsWithUser = credentials.map(cred => ({
                ...cred,
                user_id: userId,
            }));

            const { data, error } = await supabase
                .from('credentials')
                .upsert(credentialsWithUser)
                .select();
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Batch sync failed:', error);
            return { success: false, error };
        }
    },

    /**
     * Get sync metadata for conflict resolution
     */
    async getSyncMetadata(userId: string, credentialId: string) {
        try {
            const { data, error } = await supabase
                .from('credentials')
                .select('id,version,lastUpdated')
                .eq('user_id', userId)
                .eq('id', credentialId)
                .single();
            if (error) throw error;
            return { success: true, metadata: data };
        } catch (error) {
            console.error('Failed to fetch metadata:', error);
            return { success: false, error };
        }
    },
};

/**
 * Vault sync service for encrypted vault storage
 */
export const vaultSyncService = {
    /**
     * Get the encrypted vault for the current user
     */
    async getVault(userId: string) {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .select('*')
                .eq('user_id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
            return { success: true, vault: data };
        } catch (error) {
            console.error('Failed to fetch vault:', error);
            return { success: false, error };
        }
    },

    /**
     * Save the entire encrypted vault to Supabase
     */
    async saveVault(userId: string, vaultData: {
        encrypted_data: string;
        version: number;
        metadata: {
            totalCredentials: number;
            lastUpdated: string;
            deviceInfo?: string;
        };
    }) {
        try {
            // First try to update existing vault
            const { data: updateData, error: updateError } = await supabase
                .from('vaults')
                .update({
                    encrypted_data: vaultData.encrypted_data,
                    version: vaultData.version,
                    metadata: vaultData.metadata,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .select()
                .single();

            if (!updateError && updateData) {
                console.log('ZeroVault: Vault updated successfully');
                return { success: true, vault: updateData };
            }

            // If update fails (no existing vault), try to insert
            const { data: insertData, error: insertError } = await supabase
                .from('vaults')
                .insert({
                    user_id: userId,
                    encrypted_data: vaultData.encrypted_data,
                    version: vaultData.version,
                    metadata: vaultData.metadata,
                })
                .select()
                .single();

            if (insertError) throw insertError;
            return { success: true, vault: insertData };
        } catch (error) {
            console.error('Failed to save vault:', error);
            return { success: false, error };
        }
    },

    /**
     * Delete vault from Supabase
     */
    async deleteVault(userId: string) {
        try {
            const { error } = await supabase
                .from('vaults')
                .delete()
                .eq('user_id', userId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to delete vault:', error);
            return { success: false, error };
        }
    },

    /**
     * Get vault version for conflict resolution
     */
    async getVaultVersion(userId: string) {
        try {
            const { data, error } = await supabase
                .from('vaults')
                .select('version, updated_at')
                .eq('user_id', userId)
                .single();
            if (error && error.code !== 'PGRST116') throw error;
            return { success: true, version: data?.version || 0, updated_at: data?.updated_at };
        } catch (error) {
            console.error('Failed to get vault version:', error);
            return { success: false, error };
        }
    },
};

/**
 * Device tracking for multi-device sync
 */
export const deviceService = {
    /**
     * Register a new device
     */
    async registerDevice(userId: string, deviceInfo: {
        name: string;
        type: string; // 'extension' | 'mobile' | 'desktop'
        userAgent?: string;
    }) {
        try {
            const { data, error } = await supabase
                .from('devices')
                .insert([{
                    user_id: userId,
                    name: deviceInfo.name,
                    type: deviceInfo.type,
                    user_agent: deviceInfo.userAgent,
                    last_seen: new Date().toISOString(),
                }])
                .select();
            if (error) throw error;
            return { success: true, device: data?.[0] };
        } catch (error) {
            console.error('Failed to register device:', error);
            return { success: false, error };
        }
    },

    /**
     * Update device last seen timestamp
     */
    async updateDeviceActivity(userId: string, deviceId: string) {
        try {
            const { error } = await supabase
                .from('devices')
                .update({ last_seen: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('id', deviceId);
            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Failed to update device activity:', error);
            return { success: false, error };
        }
    },

    /**
     * Get all devices for the user
     */
    async getUserDevices(userId: string) {
        try {
            const { data, error } = await supabase
                .from('devices')
                .select('*')
                .eq('user_id', userId);
            if (error) throw error;
            return { success: true, devices: data || [] };
        } catch (error) {
            console.error('Failed to fetch devices:', error);
            return { success: false, error };
        }
    },
};
