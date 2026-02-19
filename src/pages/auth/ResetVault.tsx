import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Trash2 } from 'lucide-react';
import { Button, Input, Label, Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { useVaultStore } from '../../store/vaultStore';

const ResetVault = () => {
    const navigate = useNavigate();
    const resetAuth = useAuthStore((state) => state.reset);
    const clearVault = useVaultStore((state) => state.clearVault);
    const [confirmText, setConfirmText] = useState('');
    const [error, setError] = useState('');

    const handleReset = () => {
        if (confirmText !== 'RESET') {
            setError('Please type RESET to confirm.');
            return;
        }

        clearVault();
        resetAuth();
        navigate('/welcome');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="p-0 h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-xl font-bold">Reset Vault</h1>
            </div>

            <Card className="p-6 border-destructive/50 bg-destructive/5 space-y-6">
                <div className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="bg-destructive/20 p-3 rounded-full">
                            <ShieldAlert className="w-10 h-10 text-destructive" />
                        </div>
                    </div>
                    <h2 className="text-lg font-bold text-destructive">Warning: Permanent Data Loss</h2>
                    <p className="text-sm text-muted-foreground">
                        Resetting your vault will permanently delete all your saved passwords and credentials. This action cannot be undone.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs">Type <span className="font-bold">RESET</span> to confirm</Label>
                        <Input
                            placeholder="RESET"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                        />
                    </div>

                    {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                    <Button
                        variant="destructive"
                        className="w-full h-11"
                        onClick={handleReset}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Permanently Reset Vault
                    </Button>
                </div>
            </Card>

            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
                Cancel and Go Back
            </Button>
        </div>
    );
};

export default ResetVault;
