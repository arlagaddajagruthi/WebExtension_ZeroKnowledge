
/**
 * Production-grade Crypto Utilities for ZeroVault
 * Uses Web Crypto API (SubtleCrypto)
 */

// Generate a random salt
export const generateSalt = (): string => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return btoa(String.fromCharCode(...salt));
};

// Derive a key from a password using PBKDF2
export const deriveMasterKey = async (password: string, salt: string): Promise<string> => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        enc.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)),
            iterations: 100000,
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    // Export as JWK to store/pass around as string
    const exported = await crypto.subtle.exportKey("jwk", key);
    return JSON.stringify(exported);
};

// Import a key from string (JWK)
const importKey = async (keyString: string): Promise<CryptoKey> => {
    const jwk = JSON.parse(keyString);
    return crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"]
    );
};

// Encrypt data using AES-GCM
export const encryptVaultData = async (data: string, keyString: string): Promise<string> => {
    const key = await importKey(keyString);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();

    const encrypted = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        enc.encode(data)
    );

    // Combine IV and data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
};

// Decrypt data using AES-GCM
export const decryptVaultData = async (encryptedData: string, keyString: string): Promise<string> => {
    const key = await importKey(keyString);

    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
};

export const generateRandomPassword = (length: number, options: {
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
}): string => {
    const charset = {
        uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        lowercase: 'abcdefghijklmnopqrstuvwxyz',
        numbers: '0123456789',
        symbols: '!@#$%^&*()_+~`|}{[]:;?><,./-='
    };

    let characters = '';
    if (options.uppercase) characters += charset.uppercase;
    if (options.lowercase) characters += charset.lowercase;
    if (options.numbers) characters += charset.numbers;
    if (options.symbols) characters += charset.symbols;

    if (characters.length === 0) return '';

    let password = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        password += characters.charAt(randomValues[i] % characters.length);
    }
    return password;
};
