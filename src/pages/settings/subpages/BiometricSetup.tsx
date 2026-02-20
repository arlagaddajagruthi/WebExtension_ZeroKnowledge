import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Fingerprint, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { Button, Card } from '../../../components/ui';
import { useAuthStore } from '../../../store/authStore';
import {
    isWebAuthnAvailable,
    isPlatformAuthenticatorAvailable,
    registerBiometric,
    storeBiometricCredential,
    getBiometricCredential,
    removeBiometricCredential,
} from '../../../services/webauthn';

const BiometricSetup = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();
    
    const [step, setStep] = useState<'check' | 'enroll' | 'verify' | 'success'>('check');
    const [isSupported, setIsSupported] = useState(false);
    const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        const checkSupport = async () => {
            const supported = isWebAuthnAvailable();
            setIsSupported(supported);

            if (supported) {
                const available = await isPlatformAuthenticatorAvailable();
                setIsPlatformAvailable(available);
            }

            // Check if biometric is already enrolled
            const userId = 'current-user'; // Get from auth store
            const credential = getBiometricCredential(userId);
            setIsBiometricEnabled(!!credential);

            if (supported && !credential) {
                setStep('enroll');
            }
        };

        checkSupport();
    }, [isAuthenticated, navigate]);

    const handleEnrollBiometric = async () => {
        if (!isSupported) {
            setError('WebAuthn is not supported on your device');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const result = await registerBiometric(
                'current-user',
                'Your Name',
                'your@email.com'
            );

            if (!result.success) {
                throw new Error(result.error || 'Enrollment failed');
            }

            if (result.credential) {
                storeBiometricCredential('current-user', result.credential);
                setIsBiometricEnabled(true);
                setSuccess('Biometric authentication enabled successfully');
                setStep('success');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to enroll biometric');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisableBiometric = () => {
        if (confirm('Are you sure you want to disable biometric authentication?')) {
            removeBiometricCredential('current-user');
            setIsBiometricEnabled(false);
            setSuccess('Biometric authentication disabled');
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Biometric Authentication</h1>
            </div>

            <div className="p-4 space-y-6">
                {!isSupported ? (
                    <Card className="p-6 space-y-4 border-destructive/30 bg-destructive/5">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-destructive" />
                            <h2 className="font-bold text-lg">Not Supported</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Your browser doesn't support WebAuthn/FIDO2 authentication.
                            Please use a modern browser like Chrome, Firefox, Safari, or Edge.
                        </p>
                    </Card>
                ) : !isPlatformAvailable ? (
                    <Card className="p-6 space-y-4 border-yellow-500/30 bg-yellow-500/5">
                        <div className="flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-600" />
                            <h2 className="font-bold text-lg">No Biometric Hardware</h2>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Your device doesn't have biometric hardware (fingerprint, face recognition).
                            Biometric authentication is not available on this device.
                        </p>
                    </Card>
                ) : isBiometricEnabled && step === 'success' ? (
                    <>
                        <Card className="p-6 space-y-4 border-emerald-500/30 bg-emerald-500/5">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <h2 className="font-bold text-lg">Enabled</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Biometric authentication is now enabled. You can use your fingerprint or face to unlock your vault.
                            </p>
                        </Card>

                        <Card className="p-6 space-y-4">
                            <h3 className="font-bold">Biometric Settings</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-sm">Biometric Unlock</p>
                                        <p className="text-xs text-muted-foreground">Use biometric to unlock vault</p>
                                    </div>
                                    <div className="h-5 w-10 bg-emerald-600 rounded-full" />
                                </div>
                            </div>
                        </Card>

                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleDisableBiometric}
                        >
                            Disable Biometric Authentication
                        </Button>
                    </>
                ) : isBiometricEnabled ? (
                    <>
                        <Card className="p-6 space-y-4 border-emerald-500/30 bg-emerald-500/5">
                            <div className="flex items-center gap-3">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <h2 className="font-bold text-lg">Enabled</h2>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Biometric authentication is enabled. You can use your fingerprint or face to unlock your vault.
                            </p>
                        </Card>

                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={handleDisableBiometric}
                        >
                            Disable Biometric Authentication
                        </Button>
                    </>
                ) : (
                    <>
                        <Card className="p-6 space-y-4">
                            <div className="flex justify-center">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Fingerprint className="w-8 h-8 text-primary" />
                                </div>
                            </div>

                            <div className="text-center space-y-2">
                                <h2 className="font-bold text-lg">Enable Biometric</h2>
                                <p className="text-xs text-muted-foreground">
                                    Use your device's biometric (fingerprint or face) to quickly unlock your vault.
                                </p>
                            </div>

                            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2 text-xs">
                                <p className="font-semibold text-primary">Benefits:</p>
                                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                    <li>Faster vault access</li>
                                    <li>More secure than remembering passwords</li>
                                    <li>Unique biometric data</li>
                                </ul>
                            </div>

                            {error && (
                                <div className="flex items-start space-x-2 text-destructive bg-destructive/5 p-3 rounded text-xs font-medium">
                                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <Button
                                onClick={handleEnrollBiometric}
                                disabled={isLoading}
                                className="w-full"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader className="w-4 h-4 mr-2 animate-spin" />
                                        Setting up...
                                    </>
                                ) : (
                                    <>
                                        <Fingerprint className="w-4 h-4 mr-2" />
                                        Enable Biometric
                                    </>
                                )}
                            </Button>
                        </Card>

                        <Card className="p-4 space-y-2 text-xs text-muted-foreground bg-muted/30">
                            <p className="font-semibold">How it works:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Your biometric data is stored locally on your device</li>
                                <li>It's never sent to our servers</li>
                                <li>You can disable it anytime</li>
                            </ol>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
};

export default BiometricSetup;
