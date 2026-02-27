import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import { Button, Input, Label, Card, cn } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { deriveMasterKey } from '../../utils/crypto';
import { sendToBackground, MessageType } from '../../utils/messaging';
import { authService, syncService } from '../../services/supabase';

/**
 * Simplified Login Component
 * 
 * Clean two-step process:
 * 1. Account Login: Email + password with Supabase
 * 2. Vault Unlock: Master password for local vault
 */
const Login = () => {
    const navigate = useNavigate();
    const { isRegistered, masterPasswordHash, vaultSalt, setAuthenticated } = useAuthStore();
    const { setLocked: setVaultLocked, setCredentials } = useVaultStore();

    // Form states
    const [email, setEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [vaultPassword, setVaultPassword] = useState('');
    const [showAccountPassword, setShowAccountPassword] = useState(false);
    const [showVaultPassword, setShowVaultPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'account' | 'vault'>('account');
    const [userId, setUserId] = useState<string | null>(null);

    // Check for existing session on mount
    useEffect(() => {
        const checkSession = async () => {
            try {
                const result = await authService.getSession();
                if (result.success && result.session?.user) {
                    setUserId(result.session.user.id);
                    setStep('vault');
                }
            } catch (error) {
                console.error('Session check failed:', error);
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

            const result = await authService.signIn(email, accountPassword);
            if (!result.success) {
                throw new Error((result.error as any)?.message || 'Login failed');
            }

            const user = result.data?.user;
            if (user) {
                setUserId(user.id);
                setStep('vault');
            }
        } catch (err: any) {
            setError(err.message || 'Login failed. Please try again.');
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
            if (!masterPasswordHash || !vaultSalt) {
                setError('Vault not initialized. Please register first.');
                return;
            }

            const hash = await deriveMasterKey(vaultPassword, vaultSalt);
            
            if (hash === masterPasswordHash) {
                // Set authentication state
                setAuthenticated(true, hash);

                // Update background script
                await chrome.storage.local.set({
                    zerovault_master_salt: vaultSalt,
                    zerovault_master_password_hash: hash,
                    zerovault_initialized: true
                });

                sendToBackground(MessageType.SET_SESSION_KEY, { key: hash });

                // Load credentials
                try {
                    const { loadCredentials } = await import('../../services/storage');
                    const creds = await loadCredentials(hash);
                    setCredentials(creds);
                } catch (loadError) {
                    console.error('Failed to load credentials:', loadError);
                }

                setVaultLocked(false);
                navigate('/vault');
            } else {
                setError('Incorrect master password. Please try again.');
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-8 flex flex-col justify-center min-h-[500px]">
            {step === 'account' ? (
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
                                {isLoading ? 'Signing In...' : 'Continue to Unlock'}
                            </Button>
                        </form>

                        <div className="pt-2 text-center space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Don't have an account?{' '}
                                <button
                                    onClick={() => navigate('/register')}
                                    className="text-primary hover:underline"
                                >
                                    Create one
                                </button>
                            </p>
                        </div>
                    </Card>
                </>
            ) : (
                <>
                    <div className="flex gap-2 mb-6">
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                        <div className="h-1.5 flex-1 rounded-full bg-primary" />
                    </div>

                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Lock className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Step 2: Unlock Vault</h1>
                        <p className="text-sm text-muted-foreground">Enter your master password to continue</p>
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
                                {isLoading ? 'Unlocking...' : 'Unlock Vault'}
                            </Button>
                        </form>

                        <div className="pt-2 text-center space-y-2">
                            <button
                                onClick={() => { setStep('account'); setError(''); }}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                            >
                                Sign out
                            </button>
                            <br />
                            <button
                                onClick={() => navigate('/reset')}
                                className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                            >
                                Forgot your master password?
                            </button>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};

export default Login;
