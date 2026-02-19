import { describe, it, expect, beforeEach } from 'vitest';
import {
    generateSalt,
    deriveMasterKey,
    encryptVaultData,
    decryptVaultData,
    generateRandomPassword,
} from './crypto';

describe('Crypto Utilities', () => {
    describe('Salt Generation', () => {
        it('should generate a random salt', () => {
            const salt1 = generateSalt();
            const salt2 = generateSalt();

            expect(salt1).toBeTruthy();
            expect(salt2).toBeTruthy();
            expect(salt1).not.toBe(salt2);
        });

        it('should generate base64 encoded salts', () => {
            const salt = generateSalt();
            expect(() => atob(salt)).not.toThrow();
        });

        it('should generate salts of consistent length', () => {
            const salts = Array.from({ length: 10 }, () => generateSalt());
            const lengths = new Set(salts.map(s => s.length));
            expect(lengths.size).toBe(1);
        });
    });

    describe('Key Derivation', () => {
        it('should derive a key from password and salt', async () => {
            const password = 'TestPassword123!';
            const salt = generateSalt();

            const key = await deriveMasterKey(password, salt);

            expect(key).toBeTruthy();
            expect(typeof key).toBe('string');
        });

        it('should produce same key for same password and salt', async () => {
            const password = 'TestPassword123!';
            const salt = generateSalt();

            const key1 = await deriveMasterKey(password, salt);
            const key2 = await deriveMasterKey(password, salt);

            expect(key1).toBe(key2);
        });

        it('should produce different keys for different passwords', async () => {
            const salt = generateSalt();

            const key1 = await deriveMasterKey('Password1', salt);
            const key2 = await deriveMasterKey('Password2', salt);

            expect(key1).not.toBe(key2);
        });

        it('should produce different keys for different salts', async () => {
            const password = 'TestPassword123!';
            const salt1 = generateSalt();
            const salt2 = generateSalt();

            const key1 = await deriveMasterKey(password, salt1);
            const key2 = await deriveMasterKey(password, salt2);

            expect(key1).not.toBe(key2);
        });

        it('should handle long passwords', async () => {
            const longPassword = 'A'.repeat(256);
            const salt = generateSalt();

            const key = await deriveMasterKey(longPassword, salt);

            expect(key).toBeTruthy();
        });

        it('should handle special characters in password', async () => {
            const password = 'P@ssw0rd!#$%^&*()_+-=[]{}|;:,.<>?';
            const salt = generateSalt();

            const key = await deriveMasterKey(password, salt);

            expect(key).toBeTruthy();
        });
    });

    describe('Encryption/Decryption', () => {
        let key: string;

        beforeEach(async () => {
            const password = 'TestPassword123!';
            const salt = generateSalt();
            key = await deriveMasterKey(password, salt);
        });

        it('should encrypt and decrypt data', async () => {
            const plaintext = 'Secret data';

            const encrypted = await encryptVaultData(plaintext, key);
            const decrypted = await decryptVaultData(encrypted, key);

            expect(decrypted).toBe(plaintext);
        });

        it('should encrypt to different ciphertexts each time', async () => {
            const plaintext = 'Secret data';

            const encrypted1 = await encryptVaultData(plaintext, key);
            const encrypted2 = await encryptVaultData(plaintext, key);

            // Different IVs should produce different ciphertexts
            expect(encrypted1).not.toBe(encrypted2);

            // But both should decrypt to same plaintext
            const decrypted1 = await decryptVaultData(encrypted1, key);
            const decrypted2 = await decryptVaultData(encrypted2, key);

            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
        });

        it('should handle JSON data', async () => {
            const data = JSON.stringify({
                username: 'user@example.com',
                password: 'SecurePass123!',
            });

            const encrypted = await encryptVaultData(data, key);
            const decrypted = await decryptVaultData(encrypted, key);
            const parsed = JSON.parse(decrypted);

            expect(parsed.username).toBe('user@example.com');
            expect(parsed.password).toBe('SecurePass123!');
        });

        it('should handle empty strings', async () => {
            const plaintext = '';

            const encrypted = await encryptVaultData(plaintext, key);
            const decrypted = await decryptVaultData(encrypted, key);

            expect(decrypted).toBe(plaintext);
        });

        it('should handle large data', async () => {
            const largeData = 'X'.repeat(10000);

            const encrypted = await encryptVaultData(largeData, key);
            const decrypted = await decryptVaultData(encrypted, key);

            expect(decrypted).toBe(largeData);
        });

        it('should fail to decrypt with wrong key', async () => {
            const plaintext = 'Secret data';
            const wrongPassword = 'WrongPassword';
            const salt = generateSalt();
            const wrongKey = await deriveMasterKey(wrongPassword, salt);

            const encrypted = await encryptVaultData(plaintext, key);

            expect(async () => {
                await decryptVaultData(encrypted, wrongKey);
            }).rejects.toThrow();
        });

        it('should fail to decrypt corrupted ciphertext', async () => {
            const plaintext = 'Secret data';
            const encrypted = await encryptVaultData(plaintext, key);

            // Corrupt the ciphertext
            const corrupted = encrypted.slice(0, -10) + 'corrupted';

            expect(async () => {
                await decryptVaultData(corrupted, key);
            }).rejects.toThrow();
        });
    });

    describe('Password Generation', () => {
        it('should generate a password', () => {
            const password = generateRandomPassword(16, {
                uppercase: true,
                lowercase: true,
                numbers: true,
                symbols: true,
            });

            expect(password).toBeTruthy();
            expect(password.length).toBe(16);
        });

        it('should respect length parameter', () => {
            for (let length of [8, 16, 32, 64]) {
                const password = generateRandomPassword(length, {
                    uppercase: true,
                    lowercase: true,
                    numbers: true,
                    symbols: true,
                });
                expect(password.length).toBe(length);
            }
        });

        it('should respect character options', () => {
            const password = generateRandomPassword(128, {
                uppercase: true,
                lowercase: false,
                numbers: false,
                symbols: false,
            });

            expect(/^[A-Z]+$/.test(password)).toBe(true);
        });

        it('should generate unique passwords', () => {
            const passwords = new Set(
                Array.from({ length: 10 }, () =>
                    generateRandomPassword(16, {
                        uppercase: true,
                        lowercase: true,
                        numbers: true,
                        symbols: true,
                    })
                )
            );

            expect(passwords.size).toBe(10);
        });

        it('should not generate password with no character options', () => {
            const password = generateRandomPassword(16, {
                uppercase: false,
                lowercase: false,
                numbers: false,
                symbols: false,
            });

            expect(password).toBe('');
        });
    });
});
