import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('ZeroVault: Supabase credentials not configured. Sync will not work.');
}

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
     * Send a one-time passcode (OTP) to the user's registered email.
     * This uses Supabase's passwordless email OTP feature.
     */
    async sendOtpToEmail(email: string) {
        try {
            const { data, error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false,
                },
            });
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Supabase send OTP failed:', error);
            return { success: false, error };
        }
    },

    /**
     * Verify an email OTP token.
     */
    async verifyEmailOtp(email: string, token: string) {
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token,
                type: 'email',
            } as any);
            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Supabase verify OTP failed:', error);
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
