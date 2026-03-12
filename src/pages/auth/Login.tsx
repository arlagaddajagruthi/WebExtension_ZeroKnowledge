import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import { Button, Input, Label, Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { deriveMasterKey } from '../../utils/crypto';
import { sendToBackground, MessageType } from '../../utils/messaging';
import { apiService } from '../../services/api.service';

/**
 * Simplified Login Component
 * 
 * Clean two-step process:
 * 1. Account Login: Email + password with Supabase
 * 2. Vault Unlock: Master password for local vault
 */
const Login = () => {
    const navigate = useNavigate();
    const { isRegistered, masterPasswordHash, vaultSalt, setAuthenticated, setRegistered } = useAuthStore();
    const { setLocked: setVaultLocked, setCredentials, syncVault } = useVaultStore();

    // Form states
    const [email, setEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [vaultPassword, setVaultPassword] = useState('');
    const [showAccountPassword, setShowAccountPassword] = useState(false);
    const [showVaultPassword, setShowVaultPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'account' | 'mfa' | 'vault'>('account');
    const [userId, setUserId] = useState<string | null>(null);
    const [otp, setOtp] = useState('');

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            const { token, user } = useAuthStore.getState();
            if (token && user) {
                setUserId(user.id);
                setStep('vault');
            }
        };
        checkSession();
    }, []);

    // Handle account login
    const handleAccountLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (!email || !accountPassword) {
                setError('Email and password are required.');
                return;
            }

            // Call App Server for authentication
            const result = await apiService.login({ email, password: accountPassword });

            if (result.requiresMFA) {
                setUserId(result.userId);
                setStep('mfa');
            } else if (result.token && result.user) {
                setAuthenticated(false, undefined, result.token, result.user);
                setUserId(result.user.id);
                setStep('vault');

                await chrome.storage.local.set({
                    zerovault_user_id: result.user.id,
                    zerovault_token: result.token
                });
            } else {
                throw new Error('Login failed. Please check your credentials.');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle MFA Verification
    const handleMfaVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (!userId || !otp) {
                setError('Verification code is required.');
                return;
            }

            const result = await apiService.verifyMfa(userId, otp);

            if (result.token && result.user) {
                setAuthenticated(false, undefined, result.token, result.user);
                setStep('vault');

                await chrome.storage.local.set({
                    zerovault_user_id: result.user.id,
                    zerovault_token: result.token
                });
            } else {
                throw new Error('Verification failed.');
            }
        } catch (err: any) {
            setError(err.message || 'Verification failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendMfa = async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            await apiService.resendMfa(userId);
            setError('New code sent!');
            setTimeout(() => setError(''), 3000);
        } catch (err: any) {
            setError(err.message || 'Failed to resend code');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle vault unlock
    const handleVaultUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // SELF-INITIALIZATION: If we don't have a salt/hash, this is a fresh extension install/reload.
            // We allow initializing with the provided master password.
            if (!masterPasswordHash || !vaultSalt) {
                console.log('[LOGIN] Vault salt missing, initializing new salt');
                const newSalt = await (await import('../../utils/crypto')).generateSalt();
                const newHash = await deriveMasterKey(vaultPassword, newSalt);

                setRegistered(true, newHash, newSalt);

                // Re-fetch state to ensure the new values are available for the rest of the flow
                const updatedState = useAuthStore.getState();
                const currentHash = updatedState.masterPasswordHash;
                const currentSalt = updatedState.vaultSalt;

                if (currentHash && currentSalt) {
                    await handleVaultUnlockSuccess(vaultPassword, currentSalt, currentHash);
                } else {
                    throw new Error('Failed to initialize vault state.');
                }
                return;
            }

            const hash = await deriveMasterKey(vaultPassword, vaultSalt);

            if (hash === masterPasswordHash) {
                await handleVaultUnlockSuccess(vaultPassword, vaultSalt, hash);
            } else {
                setError('Incorrect master password. Please try again.');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVaultUnlockSuccess = async (password: string, salt: string, hash: string) => {
        // Set authentication state (with cached token/user)
        const { token, user } = useAuthStore.getState();
        setAuthenticated(true, hash, token || undefined, user || undefined);

        // Store in chrome.storage for background sync service
        if (userId && token) {
            await chrome.storage.local.set({
                zerovault_user_id: userId,
                zerovault_token: token
            });
        }

        // Update background script
        await chrome.storage.local.set({
            zerovault_master_salt: salt,
            zerovault_master_password_hash: hash,
            zerovault_initialized: true
        });

        sendToBackground(MessageType.SET_SESSION_KEY, { key: hash });

        // Load credentials
        try {
            const { loadCredentials } = await import('../../services/storage');
            const creds = await loadCredentials(hash);
            setCredentials(creds);

            // Trigger sync with backend to get latest entries
            syncVault();
        } catch (loadError) {
            console.error('Failed to load credentials:', loadError);
            // Even if local load fails, we can try to sync
            syncVault();
        }

        setVaultLocked(false);
        navigate('/vault');
    };

    return (
        <div className="p-6 space-y-8 flex flex-col justify-center min-h-[500px]">
            {step === 'account' && (
                <>
                    <div className="flex gap-2 mb-6">
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-muted" />
                    </div>

                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Mail className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Step 1: Sign In</h1>
                        <p className="text-sm text-muted-foreground">Enter your account credentials</p>
                    </div>

                    <Card className="p-6 space-y-4 shadow-lg border-primary/20">
                        <form onSubmit={handleAccountLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="account-password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="account-password"
                                        type={showAccountPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={accountPassword}
                                        onChange={(e) => setAccountPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowAccountPassword(!showAccountPassword)}
                                    >
                                        {showAccountPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && (
                                <div className="flex items-center space-x-2 text-destructive bg-destructive/5 p-2 rounded text-xs font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                {isLoading ? 'Signing In...' : 'Continue'}
                            </Button>
                        </form>
                        <div className="pt-2 text-center">
                            <p className="text-xs text-muted-foreground">
                                Don't have an account?{' '}
                                <button onClick={() => navigate('/register')} className="text-primary hover:underline">Create one</button>
                            </p>
                        </div>
                    </Card>
                </>
            )}

            {step === 'mfa' && (
                <>
                    <div className="flex gap-2 mb-6">
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-muted" />
                    </div>

                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Lock className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Step 2: Verify Identity</h1>
                        <p className="text-sm text-muted-foreground">Enter the code sent to your email</p>
                    </div>

                    <Card className="p-6 space-y-4 shadow-lg border-primary/20">
                        <form onSubmit={handleMfaVerify} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="otp">Verification Code</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    placeholder="Enter 6-digit code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    autoFocus
                                    required
                                    maxLength={6}
                                />
                            </div>
                            {error && (
                                <div className="flex items-center space-x-2 text-destructive bg-destructive/5 p-2 rounded text-xs font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                {isLoading ? 'Verifying...' : 'Verify'}
                            </Button>
                        </form>
                        <div className="pt-2 text-center">
                            <button
                                onClick={handleResendMfa}
                                disabled={isLoading}
                                className="text-xs text-primary hover:underline"
                            >
                                Didn't get a code? Resend
                            </button>
                            <br />
                            <button
                                onClick={() => { setStep('account'); setOtp(''); setError(''); }}
                                className="text-xs text-muted-foreground hover:underline mt-2"
                            >
                                Use a different account
                            </button>
                        </div>
                    </Card>
                </>
            )}

            {step === 'vault' && (
                <>
                    <div className="flex gap-2 mb-6">
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                    </div>

                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Lock className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Step 3: Unlock Vault</h1>
                        <p className="text-sm text-muted-foreground">
                            {(!masterPasswordHash || !vaultSalt)
                                ? 'Initialize your vault on this device'
                                : 'Enter your master password to continue'
                            }
                        </p>
                    </div>

                    <Card className="p-6 space-y-4 shadow-lg border-primary/20">
                        <form onSubmit={handleVaultUnlock} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="vault-password">Master Password</Label>
                                <div className="relative">
                                    <Input
                                        id="vault-password"
                                        type={showVaultPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={vaultPassword}
                                        onChange={(e) => setVaultPassword(e.target.value)}
                                        autoFocus
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowVaultPassword(!showVaultPassword)}
                                    >
                                        {showVaultPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            {error && (
                                <div className="flex items-center space-x-2 text-destructive bg-destructive/5 p-2 rounded text-xs font-medium">
                                    <AlertCircle className="w-4 h-4" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                {isLoading ? 'Processing...' : (!masterPasswordHash || !vaultSalt) ? 'Initialize & Unlock' : 'Unlock Vault'}
                            </Button>
                        </form>
                        <div className="pt-2 text-center space-y-2">
                            <button onClick={() => { setStep('account'); setError(''); }} className="text-xs text-muted-foreground hover:underline">Sign out</button>
                            <br />
                            <button onClick={() => navigate('/reset')} className="text-xs text-muted-foreground hover:underline">Forgot your master password?</button>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default Login;
