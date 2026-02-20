import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fingerprint, AlertCircle } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useAuthStore } from '../../../store/authStore';

const BiometricSetup = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();

    const [isSupported] = useState(false);
    const [error] = useState(
        'Biometric authentication is currently disabled in this build.'
    );

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/settings')}
                    className="h-8 w-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Biometric Authentication</h1>
            </div>

            <div className="p-4 space-y-6">
                <Card className="p-6 space-y-4 border-destructive/30 bg-destructive/5">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive" />
                        <h2 className="font-bold text-lg">Feature Disabled</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Biometric authentication (WebAuthn/FIDO2) is currently
                        disabled in this version of the application.
                    </p>
                </Card>

                <Card className="p-6 space-y-4 text-center">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                            <Fingerprint className="w-8 h-8 text-muted-foreground" />
                        </div>
                    </div>

                    <h2 className="font-bold text-lg">Coming Soon</h2>
                    <p className="text-xs text-muted-foreground">
                        Biometric unlock support will be available in a future
                        release.
                    </p>

                    <Button disabled className="w-full">
                        Enable Biometric (Disabled)
                    </Button>
                </Card>
            </div>
        </div>
    );
};

export default BiometricSetup;
