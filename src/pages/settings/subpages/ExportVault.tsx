import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileJson } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useVaultStore } from '../../../store/vaultStore';

const ExportVault = () => {
    const navigate = useNavigate();
    const { credentials } = useVaultStore();

    const handleExport = () => {
        const data = JSON.stringify(credentials, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zerovault-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
                <Card className="p-6 space-y-4 text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <FileJson className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="font-bold">Export as JSON</h2>
                        <p className="text-xs text-muted-foreground">
                            Download your entire vault as an unencrypted JSON file.
                            <br /><span className="text-destructive font-bold">Warning:</span> This file is visible to anyone who accesses it.
                        </p>
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Download JSON
                    </Button>
                </Card>
            </div>
        </div>
    );
};

export default ExportVault;
