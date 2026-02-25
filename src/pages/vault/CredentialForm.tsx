import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Eye, EyeOff, Globe, User, Lock, FileText, Check } from 'lucide-react';
import { Button, Input, Label, Card } from '../../components/ui';
import { useVaultStore } from '../../store/vaultStore';

/**
 * CredentialForm Component
 * 
 * A dual-purpose form for creating and editing vault credentials.
 * Handles input validation, state management, and interaction with the `VaultStore`.
 * 
 * Key Features:
 * - **Unification**: Used for both adding new items and editing existing ones (based on `id` param).
 * - **Security**: Includes a password visibility toggle and a generator link.
 * - **State Management**: Local state for form inputs, synced with global store for edits.
 * - **Feedback**: Provides visual feedback during save operations (loading/saved states).
 */
const CredentialForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const location = useLocation();
    const { credentials, addCredential, updateCredential, deleteCredential } = useVaultStore();

    const [formData, setFormData] = useState({
        name: '',
        url: '',
        username: '',
        password: '',
        notes: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        if (id) {
            const credential = credentials.find(c => c.id === id);
            if (credential) {
                setFormData({
                    name: credential.name || '',
                    url: credential.url,
                    username: credential.username,
                    password: credential.password,
                    notes: credential.notes || '',
                });
            }
        } else if (location.state?.password) {
            setFormData(prev => ({ ...prev, password: location.state.password }));
        }
    }, [id, credentials, location.state]);

    /**
     * Handles the form submission for saving credentials.
     * 
     * @param e - The form submission event.
     * 
     * Workflow:
     * 1. Prevents default form submission.
     * 2. Sets loading state to prevent double submission.
     * 3. Determines action based on presence of `id`:
     *    - **Updates** existing credential if `id` exists.
     *    - **Adds** new credential if no `id` exists.
     * 4. Provides success feedback and navigates back to the vault.
     */
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        setTimeout(() => {
            if (id) {
                updateCredential(id, formData);
            } else {
                addCredential(formData);
            }
            setIsLoading(false);
            setIsSaved(true);
            setTimeout(() => navigate('/vault'), 800);
        }, 500);
    };

    /**
     * Handles the deletion of the current credential.
     * Requires user confirmation before proceeding.
     * 
     * Workflow:
     * 1. Checks if `id` is present.
     * 2. Prompts user for confirmation via browser dialog.
     * 3. Calls `deleteCredential` from store.
     * 4. Navigates back to the vault.
     */
    const handleDelete = () => {
        if (id && window.confirm('Are you sure you want to delete this item?')) {
            deleteCredential(id);
            navigate('/vault');
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            <div className="p-4 border-b bg-card flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/vault')} className="h-8 w-8">
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="font-bold text-lg">{id ? 'Edit Item' : 'New Item'}</h1>
                </div>
                <div className="flex items-center space-x-2">
                    {id && (
                        <Button variant="ghost" size="icon" onClick={handleDelete} className="h-8 w-8 text-destructive">
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    )}
                    <Button size="sm" onClick={handleSave} disabled={isLoading || isSaved}>
                        {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4 mr-2" />}
                        {isSaved ? 'Saved' : 'Save'}
                    </Button>
                </div>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 space-y-6 pb-12">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Name
                        </Label>
                        <Input
                            placeholder="e.g. Google, GitHub"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground" /> Website URL
                        </Label>
                        <Input
                            placeholder="https://example.com"
                            value={formData.url}
                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-muted-foreground" /> Username / Email
                        </Label>
                        <Input
                            placeholder="john@example.com"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" /> Password
                        </Label>
                        <div className="relative">
                            <Input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                            />
                            <button
                                type="button"
                                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        {!id && (
                            <button
                                type="button"
                                onClick={() => navigate('/generator')}
                                className="text-[10px] text-primary font-medium hover:underline"
                            >
                                Generate strong password
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Notes
                        </Label>
                        <textarea
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[100px]"
                            placeholder="Additional information..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                </div>
            </form>
        </div>
    );
};

export default CredentialForm;
