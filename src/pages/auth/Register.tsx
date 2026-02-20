import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Info, Mail } from 'lucide-react';
import { Button, Input, Label, Card, cn } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { deriveMasterKey, generateSalt } from '../../utils/crypto';
import { authService } from '../../services/supabase';

const Register = () => {
    const navigate = useNavigate();
    const setRegistered = useAuthStore((state) => state.setRegistered);

    // Email/Account fields
    const [email, setEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [confirmAccountPassword, setConfirmAccountPassword] = useState('');

    // Master password fields
    const [masterPassword, setMasterPassword] = useState('');
    const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'account' | 'master'>('account');

    const handleAccountSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email || !accountPassword) {
            setError('Email and password are required.');
            return;
        }

        if (accountPassword.length < 8) {
            setError('Account password must be at least 8 characters.');
            return;
        }

        if (accountPassword !== confirmAccountPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            // Register with Supabase
            const result = await authService.signUp(email, accountPassword);
            if (!result.success) {
                throw new Error((result.error as any)?.message || 'Registration failed');
            }

            // Move to master password setup
            setStep('master');
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMasterPasswordSetup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (masterPassword.length < 8) {
            setError('Master password must be at least 8 characters.');
            return;
        }

        if (masterPassword !== confirmMasterPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            // Derive the master key
            const salt = generateSalt();
            const hash = await deriveMasterKey(masterPassword, salt);

            // Store locally
            setRegistered(true, hash, salt);

            // Store hash and salt on Supabase
            // Note: This will be created in the user_metadata table when needed
            // The actual storage happens on first sync

            navigate('/login');
        } catch (err) {
            setError('An error occurred during setup.');
        } finally {
            setIsLoading(false);
        }
    };

    const getPasswordStrength = (pwd: string) => {
        if (!pwd) return 0;
        let score = 0;
        if (pwd.length > 8) score++;
        if (/[A-Z]/.test(pwd)) score++;
        if (/[0-9]/.test(pwd)) score++;
        if (/[^A-Za-z0-9]/.test(pwd)) score++;
        return score;
    };

    const masterStrength = getPasswordStrength(masterPassword);
    const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['bg-destructive', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center space-x-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => step === 'master' ? setStep('account') : navigate(-1)}
                    className="p-0 h-8 w-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-bold">
                    {step === 'account' ? 'Create Account' : 'Setup Master Password'}
                </h1>
            </div>

            {step === 'account' ? (
                <Card className="p-4 space-y-4">
                    <div className="flex items-start space-x-3 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
                        <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p>
                            Create a secure account to enable cloud sync across your devices.
                        </p>
                    </div>

                    <form onSubmit={handleAccountSetup} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="account-password">Account Password</Label>
                            <div className="relative">
                                <Input
                                    id="account-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter a strong password"
                                    value={accountPassword}
                                    onChange={(e) => setAccountPassword(e.target.value)}
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

                        <div className="space-y-2">
                            <Label htmlFor="confirm-account-password">Confirm Password</Label>
                            <Input
                                id="confirm-account-password"
                                type="password"
                                placeholder="Confirm your password"
                                value={confirmAccountPassword}
                                onChange={(e) => setConfirmAccountPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Creating Account...' : 'Continue'}
                        </Button>
                    </form>
                </Card>
            ) : (
                <Card className="p-4 space-y-4">
                    <div className="flex items-start space-x-3 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
                        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p>
                            Your master password is the only key to your vault encryption. If you lose it, your data cannot be recovered.
                        </p>
                    </div>

                    <form onSubmit={handleMasterPasswordSetup} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="master-password">Master Password</Label>
                            <div className="relative">
                                <Input
                                    id="master-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter a strong password"
                                    value={masterPassword}
                                    onChange={(e) => setMasterPassword(e.target.value)}
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

                            {masterPassword && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
                                        <span>Strength: {strengthLabels[masterStrength - 1]}</span>
                                    </div>
                                    <div className="h-1 w-full bg-secondary rounded-full overflow-hidden flex">
                                        {[...Array(4)].map((_, i) => (
                                            <div
                                                key={i}
                                                className={cn(
                                                    'h-full flex-1 transition-all duration-300 mr-0.5 last:mr-0',
                                                    i < masterStrength ? strengthColors[masterStrength - 1] : 'transparent'
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-master-password">Confirm Master Password</Label>
                            <Input
                                id="confirm-master-password"
                                type="password"
                                placeholder="Confirm your master password"
                                value={confirmMasterPassword}
                                onChange={(e) => setConfirmMasterPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Setting up...' : 'Initialize Vault'}
                        </Button>
                    </form>
                </Card>
            )}
        </div>
    );
};

export default Register;
