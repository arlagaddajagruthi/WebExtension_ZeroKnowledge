import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Copy, RefreshCw, Shield, Check, ArrowRight } from 'lucide-react';
import { Button, Label, Card, cn } from '../../components/ui';
import { generateRandomPassword } from '../../utils/crypto';

const PasswordGenerator = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [length, setLength] = useState(16);
    const [options, setOptions] = useState({
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
    });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        handleGenerate();
    }, [length, options]);

    const handleGenerate = () => {
        const newPwd = generateRandomPassword(length, options);
        setPassword(newPwd);
        setCopied(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getStrength = () => {
        if (length < 10) return { label: 'Weak', color: 'bg-destructive' };
        if (length < 14) return { label: 'Good', color: 'bg-yellow-500' };
        return { label: 'Strong', color: 'bg-emerald-500' };
    };

    const strength = getStrength();

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Password Generator</h1>
            </div>

            <div className="p-6 space-y-8">
                <div className="space-y-4">
                    <div className="relative group">
                        <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted group-hover:border-primary/50 transition-colors break-all text-center min-h-[80px] flex items-center justify-center">
                            <span className="text-xl font-mono font-bold tracking-wider">{password}</span>
                        </div>
                        <div className="flex justify-center mt-4 space-x-2">
                            <Button size="sm" variant="outline" onClick={handleGenerate}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                            </Button>
                            <Button size="sm" onClick={handleCopy}>
                                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                        <div className="flex justify-center mt-3">
                            <Button className="w-full max-w-xs" onClick={() => navigate('/add-credential', { state: { password } })}>
                                Use Password <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center space-x-2">
                            <div className={cn("w-2 h-2 rounded-full", strength.color)} />
                            <span className="text-xs font-semibold">{strength.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{length} characters</span>
                    </div>
                </div>

                <Card className="p-4 space-y-6">
                    <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Length</Label>
                        <input
                            type="range"
                            min="8" max="32"
                            value={length}
                            onChange={(e) => setLength(parseInt(e.target.value))}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                            <span>8</span>
                            <span>20</span>
                            <span>32</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Options</Label>
                        <div className="grid grid-cols-2 gap-3">
                            <ToggleOption
                                label="Uppercase"
                                active={options.uppercase}
                                onClick={() => setOptions({ ...options, uppercase: !options.uppercase })}
                            />
                            <ToggleOption
                                label="Lowercase"
                                active={options.lowercase}
                                onClick={() => setOptions({ ...options, lowercase: !options.lowercase })}
                            />
                            <ToggleOption
                                label="Numbers"
                                active={options.numbers}
                                onClick={() => setOptions({ ...options, numbers: !options.numbers })}
                            />
                            <ToggleOption
                                label="Symbols"
                                active={options.symbols}
                                onClick={() => setOptions({ ...options, symbols: !options.symbols })}
                            />
                        </div>
                    </div>
                </Card>

                <div className="bg-primary/5 p-4 rounded-lg flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Strong passwords are at least 12 characters long and include a mix of uppercase, lowercase, numbers, and symbols.
                    </p>
                </div>
            </div>
        </div>
    );
};

const ToggleOption = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center justify-between p-3 rounded-md border text-xs font-medium transition-all",
            active
                ? "border-primary bg-primary/5 text-primary"
                : "border-input bg-background text-muted-foreground hover:bg-accent"
        )}
    >
        {label}
        <div className={cn(
            "w-4 h-4 rounded-full border flex items-center justify-center",
            active ? "bg-primary border-primary" : "border-input"
        )}>
            {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
        </div>
    </button>
);


export default PasswordGenerator;
