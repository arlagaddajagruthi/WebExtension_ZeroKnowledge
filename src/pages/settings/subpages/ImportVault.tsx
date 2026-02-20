import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Card, Label } from '../../../components/ui';
import { useVaultStore } from '../../../store/vaultStore';
import { useAuthStore } from '../../../store/authStore';
import { decryptVaultData } from '../../../utils/crypto';
import type { Credential } from '../../../utils/types';

const ImportVault = () => {
    const navigate = useNavigate();
    const { addCredential, credentials } = useVaultStore();
    const { encryptionKey } = useAuthStore();

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [importedCount, setImportedCount] = useState(0);
    const [previewCredentials, setPreviewCredentials] = useState<any[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const content = await file.text();
            const data = JSON.parse(content);

            // Check if it's an encrypted export
            if (data.format === 'encrypted-json' && data.encrypted_data) {
                if (!encryptionKey) {
                    throw new Error('No encryption key available');
                }

                // Decrypt the data
                const decrypted = await decryptVaultData(data.encrypted_data, encryptionKey);
                const credentials = JSON.parse(decrypted);
                
                setPreviewCredentials(credentials);
                setShowPreview(true);
            } else if (Array.isArray(data)) {
                // Assume it's an unencrypted JSON array
                setPreviewCredentials(data);
                setShowPreview(true);
            } else if (data.credentials && Array.isArray(data.credentials)) {
                // ZeroVault export format
                setPreviewCredentials(data.credentials);
                setShowPreview(true);
            } else {
                throw new Error('Invalid file format. Expected ZeroVault export or credentials array.');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to parse file');
            setPreviewCredentials([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImport = async () => {
        setIsLoading(true);
        setError('');

        try {
            let imported = 0;

            for (const cred of previewCredentials) {
                // Validate required fields
                if (!cred.url || !cred.username || !cred.password) {
                    console.warn('Skipping invalid credential:', cred);
                    continue;
                }

                // Check for duplicates
                const exists = credentials.some(
                    c => c.url === cred.url && c.username === cred.username
                );

                if (exists) {
                    console.log('Skipping duplicate:', cred.username, cred.url);
                    continue;
                }

                // Add credential
                await addCredential({
                    name: cred.name || new URL(cred.url).hostname,
                    url: cred.url,
                    username: cred.username,
                    password: cred.password,
                    notes: cred.notes || '',
                });

                imported++;
            }

            setImportedCount(imported);
            setSuccess(`Successfully imported ${imported} credentials`);
            setShowPreview(false);

            // Redirect after delay
            setTimeout(() => {
                navigate('/settings');
            }, 2000);

        } catch (err: any) {
            setError(err.message || 'Failed to import credentials');
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
                <h1 className="font-bold text-lg">Import Vault</h1>
            </div>

            <div className="p-4 space-y-6">
                {!showPreview ? (
                    <Card className="p-6 space-y-4">
                        <div className="flex justify-center">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                <Upload className="w-8 h-8 text-primary" />
                            </div>
                        </div>

                        <div className="text-center space-y-2">
                            <h2 className="font-bold text-lg">Import Credentials</h2>
                            <p className="text-xs text-muted-foreground">
                                Import credentials from a ZeroVault export file or another password manager.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Select File</Label>
                            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/50 transition-colors cursor-pointer">
                                <input
                                    type="file"
                                    accept=".json,.zerovault"
                                    onChange={handleFileSelect}
                                    disabled={isLoading}
                                    className="hidden"
                                    id="file-input"
                                />
                                <label htmlFor="file-input" className="cursor-pointer">
                                    <p className="text-sm text-muted-foreground">
                                        Click to select or drag and drop
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Supported: .json, .zerovault
                                    </p>
                                </label>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start space-x-2 text-destructive bg-destructive/5 p-3 rounded text-xs font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {success && (
                            <div className="flex items-start space-x-2 text-emerald-600 bg-emerald-500/10 p-3 rounded text-xs font-medium">
                                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{success} ({importedCount} imported)</span>
                            </div>
                        )}

                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-xs">
                            <p className="font-semibold text-primary">Supported Formats:</p>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                <li>ZeroVault encrypted exports (.zerovault)</li>
                                <li>ZeroVault JSON exports</li>
                                <li>Standard JSON credential arrays</li>
                            </ul>
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6 space-y-4">
                        <div className="space-y-2">
                            <h2 className="font-bold">Review Import</h2>
                            <p className="text-xs text-muted-foreground">
                                {previewCredentials.length} credential(s) will be imported. Duplicates will be skipped.
                            </p>
                        </div>

                        <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg divide-y">
                            {previewCredentials.map((cred, idx) => (
                                <div key={idx} className="p-3 text-sm space-y-1">
                                    <div className="font-semibold">{cred.name || new URL(cred.url).hostname}</div>
                                    <div className="text-xs text-muted-foreground">
                                        Username: {cred.username}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        URL: {cred.url}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {error && (
                            <div className="flex items-start space-x-2 text-destructive bg-destructive/5 p-3 rounded text-xs font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setShowPreview(false);
                                    setPreviewCredentials([]);
                                    setError('');
                                }}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={handleImport}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Importing...' : 'Import Credentials'}
                            </Button>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default ImportVault;
