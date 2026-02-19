/**
 * Breach Monitoring Service
 * 
 * Uses HaveIBeenPwned API to check if passwords have been exposed in data breaches.
 * Uses k-anonymity to maintain privacy - only first 5 chars of SHA-1 hash sent to server.
 */

import type { Credential } from '../utils/types';

export interface BreachResult {
    isCompromised: boolean;
    breachCount?: number;
    passwordStrength?: 'weak' | 'fair' | 'good' | 'strong';
    message: string;
}

export interface CredentialBreachStatus extends Credential {
    breachStatus?: BreachResult;
    lastChecked?: number;
}

/**
 * SHA-1 hash a string
 */
async function sha1(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Check if a password has been compromised using k-anonymity
 * 
 * Implementation of: https://haveibeenpwned.com/API/v3#SearchingPastesWithk-Anonymity
 */
export async function checkPasswordBreach(password: string): Promise<BreachResult> {
    try {
        // Generate SHA-1 hash
        const hash = await sha1(password);
        const prefix = hash.substring(0, 5);
        const suffix = hash.substring(5);

        // Query HaveIBeenPwned API with k-anonymity
        // Only send first 5 chars, they return all matches
        const response = await fetch(
            `https://api.pwnedpasswords.com/range/${prefix}`,
            {
                method: 'GET',
                headers: {
                    'User-Agent': 'ZeroVault/1.0.0',
                }
            }
        );

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const text = await response.text();
        const lines = text.split('\r\n');

        // Check if our hash suffix is in the results
        for (const line of lines) {
            const [hashSuffix, count] = line.split(':');
            if (hashSuffix === suffix) {
                return {
                    isCompromised: true,
                    breachCount: parseInt(count, 10),
                    message: `This password has been exposed in ${count} known data breaches. Change it immediately.`,
                };
            }
        }

        return {
            isCompromised: false,
            message: 'This password has not been found in known breaches.',
        };

    } catch (error) {
        console.error('Breach check failed:', error);
        return {
            isCompromised: false,
            message: 'Could not check for breaches. Please check your internet connection.',
        };
    }
}

/**
 * Check multiple credentials for breaches
 */
export async function checkCredentialsBreach(
    credentials: Credential[]
): Promise<CredentialBreachStatus[]> {
    const results: CredentialBreachStatus[] = [];

    for (const credential of credentials) {
        const breachStatus = await checkPasswordBreach(credential.password);
        results.push({
            ...credential,
            breachStatus,
            lastChecked: Date.now(),
        });

        // Rate limiting: 1 second delay between requests (HIBP limits to 1 req/sec)
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return results;
}

/**
 * Cache breach check results locally
 */
export function cacheBreachResults(
    credentials: CredentialBreachStatus[]
): void {
    try {
        const cache = {
            timestamp: Date.now(),
            results: credentials.map(c => ({
                id: c.id,
                breachStatus: c.breachStatus,
                lastChecked: c.lastChecked,
            })),
        };

        localStorage.setItem('zerovault-breach-cache', JSON.stringify(cache));
    } catch (error) {
        console.error('Failed to cache breach results:', error);
    }
}

/**
 * Get cached breach results
 */
export function getCachedBreachResults(): Record<string, BreachResult> {
    try {
        const cached = localStorage.getItem('zerovault-breach-cache');
        if (!cached) return {};

        const data = JSON.parse(cached);
        const results: Record<string, BreachResult> = {};

        for (const result of data.results) {
            if (result.breachStatus) {
                results[result.id] = result.breachStatus;
            }
        }

        return results;
    } catch (error) {
        console.error('Failed to get cached breach results:', error);
        return {};
    }
}

/**
 * Get breach analysis summary
 */
export function getBreachSummary(credentials: CredentialBreachStatus[]) {
    const compromised = credentials.filter(c => c.breachStatus?.isCompromised).length;
    const uncompromised = credentials.filter(c => !c.breachStatus?.isCompromised).length;
    const unchecked = credentials.filter(c => !c.breachStatus).length;

    return {
        total: credentials.length,
        compromised,
        uncompromised,
        unchecked,
        compromisedPercentage: credentials.length > 0 ? (compromised / credentials.length) * 100 : 0,
    };
}

/**
 * Analyze password strength
 */
export function analyzePasswordStrength(password: string): 'weak' | 'fair' | 'good' | 'strong' {
    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;

    if (score <= 2) return 'weak';
    if (score <= 4) return 'fair';
    if (score <= 5) return 'good';
    return 'strong';
}

/**
 * Get reused passwords in vault
 */
export function findReusedPasswords(credentials: Credential[]): Map<string, Credential[]> {
    const passwordMap = new Map<string, Credential[]>();

    for (const credential of credentials) {
        if (!passwordMap.has(credential.password)) {
            passwordMap.set(credential.password, []);
        }
        passwordMap.get(credential.password)!.push(credential);
    }

    // Only return passwords used more than once
    const reused = new Map<string, Credential[]>();
    for (const [password, creds] of passwordMap) {
        if (creds.length > 1) {
            reused.set(password, creds);
        }
    }

    return reused;
}

/**
 * Get weak passwords in vault
 */
export function findWeakPasswords(credentials: Credential[]): Credential[] {
    return credentials.filter(cred => {
        const strength = analyzePasswordStrength(cred.password);
        return strength === 'weak' || strength === 'fair';
    });
}
