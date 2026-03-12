import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, Mail, Info } from 'lucide-react';
import { Button, Input, Card, Label } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { apiService } from '../../services/api.service';
import { generateSalt, deriveMasterKey } from '../../utils/crypto';
import { cn } from '../../utils/cn';

/**
 * Register Component
 * 
 * Clean two-step process:
 * 1. Account Setup: Email + password with Supabase
 * 2. Master Password: Local vault encryption setup
 */
const Register = () => {
    const navigate = useNavigate();
    const setRegistered = useAuthStore((state) => state.setRegistered);

    // Form states
    const [email, setEmail] = useState('');
    const [accountPassword, setAccountPassword] = useState('');
    const [confirmAccountPassword, setConfirmAccountPassword] = useState('');
    const [masterPassword, setMasterPassword] = useState('');
    const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
    const [showAccountPassword, setShowAccountPassword] = useState(false);
    const [showMasterPassword, setShowMasterPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<'account' | 'mfa' | 'master'>('account');
    const [userId, setUserId] = useState<string | null>(null);
    const [otp, setOtp] = useState('');

    // Handle account setup
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
            // Call App Server for registration
            const result = await apiService.register({ email, password: accountPassword });

            if (result.requiresMFA) {
                setUserId(result.userId);
                setStep('mfa');
            } else {
                throw new Error('Registration failed. Please try again.');
            }
        } catch (err: any) {
            setError(err.message || 'Registration failed. Please try again.');
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

            if (result.token) {
                // Store token temporarily or set in store
                // For registration, we move to master password step next
                setStep('master');
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

    // Handle master password setup
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
            const salt = generateSalt();
            const hash = await deriveMasterKey(masterPassword, salt);
            setRegistered(true, hash, salt);

            await chrome.storage.local.set({
                zerovault_master_salt: salt,
                zerovault_master_password_hash: hash,
                zerovault_initialized: true
            });

            navigate('/login');
        } catch (err) {
            console.error('Registration error:', err);
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
                    onClick={() => {
                        if (step === 'master') setStep('account');
                        else navigate(-1);
                    }}
                    className="p-0 h-8 w-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-bold">
                    {step === 'account' ? 'Step 1: Create Account' : 'Step 2: Setup Master Password'}
                </h1>
            </div>

            <div className="flex gap-2 mb-2">
                <div className={cn("h-1.5 flex-1 rounded-full", "bg-primary")} />
                <div className={cn("h-1.5 flex-1 rounded-full", step === 'mfa' || step === 'master' ? "bg-primary" : "bg-muted")} />
                <div className={cn("h-1.5 flex-1 rounded-full", step === 'master' ? "bg-primary" : "bg-muted")} />
            </div>

            {step === 'account' && (
                <Card className="p-4 space-y-4">
                    <div className="flex items-start space-x-3 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
                        <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p>Create a secure account to enable cloud sync across your devices.</p>
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
                                    type={showAccountPassword ? 'text' : 'password'}
                                    placeholder="Enter a strong password"
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
            )}

            {step === 'mfa' && (
                <Card className="p-4 space-y-4">
                    <div className="flex items-start space-x-3 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
                        <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p>We've sent a verification code to your email. Please enter it to verify your account.</p>
                    </div>

                    <form onSubmit={handleMfaVerify} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp">Verification Code</Label>
                            <Input
                                id="otp"
                                type="text"
                                placeholder="6-digit code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                maxLength={6}
                                autoFocus
                            />
                        </div>

                        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Verifying...' : 'Verify'}
                        </Button>
                    </form>
                    <div className="text-center">
                        <button
                            onClick={handleResendMfa}
                            disabled={isLoading}
                            className="text-xs text-primary hover:underline"
                        >
                            Didn't get a code? Resend
                        </button>
                    </div>
                </Card>
            )}

            {step === 'master' && (
                <Card className="p-4 space-y-4">
                    <div className="flex items-start space-x-3 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
                        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p>Your master password is the only key to your vault encryption. If you lose it, your data cannot be recovered.</p>
                    </div>

                    <form onSubmit={handleMasterPasswordSetup} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="master-password">Master Password</Label>
                            <div className="relative">
                                <Input
                                    id="master-password"
                                    type={showMasterPassword ? 'text' : 'password'}
                                    placeholder="Enter a strong password"
                                    value={masterPassword}
                                    onChange={(e) => setMasterPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                                >
                                    {showMasterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
