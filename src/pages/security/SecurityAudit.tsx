import React from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useVaultStore } from '../../store/vaultStore';
import { Card, Button } from '../../components/ui';
import { useNavigate } from 'react-router-dom';

const SecurityAudit = () => {
    const { credentials } = useVaultStore();
    const navigate = useNavigate();

    // Simple analysis
    const weakPasswords = credentials.filter(c => c.password.length < 8);
    const reusedPasswords = credentials.filter(c =>
        credentials.filter(other => other.password === c.password && other.id !== c.id).length > 0
    );
    const totalIssues = weakPasswords.length + reusedPasswords.length;

    const getStrengthColor = (score: number) => {
        if (score === 0) return 'text-green-500';
        if (score < 3) return 'text-yellow-500';
        return 'text-red-500';
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

                {/* Issues List */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm uppercase text-muted-foreground tracking-wider">Analysis</h3>

                    <div className="space-y-3">
                        <AuditItem
                            icon={<AlertTriangle className="w-5 h-5 text-yellow-500" />}
                            title="Weak Passwords"
                            count={weakPasswords.length}
                            description="Passwords shorter than 8 characters."
                            onClick={() => { }}
                        />
                        <AuditItem
                            icon={<XCircle className="w-5 h-5 text-red-500" />}
                            title="Reused Passwords"
                            count={reusedPasswords.length}
                            description="Passwords used across multiple accounts."
                            onClick={() => { }}
                        />
                        <AuditItem
                            icon={<CheckCircle className="w-5 h-5 text-green-500" />}
                            title="Strong Passwords"
                            count={credentials.length - weakPasswords.length}
                            description="Passwords that meet basic complexity rules."
                            onClick={() => { }}
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

const AuditItem = ({ icon, title, count, description, onClick }: any) => (
    <Card className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors cursor-pointer" onClick={onClick}>
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

export default SecurityAudit;
