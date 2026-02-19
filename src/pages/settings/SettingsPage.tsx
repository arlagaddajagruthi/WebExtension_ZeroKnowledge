import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Moon, Monitor, Trash2, Database, Info, ChevronRight, Fingerprint } from 'lucide-react';
import { Button, Card, cn } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';

const SettingsPage = () => {
    const navigate = useNavigate();
    const logout = useAuthStore((state) => state.logout);

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/vault')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Settings</h1>
            </div>

            <div className="p-4 space-y-6">
                <div className="space-y-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Account & Security</h2>
                    <Card className="divide-y overflow-hidden">
                        <SettingsItem icon={<Shield className="w-4 h-4" />} label="Security Dashboard" onClick={() => navigate('/settings/security')} />
                        <SettingsItem icon={<Shield className="w-4 h-4" />} label="Password Audit" onClick={() => navigate('/security-audit')} />
                        <SettingsItem icon={<Fingerprint className="w-4 h-4" />} label="Biometric Authentication" onClick={() => navigate('/settings/biometric')} />
                        <SettingsItem icon={<Database className="w-4 h-4" />} label="Sync & Data" onClick={() => navigate('/settings/sync')} />
                        <SettingsItem icon={<Lock className="w-4 h-4" />} label="Change Master Password" onClick={() => navigate('/settings/password')} />
                    </Card>
                </div>

                <div className="space-y-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Preferences</h2>
                    <Card className="divide-y overflow-hidden">
                        <SettingsItem icon={<Moon className="w-4 h-4" />} label="Appearance" onClick={() => navigate('/settings/appearance')} />
                        <SettingsItem icon={<Monitor className="w-4 h-4" />} label="Auto-lock Timer" value="15 min" onClick={() => navigate('/settings/autolock')} />
                        <SettingsItem icon={<Database className="w-4 h-4" />} label="Import Vault" onClick={() => navigate('/settings/import')} />
                        <SettingsItem icon={<Database className="w-4 h-4" />} label="Export Vault" onClick={() => navigate('/settings/export')} />
                    </Card>
                </div>

                <div className="space-y-2">
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1">Danger Zone</h2>
                    <Card className="divide-y overflow-hidden border-destructive/20">
                        <SettingsItem
                            icon={<Trash2 className="w-4 h-4 text-destructive" />}
                            label="Reset Vault"
                            className="text-destructive"
                            onClick={() => navigate('/reset')}
                        />
                    </Card>
                </div>

                <div className="pt-4 text-center space-y-4">
                    <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                        ZeroVault v1.0.0 • <Info className="w-3 h-3" /> Help Center
                    </p>
                    <Button variant="outline" className="w-full" onClick={logout}>
                        Log Out
                    </Button>
                </div>
            </div>
        </div>
    );
};

const SettingsItem = ({
    icon,
    label,
    value,
    onClick,
    className
}: {
    icon: React.ReactNode,
    label: string,
    value?: string,
    onClick: () => void,
    className?: string
}) => (
    <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors text-left"
    >
        <div className="flex items-center space-x-3">
            <div className="text-primary">{icon}</div>
            <span className={cn("text-sm font-medium", className)}>{label}</span>
        </div>
        <div className="flex items-center space-x-2">
            {value && <span className="text-xs text-muted-foreground">{value}</span>}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
    </button>
);


export default SettingsPage;
