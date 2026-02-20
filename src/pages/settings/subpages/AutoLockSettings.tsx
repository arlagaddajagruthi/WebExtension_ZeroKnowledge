import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Label } from '../../../components/ui';

const AutoLockSettings = () => {
    const navigate = useNavigate();
    const [timeout, setTimeoutVal] = useState('15');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save to chrome.storage.local
            // -1 means never lock, otherwise it's minutes
            const timeoutMinutes = parseInt(timeout);
            await chrome.storage.local.set({ autoLockTimeout: timeoutMinutes });
            console.log('Auto-lock timeout saved:', timeoutMinutes, 'minutes');
            navigate('/settings');
        } catch (error) {
            console.error('Failed to save auto-lock timeout:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Auto-lock Timer</h1>
            </div>

            <div className="p-4 space-y-6">
                <Card className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label>Lock vault after inactivity</Label>
                        <select
                            className="w-full p-2 border rounded bg-background"
                            value={timeout}
                            onChange={(e) => setTimeoutVal(e.target.value)}
                        >
                            <option value="1">1 Minute</option>
                            <option value="5">5 Minutes</option>
                            <option value="15">15 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="60">1 Hour</option>
                            <option value="-1">Never</option>
                        </select>
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                        {saving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Card>
            </div>
        </div>
    );
};

export default AutoLockSettings;
