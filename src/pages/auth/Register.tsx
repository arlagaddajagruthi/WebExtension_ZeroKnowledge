import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Info } from 'lucide-react';
import { Button, Input, Label, Card, cn } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { deriveMasterKey, generateSalt } from '../../utils/crypto';

const Register = () => {
    const navigate = useNavigate();
    const setRegistered = useAuthStore((state) => state.setRegistered);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsLoading(true);
        try {
            const salt = generateSalt();
            const hash = await deriveMasterKey(password, salt);
            setRegistered(true, hash, salt);
            navigate('/login');
        } catch (err) {
            setError('An error occurred during registration.');
        } finally {
            setIsLoading(false);
        }
    };

    const getPasswordStrength = () => {
        if (!password) return 0;
        let score = 0;
        if (password.length > 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;
        return score;
    };

    const strength = getPasswordStrength();
    const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
    const strengthColors = ['bg-destructive', 'bg-yellow-500', 'bg-blue-500', 'bg-emerald-500'];

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="p-0 h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-bold">Create Your Vault</h1>
            </div>

            <Card className="p-4 space-y-4">
                <div className="flex items-start space-x-3 text-sm text-muted-foreground bg-primary/5 p-3 rounded-md">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p>
                        Your master password is the only key to your vault. If you lose it, your data cannot be recovered.
                    </p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="master-password">Master Password</Label>
                        <div className="relative">
                            <Input
                                id="master-password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter a strong password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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

                        {password && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-medium uppercase tracking-wider">
                                    <span>Strength: {strengthLabels[strength - 1]}</span>
                                </div>
                                <div className="h-1 w-full bg-secondary rounded-full overflow-hidden flex">
                                    {[...Array(4)].map((_, i) => (
                                        <div
                                            key={i}
                                            className={cn(
                                                'h-full flex-1 transition-all duration-300 mr-0.5 last:mr-0',
                                                i < strength ? strengthColors[strength - 1] : 'transparent'
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirm-password">Confirm Password</Label>
                        <Input
                            id="confirm-password"
                            type="password"
                            placeholder="Confirm your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Creating Vault...' : 'Initialize Vault'}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default Register;
