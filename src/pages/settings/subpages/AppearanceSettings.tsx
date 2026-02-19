import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Moon, Sun } from 'lucide-react';
import { Button, Card } from '../../../components/ui';

const AppearanceSettings = () => {
    const navigate = useNavigate();
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Mock checking document class
        setIsDark(document.documentElement.classList.contains('dark'));
    }, []);

    const toggleTheme = () => {
        const newMode = !isDark;
        setIsDark(newMode);

        if (newMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    return (
        <div className="flex flex-col h-full bg-background overflow-y-auto">
            <div className="p-4 border-b bg-card flex items-center space-x-2 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="h-8 w-8">
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="font-bold text-lg">Appearance</h1>
            </div>

            <div className="p-4 space-y-6">
                <Card className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        <span className="font-medium">Dark Mode</span>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`w-10 h-6 rounded-full p-1 transition-colors ${isDark ? 'bg-primary' : 'bg-muted'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isDark ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </Card>
            </div>
        </div>
    );
};

export default AppearanceSettings;
