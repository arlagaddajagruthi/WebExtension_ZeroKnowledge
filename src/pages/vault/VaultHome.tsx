import React, { useState } from 'react';
import { Plus, Search, LogOut, Key, ShieldCheck, Settings, Copy, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button, Input, Card, cn, Toast, type ToastType } from '../../components/ui';
import { useVaultStore } from '../../store/vaultStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import type { Credential } from '../../utils/types';

/**
 * VaultHome Component
 * 
 * The main dashboard for the user's vault.
 * Displays a list of stored credentials with search and filtering capabilities.
 * 
 * Key Features:
 * - **Credential List**: Displays all stored passwords and secure notes.
 * - **Search**: Real-time filtering by name, username, or URL.
 * - **Sync Status**: Visual feedback on the vault's synchronization state (Synced, Syncing, Offline, Error).
 * - **Navigation**: Access to Add Item, Generator, and Settings pages.
 * - **Clipboard Actions**: Quick copy for usernames and passwords.
 */
const VaultHome = () => {
    const navigate = useNavigate();
    const { credentials, syncStatus } = useVaultStore();
    const logout = useAuthStore((state) => state.logout);
    const [search, setSearch] = useState('');
    const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null);



    const filteredCredentials = credentials.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.username.toLowerCase().includes(search.toLowerCase()) ||
        c.url.toLowerCase().includes(search.toLowerCase())
    );

    /**
     * Copies text to the clipboard and shows a toast notification.
     * 
     * @param text - The text to copy (e.g., password or username).
     * @param label - The label of the item being copied (used in the toast message).
     */
    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setToast({ message: `${label} copied to clipboard`, type: 'success' });
    };

    /**
     * Returns the appropriate icon based on the current sync status.
     * 
     * @returns A React Node representing the sync state icon.
     */
    const getSyncIcon = () => {
        switch (syncStatus) {
            case 'synced': return <Cloud className="w-4 h-4 text-emerald-500" />;
            case 'syncing': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
            case 'offline': return <CloudOff className="w-4 h-4 text-muted-foreground" />;
            case 'error': return <AlertTriangle className="w-4 h-4 text-destructive" />;
            default: return <Cloud className="w-4 h-4 text-muted-foreground" />;
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            {/* Header */}
            <div className="p-4 border-b bg-card sticky top-0 z-10 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className="bg-primary/10 p-1.5 rounded-md">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <h1 className="font-bold text-lg">ZeroVault</h1>
                    </div>
                    <div className="flex items-center space-x-1">
                        <div className="mr-2" title={`Sync Status: ${syncStatus}`}>
                            {getSyncIcon()}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/generator')} className="h-8 w-8">
                            <Key className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-destructive">
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search vault..."
                        className="pl-9 h-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    {/* <input
                        placeholder="Search vault..."
                        className="pl-9 h-10 w-full"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        data-testid="search-input-debug"
                    /> */}
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {filteredCredentials.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                        <div className="bg-muted p-6 rounded-full">
                            <Search className="w-10 h-10 text-muted-foreground opacity-20" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-medium">No results found</p>
                            <p className="text-xs text-muted-foreground">Add your first item to get started</p>
                        </div>
                        <Button onClick={() => navigate('/add-credential')}>
                            <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                    </div>
                ) : (
                    filteredCredentials.map((item) => (
                        <CredentialItem key={item.id} item={item} onCopy={handleCopy} onEdit={() => navigate(`/edit-credential/${item.id}`)} />
                    ))
                )}
            </div>

            {/* Footer Navigation */}
            <div className="border-t bg-card p-2 flex justify-around">
                <NavButton active icon={<ShieldCheck className="w-5 h-5" />} label="Vault" onClick={() => navigate('/vault')} />
                <NavButton icon={<Plus className="w-5 h-5" />} label="Add" onClick={() => navigate('/add-credential')} />
                <NavButton icon={<Key className="w-5 h-5" />} label="Generator" onClick={() => navigate('/generator')} />
                <NavButton icon={<Settings className="w-5 h-5" />} label="Settings" onClick={() => navigate('/settings')} />
            </div>

            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )
            }
        </div >
    );
};

/**
 * CredentialItem Component
 * 
 * Renders a single credential card in the list.
 * Supports hover actions for quick copying of username and password.
 * 
 * @param item - The credential object to display.
 * @param onCopy - Callback function to handle clipboard copy events.
 * @param onEdit - Callback function to navigate to the edit page.
 */
const CredentialItem = ({ item, onCopy, onEdit }: { item: Credential, onCopy: (text: string, label: string) => void, onEdit: () => void }) => (
    <Card className="p-3 hover:bg-accent/50 transition-colors cursor-pointer group" onClick={onEdit}>
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold">{item.name[0].toUpperCase()}</span>
                </div>
                <div className="overflow-hidden">
                    <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{item.username}</p>
                </div>
            </div>
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); onCopy(item.password, 'Password'); }}
                    data-testid="copy-password-btn"
                >
                    <Key className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); onCopy(item.username, 'Username'); }}
                >
                    <Copy className="w-4 h-4" />
                </Button>
            </div>
        </div>
    </Card>
);

const NavButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={cn(
            "flex flex-col items-center p-2 rounded-lg transition-colors min-w-[64px]",
            active ? "text-primary bg-primary/5" : "text-muted-foreground hover:bg-accent"
        )}
    >
        {icon}
        <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
);

export default VaultHome;
