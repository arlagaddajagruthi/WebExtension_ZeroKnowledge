import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button, Input, Label, Card } from '../../../components/ui';
import { useAuthStore } from '../../../store/authStore';
import { useVaultStore } from '../../../store/vaultStore';
import { deriveMasterKey, generateSalt } from '../../../utils/crypto';
import { saveCredentials } from '../../../services/storage';

const ChangePassword = () => {
    const navigate = useNavigate();
    const { masterPasswordHash, vaultSalt, setRegistered, setAuthenticated } = useAuthStore();
    const { credentials } = useVaultStore();

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const checkCurrentPassword = async () => {
        const hash = await deriveMasterKey(currentPassword, vaultSalt!);
        return hash === masterPasswordHash;
    };

    const handleChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            // Verify current password
            const isValid = await checkCurrentPassword();
            if (!isValid) {
                setError('Current password is incorrect.');
                setIsLoading(false);
                return;
            }

            if (newPassword.length < 8) {
                setError('New password must be at least 8 characters long.');
                setIsLoading(false);
                return;
            }

            if (newPassword !== confirmPassword) {
                setError('New passwords do not match.');
                setIsLoading(false);
                return;
            }

            // Generate new salt and key
            const newSalt = generateSalt();
            const newKey = await deriveMasterKey(newPassword, newSalt);

            // Re-encrypt vault with new key
            // Note: credentials are currently in memory (decrypted)
            await saveCredentials(credentials, newKey);

            // Update AuthStore
            // setRegistered updates: isRegistered=true, hash=newKey, salt=newSalt
            setRegistered(true, newKey, newSalt);

            // Update session (authenticated with new key)
            setAuthenticated(true, newKey);

            alert('Master password changed successfully.');
            navigate('/settings');

        } catch (err) {
            console.error(err);
            setError('Failed to change password. Please try again.');
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
                <h1 className="font-bold text-lg">Change Password</h1>
            </div>

            <div className="p-4 space-y-6">
                <Card className="p-6 space-y-4">
                    <form onSubmit={handleChange} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Current Password</Label>
                            <Input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>New Password</Label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                minLength={8}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Confirm New Password</Label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <p className="text-xs text-destructive font-medium">{error}</p>}

                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading ? 'Updating...' : 'Change Master Password'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default ChangePassword;
