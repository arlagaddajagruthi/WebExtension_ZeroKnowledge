import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Zap, RefreshCw, LogIn, UserPlus } from 'lucide-react';
import { Button } from '../../components/ui';

const Welcome = () => {
    const navigate = useNavigate();
    const [showOptions, setShowOptions] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center space-y-8 text-center p-6 min-h-[500px]">
            <div className="space-y-2">
                <div className="flex justify-center">
                    <div className="bg-primary/10 p-4 rounded-full">
                        <Shield className="w-12 h-12 text-primary" />
                    </div>
                </div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome to ZeroVault</h1>
                <p className="text-muted-foreground max-w-sm mx-auto">
                    The secure, zero-knowledge password manager for your browser.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <FeatureCard
                    icon={<Lock className="w-5 h-5 text-primary" />}
                    title="Encrypted"
                    desc="Zero-knowledge security"
                />
                <FeatureCard
                    icon={<Zap className="w-5 h-5 text-primary" />}
                    title="Fast"
                    desc="Quick access & autofill"
                />
                <FeatureCard
                    icon={<RefreshCw className="w-5 h-5 text-primary" />}
                    title="Synced"
                    desc="Access anywhere"
                />
                <FeatureCard
                    icon={<Shield className="w-5 h-5 text-primary" />}
                    title="Secure"
                    desc="AES-256 protected"
                />
            </div>

            <div className="space-y-4 w-full max-w-xs transition-all duration-300">
                {!showOptions ? (
                    <Button onClick={() => setShowOptions(true)} className="w-full text-lg h-12 shadow-lg hover:shadow-xl transition-all">
                        Get Started
                    </Button>
                ) : (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                        <Button
                            onClick={() => navigate('/login?force=true')}
                            className="w-full text-lg h-12 flex items-center justify-center gap-2"
                            variant="outline"
                        >
                            <LogIn className="w-5 h-5" />
                            Login
                        </Button>
                        <Button
                            onClick={() => navigate('/register')}
                            className="w-full text-lg h-12 flex items-center justify-center gap-2 shadow-lg"
                        >
                            <UserPlus className="w-5 h-5" />
                            Sign Up
                        </Button>
                        <button
                            onClick={() => setShowOptions(false)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 underline underline-offset-4"
                        >
                            Go Back
                        </button>
                    </div>
                )}
                <p className="text-sm text-muted-foreground mt-4">
                    Your data is encrypted locally and never shared.
                </p>
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
    <div className="bg-card border rounded-xl p-4 text-left space-y-2">
        {icon}
        <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
        </div>
    </div>
);

export default Welcome;
