import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button, Input, Label, Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';
import { deriveMasterKey } from '../../utils/crypto';
import { sendToBackground, MessageType } from '../../utils/messaging';

/**
 * Login Component
 * 
 * Handles the Master Password Unlock feature for the application.
 * This component is the entry point for accessing the encrypted vault.
 * 
 * Key Responsibilities:
 * 1. Accepts the user's Master Password.
 * 2. Derives the encryption key using PBKDF2 (via `deriveMasterKey`).
 * 3. Validates the derived key against the stored hash.
 * 4. On success, decrypts the vault and loads credentials into the state.
 */
const Login = () => {
    const navigate = useNavigate();
    const { isRegistered, masterPasswordHash, vaultSalt, setAuthenticated } = useAuthStore();
    const { setLocked: setVaultLocked, setCredentials } = useVaultStore();

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isRegistered) {
            navigate('/welcome');
        }
    }, [isRegistered, navigate]);

    /**
     * Handles the vault unlock process.
     * 
     * @param e - The form submission event.
     * 
     * Workflow:
     * 1. Prevents default form submission.
     * 2. Derives the Master Key from the input password and stored salt.
     * 3. Compares the derived hash with the stored `masterPasswordHash`.
     * 4. If valid:
     *    - Updates global auth state (`setAuthenticated`).
     *    - Sends the session key to the background script for auto-fill operations.
     *    - Asynchronously loads and decrypts user credentials.
     *    - Unlocks the UI and redirects to the Vault Dashboard.
     * 5. If invalid: Displays an error message.
     */
    const handleUnlock = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const hash = await deriveMasterKey(password, vaultSalt!);
            if (hash === masterPasswordHash) {
                // Set authenticated AND pass the key
                setAuthenticated(true, hash);

                // Send key to background script for autofill
                sendToBackground(MessageType.SET_SESSION_KEY, { key: hash });

                // Load credentials
                import('../../services/storage').then(async ({ loadCredentials }) => {
                    const creds = await loadCredentials(hash);
                    setCredentials(creds);
                });

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
                <form onSubmit={handleUnlock} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Master Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

                <div className="pt-2 text-center">
                    <button
                        onClick={() => navigate('/reset')}
                        className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
                    >
                        Forgot your master password?
                    </button>
                </div>
            </Card>
        </div>
    );
};

export default Login;
