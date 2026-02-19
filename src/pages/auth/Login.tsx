import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import { Button, Input, Label, Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { deriveMasterKey } from '../../utils/crypto';
import { sendToBackground, MessageType } from '../../utils/messaging';
import { authService, syncService } from '../../services/supabase';
import { supabase } from '../../services/supabase';

/**
 * Login Component
 *
 * Two-step login process:
 * 1. Account Login: Email + password authentication with Supabase
 * 2. Vault Unlock: Master password to decrypt local vault
 */
const Login = () => {
    const navigate = useNavigate();
    const { isRegistered, masterPasswordHash, vaultSalt, setAuthenticated, setRegistered } = useAuthStore();
    const { setLocked: setVaultLocked, setCredentials } = useVaultStore();

    // Account login fields
    const [email, setEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [showAccountPassword, setShowAccountPassword] = useState(false);

    // Vault unlock fields
    const [vaultPassword, setVaultPassword] = useState('');
    const [showVaultPassword, setShowVaultPassword] = useState(false);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'account' | 'vault'>('account');
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Check if there's an existing session
        const checkSession = async () => {
            const result = await authService.getSession();
            if (result.success && result.session?.user) {
                setUserId(result.session.user.id);
                setStep('vault');

                // Load master password hash from Supabase
                if (isRegistered && masterPasswordHash && vaultSalt) {
                    setStep('vault');
                }
            } else if (!isRegistered) {
                navigate('/welcome');
            }
        };
        checkSession();
    }, [isRegistered, navigate, masterPasswordHash, vaultSalt]);

    const handleAccountLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (!email || !accountPassword) {
                setError('Email and password are required.');
                setIsLoading(false);
                return;
            }

            // Sign in with Supabase
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

    const handleVaultUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (!masterPasswordHash || !vaultSalt) {
                // First time login - derive and store
                const hash = await deriveMasterKey(vaultPassword, vaultSalt || '');

                if (vaultSalt && hash === masterPasswordHash) {
                    setAuthenticated(true, hash);
                    sendToBackground(MessageType.SET_SESSION_KEY, { key: hash });

                    import('../../services/storage').then(async ({ loadCredentials }) => {
                        const creds = await loadCredentials(hash);
                        setCredentials(creds);
                    });

                    setVaultLocked(false);
                    navigate('/vault');
                } else {
                    setError('Incorrect master password. Please try again.');
                }
            } else {
                // Existing vault unlock
                const hash = await deriveMasterKey(vaultPassword, vaultSalt);
                if (hash === masterPasswordHash) {
                    setAuthenticated(true, hash);
                    sendToBackground(MessageType.SET_SESSION_KEY, { key: hash });

                    // Load credentials from Supabase if available
                    if (userId) {
                        const credResult = await syncService.getCredentials(userId);
                        if (credResult.success && credResult.credentials) {
                            // TODO: Decrypt credentials from Supabase and merge with local
                            console.log('Loaded credentials from Supabase:', credResult.credentials.length);
                        }
                    }

                    // Also load from local storage
                    import('../../services/storage').then(async ({ loadCredentials }) => {
                        const creds = await loadCredentials(hash);
                        setCredentials(creds);
                    });

                    setVaultLocked(false);
                    navigate('/vault');
                } else {
                    setError('Incorrect master password. Please try again.');
                }
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
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Mail className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Sign In</h1>
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
                                {isLoading ? 'Signing In...' : 'Sign In'}
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
                    <div className="text-center space-y-2">
                        <div className="flex justify-center mb-4">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <Lock className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold">Unlock Vault</h1>
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
