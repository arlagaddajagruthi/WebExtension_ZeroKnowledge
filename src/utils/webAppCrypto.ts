/**
 * webAppCrypto.ts
 * 
 * Compatibility layer for the web application's mock encryption scheme.
 * The web app uses a simple 'ENC:' prefix followed by Base64 encoded data.
 * This is NOT secure for production but is required for cross-platform compatibility
 * with the current web app implementation.
 */

const SECRET_PREFIX = 'ENC:';

export const webAppCrypto = {
    /**
     * Encrypts a string using the web app's mock scheme.
     */
    encrypt: async (text: string): Promise<string> => {
        try {
            return SECRET_PREFIX + btoa(text);
        } catch (e) {
            console.error('webAppCrypto: Encryption failed', e);
            return text;
        }
    },

    /**
     * Decrypts a string starting with 'ENC:' using the web app's mock scheme.
     */
    decrypt: async (encryptedText: string): Promise<string> => {
        if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.startsWith(SECRET_PREFIX)) {
            return encryptedText;
        }

        try {
            return atob(encryptedText.substring(SECRET_PREFIX.length));
        } catch (e) {
            console.error('webAppCrypto: Decryption failed for', encryptedText, e);
            return encryptedText;
        }
    }
};
