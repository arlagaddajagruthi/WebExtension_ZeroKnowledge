import React, { useState } from 'react';
import {
    ShieldCheck,
    LayoutDashboard,
    Key,
    ShieldAlert,
    Settings,
    RefreshCw,
    Plus,
    LogOut,
    Search,
    ChevronRight,
    User,
    ExternalLink,
    Copy
} from 'lucide-react';
import { Button, Input, Card, cn } from '../../components/ui';
import { useVaultStore } from '../../store/vaultStore';
import { useAuthStore } from '../../store/authStore';
import type { Credential } from '../../utils/types';

const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('vault');
    const { credentials, syncStatus } = useVaultStore();
    const { masterPasswordHash, logout } = useAuthStore();
    const [search, setSearch] = useState('');

    const filteredCredentials = credentials.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.username.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 border-r flex flex-col bg-card">
                <div className="p-6 border-b flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-primary" />
                    </div>
                    <span className="font-bold text-xl tracking-tight">ZeroVault</span>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <SidebarItem
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        label="Vault"
                        active={activeTab === 'vault'}
                        onClick={() => setActiveTab('vault')}
                    />
                    <SidebarItem
                        icon={<Key className="w-4 h-4" />}
                        label="Generator"
                        active={activeTab === 'generator'}
                        onClick={() => setActiveTab('generator')}
                    />
                    <SidebarItem
                        icon={<ShieldAlert className="w-4 h-4" />}
                        label="Security"
                        active={activeTab === 'security'}
                        onClick={() => setActiveTab('security')}
                    />
                    <SidebarItem
                        icon={<RefreshCw className="w-4 h-4" />}
                        label="Sync Dashboard"
                        active={activeTab === 'sync'}
                        onClick={() => setActiveTab('sync')}
                    />
                    <SidebarItem
                        icon={<Settings className="w-4 h-4" />}
                        label="Settings"
                        active={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </nav>

                <div className="p-4 border-t space-y-4">
                    <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg overflow-hidden">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate">Premium User</p>
                            <p className="text-[10px] text-muted-foreground truncate">john@example.com</p>
                        </div>
                    </div>
                    <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/5" onClick={logout}>
                        <LogOut className="w-4 h-4 mr-2" /> Log Out
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Topbar */}
                <header className="h-16 border-b bg-card px-8 flex items-center justify-between shrink-0">
                    <h2 className="text-lg font-bold capitalize">{activeTab}</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 text-emerald-600 rounded-full text-xs font-medium border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            {syncStatus}
                        </div>
                        <Button size="sm">
                            <Plus className="w-4 h-4 mr-2" /> Add Item
                        </Button>
                    </div>
                </header>

                {/* Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    {activeTab === 'vault' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search your vault..."
                                        className="pl-10 h-11"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" className="h-11">
                                    Filter
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredCredentials.length > 0 ? (
                                    filteredCredentials.map(item => (
                                        <VaultCard key={item.id} item={item} />
                                    ))
                                ) : (
                                    <div className="col-span-full py-20 text-center space-y-4">
                                        <p className="text-muted-foreground">No items found in your vault.</p>
                                        <Button variant="outline">Create a new login</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'generator' && (
                        <div className="max-w-2xl mx-auto py-12">
                            <Card className="p-8 space-y-8">
                                <div className="text-center space-y-2">
                                    <h3 className="text-2xl font-bold">Generate Password</h3>
                                    <p className="text-muted-foreground">Create a secure, random password for your accounts.</p>
                                </div>
                                <div className="p-6 bg-muted/30 rounded-xl border border-dashed border-muted text-center break-all font-mono text-3xl font-bold tracking-widest text-primary">
                                    ZeroV-2026-####
                                </div>
                                <div className="flex items-center justify-center gap-4">
                                    <Button size="lg" className="px-12">Copy Password</Button>
                                    <Button variant="outline" size="lg">Generate New</Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="max-w-5xl mx-auto space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatsCard label="Vault Health" value="84%" subValue="+2% from last week" />
                                <StatsCard label="Reused Passwords" value="12" subValue="High Risk" destructive />
                                <StatsCard label="Weak Passwords" value="5" subValue="Critical" destructive />
                            </div>
                            <Card className="p-8 text-center space-y-4">
                                <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
                                <h3 className="text-xl font-bold">Breach Monitoring Not Active</h3>
                                <p className="text-muted-foreground max-w-sm mx-auto">
                                    Upgrade to Premium to enable real-time breach monitoring for all your saved accounts.
                                </p>
                                <Button>Enable Now</Button>
                            </Card>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

const SidebarItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
            active
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
    >
        <span className={cn(active ? "text-primary-foreground" : "text-primary group-hover:scale-110 transition-transform")}>
            {icon}
        </span>
        {label}
    </button>
);

const VaultCard = ({ item }: { item: Credential }) => (
    <Card className="p-5 hover:shadow-lg transition-all border-muted group cursor-pointer relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-8 w-8">
                <ExternalLink className="w-4 h-4" />
            </Button>
        </div>
        <div className="flex items-center gap-4 mb-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                <span className="text-primary font-bold text-xl">{item.name[0].toUpperCase()}</span>
            </div>
            <div className="overflow-hidden">
                <h3 className="font-bold truncate text-base">{item.name}</h3>
                <p className="text-sm text-muted-foreground truncate">{item.username}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
            <Button variant="secondary" size="sm" className="flex-1 text-[10px] h-8 font-bold">
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy Username
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 text-[10px] h-8 font-bold">
                <Key className="w-3.5 h-3.5 mr-1.5" /> Copy Password
            </Button>
        </div>
    </Card>
);

const StatsCard = ({ label, value, subValue, destructive }: { label: string, value: string, subValue: string, destructive?: boolean }) => (
    <Card className="p-6">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <h4 className={cn("text-3xl font-bold mt-2", destructive ? "text-destructive" : "text-foreground")}>{value}</h4>
        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
    </Card>
);

export default Dashboard;
