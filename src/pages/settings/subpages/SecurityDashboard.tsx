import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useVaultStore } from '../../../store/vaultStore';

const SecurityDashboard = () => {
    const navigate = useNavigate();
    const { credentials } = useVaultStore();

    // Simple analysis
    const total = credentials.length;
    const reused = credentials.length - new Set(credentials.map(c => c.password)).size;
    const weak = credentials.filter(c => c.password.length < 8).length;

    let score = 100;
    if (total === 0) score = 0;
    else {
        score -= (reused * 10);
        score -= (weak * 15);
    }
    score = Math.max(0, Math.min(100, score));

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Security Dashboard</h1>
            </div>

            <div className="p-4 space-y-6">
                <div className="text-center space-y-2 py-4">
                    <div className="relative inline-flex">
                        <div className="w-24 h-24 rounded-full border-4 border-muted flex items-center justify-center">
                            <span className="text-3xl font-bold">{Math.round(score)}</span>
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-background p-1 rounded-full">
                            {score > 80 ? (
                                <ShieldCheck className="w-8 h-8 text-green-500" />
                            ) : score > 50 ? (
                                <ShieldAlert className="w-8 h-8 text-yellow-500" />
                            ) : (
                                <ShieldAlert className="w-8 h-8 text-destructive" />
                            )}
                        </div>
                    </div>
                    <h2 className="text-lg font-bold">Security Scoree</h2>
                    <p className="text-sm text-muted-foreground">
                        {score > 80 ? 'Your vault is secure.' : 'Action needed to improve security.'}
                    </p>
                </div>

                <div className="space-y-4">
                    <Card className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-destructive/10 p-2 rounded-full">
                                <AlertTriangle className="w-4 h-4 text-destructive" />
                            </div>
                            <div>
                                <div className="font-medium">Weak Passwords</div>
                                <div className="text-xs text-muted-foreground">{weak} detected</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/generator')}>Generate</Button>
                    </Card>

                    <Card className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-yellow-500/10 p-2 rounded-full">
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            </div>
                            <div>
                                <div className="font-medium">Reused Passwords</div>
                                <div className="text-xs text-muted-foreground">{reused} detected</div>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => navigate('/vault')}>Review</Button>
                    </Card>

                    <Card className="p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="bg-green-500/10 p-2 rounded-full">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                            </div>
                            <div>
                                <div className="font-medium">Total Passwords</div>
                                <div className="text-xs text-muted-foreground">{total} stored</div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default SecurityDashboard;
