/**
 * WebAuthn Service for Biometric Authentication
 * 
 * Implements FIDO2/WebAuthn for secure biometric authentication
 * (fingerprint, face recognition, etc.)
 */

export interface WebAuthnCredential {
    id: string;
    publicKey: ArrayBuffer;
    counter: number;
    transports?: AuthenticatorTransport[];
}

/**
 * Register a new biometric credential
 */
export async function registerBiometric(
    userId: string,
    username: string,
    email: string
): Promise<{ success: boolean; credential?: WebAuthnCredential; error?: string }> {
    try {
        // Check browser support
        if (!window.PublicKeyCredential) {
            return {
                success: false,
                error: 'WebAuthn is not supported on this device'
            };
        }

        // Get credential creation options from server
        // In production, this would come from your backend
        const options: CredentialCreationOptions = {
            publicKey: {
                challenge: new Uint8Array(32),
                rp: {
                    name: 'ZeroVault',
                    id: window.location.hostname,
                },
                user: {
                    id: new TextEncoder().encode(userId),
                    name: email,
                    displayName: username,
                },
                pubKeyCredParams: [
                    { alg: -7, type: 'public-key' },
                    { alg: -257, type: 'public-key' },
                ],
                timeout: 60000,
                attestation: 'direct',
                authenticatorSelection: {
                    authenticatorAttachment: 'platform', // Use device biometric
                    residentKey: 'preferred',
                    userVerification: 'preferred',
                },
            },
        };

        // Create credential
        const credential = await navigator.credentials.create(options) as PublicKeyCredential;

        if (!credential) {
            return {
                success: false,
                error: 'Failed to create credential'
            };
        }

        // Extract public key
        const response = credential.response as AuthenticatorAttestationResponse;
        const attestationObject = response.attestationObject;
        const clientDataJSON = response.clientDataJSON;

        // Store credential
        const stored = {
            id: credential.id,
            publicKey: attestationObject,
            counter: 0,
            transports: response.getTransports?.() || [],
        };

        return {
            success: true,
            credential: stored,
        };

    } catch (error: any) {
        console.error('WebAuthn registration failed:', error);
        return {
            success: false,
            error: error.message || 'WebAuthn registration failed'
        };
    }
}

/**
 * Authenticate using biometric credential
 */
export async function authenticateBiometric(
    credential: WebAuthnCredential
): Promise<{ success: boolean; verified?: boolean; error?: string }> {
    try {
        if (!window.PublicKeyCredential) {
            return {
                success: false,
                error: 'WebAuthn is not supported on this device'
            };
        }

        const options: CredentialRequestOptions = {
            publicKey: {
                challenge: new Uint8Array(32),
                allowCredentials: [
                    {
                        id: typeof credential.id === 'string' 
                            ? new TextEncoder().encode(credential.id)
                            : credential.id as ArrayBuffer,
                        type: 'public-key',
                        transports: credential.transports,
                    },
                ],
                timeout: 60000,
                userVerification: 'preferred',
            },
        };

        // Get assertion
        const assertion = await navigator.credentials.get(options) as PublicKeyCredential;

        if (!assertion) {
            return {
                success: false,
                error: 'Authentication failed'
            };
        }

        return {
            success: true,
            verified: true,
        };

    } catch (error: any) {
        // User cancelled or biometric failed
        if (error.name === 'NotAllowedError') {
            return {
                success: false,
                error: 'Biometric authentication cancelled or not available'
            };
        }
        console.error('WebAuthn authentication failed:', error);
        return {
            success: false,
            error: error.message || 'WebAuthn authentication failed'
        };
    }
}

/**
 * Check if WebAuthn is available
 */
export function isWebAuthnAvailable(): boolean {
    return window.PublicKeyCredential !== undefined &&
           navigator.credentials !== undefined;
}

/**
 * Check if platform authenticator is available (device biometric)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!window.PublicKeyCredential) {
        return false;
    }

    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}

/**
 * Get available authenticator info
 */
export async function getAuthenticatorInfo(): Promise<{
    biometricsAvailable: boolean;
    securityKeyAvailable: boolean;
}> {
    return {
        biometricsAvailable: await isPlatformAuthenticatorAvailable(),
        securityKeyAvailable: isWebAuthnAvailable(),
    };
}

/**
 * Store biometric credential locally
 */
export function storeBiometricCredential(
    userId: string,
    credential: WebAuthnCredential
): void {
    try {
        const stored = {
            userId,
            credential: {
                id: credential.id,
                publicKey: Array.from(new Uint8Array(credential.publicKey)),
                counter: credential.counter,
                transports: credential.transports,
            },
            registeredAt: Date.now(),
        };

        localStorage.setItem(
            `zerovault-biometric-${userId}`,
            JSON.stringify(stored)
        );
    } catch (error) {
        console.error('Failed to store biometric credential:', error);
    }
}

/**
 * Get stored biometric credential
 */
export function getBiometricCredential(userId: string): WebAuthnCredential | null {
    try {
        const stored = localStorage.getItem(`zerovault-biometric-${userId}`);
        if (!stored) {
            return null;
        }

        const data = JSON.parse(stored);
        return {
            id: data.credential.id,
            publicKey: new Uint8Array(data.credential.publicKey).buffer,
            counter: data.credential.counter,
            transports: data.credential.transports,
        };
    } catch (error) {
        console.error('Failed to retrieve biometric credential:', error);
        return null;
    }
}

/**
 * Remove biometric credential
 */
export function removeBiometricCredential(userId: string): void {
    localStorage.removeItem(`zerovault-biometric-${userId}`);
}

/**
 * List all registered biometric credentials for user
 */
export function listBiometricCredentials(userId: string): WebAuthnCredential[] {
    // In a full implementation, you'd store multiple credentials
    const credential = getBiometricCredential(userId);
    return credential ? [credential] : [];
}
