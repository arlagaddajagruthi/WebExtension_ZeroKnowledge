import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileJson, Lock } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useVaultStore } from '../../../store/vaultStore';
import { useAuthStore } from '../../../store/authStore';
import { encryptVaultData } from '../../../utils/crypto';

const ExportVault = () => {
    const navigate = useNavigate();
    const { credentials } = useVaultStore();
    const { encryptionKey } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [exportFormat, setExportFormat] = useState<'unencrypted' | 'encrypted'>('encrypted');

    const handleUnencryptedExport = () => {
        const data = JSON.stringify(credentials, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zerovault-export-unencrypted-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleEncryptedExport = async () => {
        if (!encryptionKey) {
            alert('Encryption key not available');
            return;
        }

        setIsLoading(true);
        try {
            const data = JSON.stringify(credentials, null, 2);
            const encrypted = await encryptVaultData(data, encryptionKey);

            // Add metadata for decryption
            const exportData = {
                version: 1,
                timestamp: new Date().toISOString(),
                encrypted_data: encrypted,
                format: 'encrypted-json',
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zerovault-export-encrypted-${new Date().toISOString().split('T')[0]}.zerovault`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export vault');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Export Vault</h1>
            </div>

            <div className="p-4 space-y-6">
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setExportFormat('encrypted')}
                            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                                exportFormat === 'encrypted'
                                    ? 'bg-primary text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            Encrypted (Secure)
                        </button>
                        <button
                            onClick={() => setExportFormat('unencrypted')}
                            className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                                exportFormat === 'unencrypted'
                                    ? 'bg-primary text-white'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            Unencrypted (JSON)
                        </button>
                    </div>
                </div>

                {exportFormat === 'encrypted' ? (
                    <Card className="p-6 space-y-4">
                        <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <Lock className="w-6 h-6 text-primary" />
                        </div>
                        <div className="space-y-2 text-center">
                            <h2 className="font-bold">Encrypted Export (.zerovault)</h2>
                            <p className="text-xs text-muted-foreground">
                                Your vault is encrypted with your master password. Only you can decrypt this file.
                                <br /><span className="text-emerald-600 font-bold">Recommended:</span> This is the safest way to backup your vault.
                            </p>
                        </div>
                        <Button className="w-full" onClick={handleEncryptedExport} disabled={isLoading}>
                            <Download className="w-4 h-4 mr-2" />
                            {isLoading ? 'Exporting...' : 'Download Encrypted'}
                        </Button>
                    </Card>
                ) : (
                    <Card className="p-6 space-y-4 border-destructive/30 bg-destructive/5">
                        <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                            <FileJson className="w-6 h-6 text-destructive" />
                        </div>
                        <div className="space-y-2 text-center">
                            <h2 className="font-bold">Unencrypted Export (JSON)</h2>
                            <p className="text-xs text-muted-foreground">
                                Download your vault as an unencrypted JSON file.
                                <br /><span className="text-destructive font-bold">⚠️ Warning:</span> This file contains plaintext passwords. Treat it with extreme care.
                            </p>
                        </div>
                        <Button variant="destructive" className="w-full" onClick={handleUnencryptedExport}>
                            <Download className="w-4 h-4 mr-2" />
                            Download Unencrypted
                        </Button>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ExportVault;
