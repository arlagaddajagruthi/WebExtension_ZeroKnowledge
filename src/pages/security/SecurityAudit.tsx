import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Lock, Loader } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { Card, Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import {
    checkCredentialsBreach,
    getBreachSummary,
    findWeakPasswords,
    findReusedPasswords,
    analyzePasswordStrength,
    getCachedBreachResults,
    cacheBreachResults,
    type CredentialBreachStatus,
} from '../../services/breach-monitoring';

const SecurityAudit = () => {
    const { credentials } = useVaultStore();
    const navigate = useNavigate();

    const [breachStatuses, setBreachStatuses] = useState<CredentialBreachStatus[]>([]);
    const [isChecking, setIsChecking] = useState(false);
    const [lastChecked, setLastChecked] = useState<number | null>(null);

    // Analysis
    const weakPasswords = findWeakPasswords(credentials);
    const reusedMap = findReusedPasswords(credentials);
    const reusedPasswords = Array.from(reusedMap.values()).flat();
    const compromisedCount = breachStatuses.filter(c => c.breachStatus?.isCompromised).length;

    const totalIssues = weakPasswords.length + reusedPasswords.length + compromisedCount;

    useEffect(() => {
        // Load cached results
        const cached = getCachedBreachResults();
        if (Object.keys(cached).length > 0) {
            const statuses = credentials.map(c => ({
                ...c,
                breachStatus: cached[c.id],
            }));
            setBreachStatuses(statuses);
            setLastChecked(Date.now());
        }
    }, [credentials]);

    const handleCheckBreaches = async () => {
        setIsChecking(true);
        try {
            const results = await checkCredentialsBreach(credentials);
            setBreachStatuses(results);
            cacheBreachResults(results);
            setLastChecked(Date.now());
        } catch (error) {
            console.error('Breach check failed:', error);
        } finally {
            setIsChecking(false);
        }
    };

    const getStrengthColor = (score: number) => {
        if (score === 0) return 'text-emerald-500';
        if (score < 3) return 'text-yellow-500';
        return 'text-destructive';
    };

    const formatLastChecked = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <Shield className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Security Audit</h1>
            </div>

            <div className="p-4 space-y-6 overflow-y-auto">
                {/* Score Card */}
                <Card className="p-6 text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                        <Shield className={`w-8 h-8 ${getStrengthColor(totalIssues)}`} />
                    </div>
                    <h2 className="text-2xl font-bold">{totalIssues === 0 ? 'Excellent' : 'Needs Attention'}</h2>
                    <p className="text-muted-foreground text-sm">
                        Found {totalIssues} potential security issues in your vault.
                    </p>
                </Card>

                {/* Breach Monitoring */}
                <Card className="p-4 space-y-3 border-blue-500/30 bg-blue-500/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-blue-600" />
                            <div>
                                <p className="font-semibold text-sm">Data Breach Monitoring</p>
                                <p className="text-xs text-muted-foreground">
                                    Check if your passwords appear in known data breaches
                                </p>
                            </div>
                        </div>
                    </div>
                    {lastChecked && (
                        <p className="text-xs text-muted-foreground">
                            Last checked: {formatLastChecked(lastChecked)}
                        </p>
                    )}
                    <Button
                        onClick={handleCheckBreaches}
                        disabled={isChecking}
                        variant="outline"
                        className="w-full text-xs"
                    >
                        {isChecking ? (
                            <>
                                <Loader className="w-3 h-3 mr-2 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            'Check for Breaches'
                        )}
                    </Button>
                </Card>

                {/* Compromised Passwords */}
                {compromisedCount > 0 && (
                    <Card className="p-4 border-destructive/30 bg-destructive/5">
                        <p className="text-sm font-semibold text-destructive">
                            ⚠️ {compromisedCount} password(s) found in data breaches
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            These passwords should be changed immediately
                        </p>
                    </Card>
                )}

                {/* Issues List */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Analysis</h3>

                    <div className="space-y-3">
                        {compromisedCount > 0 && (
                            <AuditItem
                                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                                title="Compromised Passwords"
                                count={compromisedCount}
                                description="Exposed in known data breaches."
                                severity="critical"
                            />
                        )}
                        <AuditItem
                            icon={<AlertTriangle className="w-5 h-5 text-yellow-500" />}
                            title="Weak Passwords"
                            count={weakPasswords.length}
                            description="Passwords shorter than 8 characters."
                            severity="warning"
                        />
                        <AuditItem
                            icon={<XCircle className="w-5 h-5 text-orange-500" />}
                            title="Reused Passwords"
                            count={reusedPasswords.length}
                            description="Passwords used across multiple accounts."
                            severity="warning"
                        />
                        <AuditItem
                            icon={<CheckCircle className="w-5 h-5 text-emerald-500" />}
                            title="Strong Passwords"
                            count={credentials.length - weakPasswords.length - compromisedCount}
                            description="Passwords that meet security standards."
                            severity="good"
                        />
                    </div>
                </div>

                {totalIssues > 0 && (
                    <Button className="w-full" onClick={() => navigate('/generator')}>
                        Generate Better Passwords
                    </Button>
                )}
            </div>
        </div>
    );
};

const AuditItem = ({ icon, title, count, description, onClick, severity }: any) => {
    const bgColor = severity === 'critical' ? 'bg-destructive/5' : severity === 'warning' ? 'bg-yellow-500/5' : 'bg-emerald-500/5';
    const borderColor = severity === 'critical' ? 'border-destructive/30' : severity === 'warning' ? 'border-yellow-500/30' : 'border-emerald-500/30';

    return (
        <Card className={`p-4 flex items-center justify-between ${bgColor} ${borderColor} hover:shadow-md transition-all cursor-pointer`} onClick={onClick}>
            <div className="flex items-center space-x-4">
                <div className="p-2 bg-background rounded-full shadow-sm">
                    {icon}
                </div>
                <div>
                    <h4 className="font-medium text-sm">{title}</h4>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="font-bold text-lg">{count}</div>
        </Card>
    );
};

export default SecurityAudit;
