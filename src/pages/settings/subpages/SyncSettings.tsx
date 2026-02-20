import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Cloud, CloudOff } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useVaultStore } from '../../../store/vaultStore';

const SyncSettings = () => {
    const navigate = useNavigate();
    const { syncStatus, lastSynced, syncVault } = useVaultStore();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await syncVault();
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Sync & Data</h1>
            </div>

            <div className="p-4 space-y-6">
                <Card className="p-6 space-y-4 text-center">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        {syncStatus === 'synced' ? (
                            <Cloud className="w-8 h-8 text-primary" />
                        ) : (
                            <CloudOff className="w-8 h-8 text-muted-foreground" />
                        )}
                    </div>
                    <div>
                        <h2 className="font-bold text-lg">
                            {syncStatus === 'synced' ? 'Vault Synced' : 'Sync Paused'}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Last synced: {lastSynced ? new Date(lastSynced).toLocaleString() : 'Never'}
                        </p>
                    </div>
                    <Button
                        onClick={handleSync}
                        disabled={isSyncing || syncStatus === 'syncing'}
                        className="w-full"
                    >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                </Card>

                <div className="text-xs text-muted-foreground text-center">
                    Syncing encrypts your data before sending it to the cloud. Only you hold the decryption keys.
                </div>
            </div>
        </div>
    );
};

export default SyncSettings;
