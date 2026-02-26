import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowRight, Globe, User } from 'lucide-react';
import { Button, Input, Card } from '../../components/ui';
import { useAuthStore } from '../../store/authStore';
import { sendToBackground, MessageType } from '../../utils/messaging';

interface PendingCredential {
  url: string;
  username: string;
  password: string;
}

/**
 * UnlockAndSave Component
 * 
 * This component handles the case where a user tries to save credentials
 * from a website but the vault is locked. It prompts for the master password
 * to unlock the vault and save the credentials.
 * 
 * Flow:
 * 1. Display the credentials that need to be saved
 * 2. Ask for master password
 * 3. Unlock vault and save credentials
 * 4. Redirect to vault home
 */
const UnlockAndSave = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setAuthenticated } = useAuthStore();
  const [masterPassword, setMasterPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCredential, setPendingCredential] = useState<PendingCredential | null>(null);

  useEffect(() => {
    // If already authenticated, just save the credential
    if (isAuthenticated) {
      saveCredential();
      return;
    }

    // Get pending credentials from background
    const fetchPendingCredentials = async () => {
      try {
        const response = await sendToBackground<{ credential?: PendingCredential }>(
          MessageType.GET_PENDING_UNLOCK_SAVE
        );
        if (response?.credential) {
          setPendingCredential(response.credential);
        } else {
          // No pending credentials, redirect to login
          navigate('/login');
        }
      } catch (err) {
        console.error('Failed to get pending credentials:', err);
        navigate('/login');
      }
    };

    fetchPendingCredentials();
  }, [isAuthenticated]);

  const saveCredential = async () => {
    if (!pendingCredential) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await sendToBackground<{ success: boolean; error?: string }>(
        MessageType.UNLOCK_AND_SAVE_CREDENTIAL,
        { masterPassword, credential: pendingCredential }
      );

      if (response?.success) {
        // Successfully saved, navigate to vault
        navigate('/vault');
      } else {
        setError(response?.error || 'Failed to unlock and save');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPassword) {
      setError('Please enter your master password');
      return;
    }
    await saveCredential();
  };

  // Extract domain from URL for display
  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  if (!pendingCredential) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b bg-card">
        <div className="flex items-center space-x-2">
          <div className="bg-primary/10 p-1.5 rounded-md">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <h1 className="font-bold text-lg">Unlock to Save</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Enter your master password to save these credentials to your vault.
            </p>
          </div>

          {/* Credential Preview */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">{getDomain(pendingCredential.url)}</h3>
                <p className="text-xs text-muted-foreground">{pendingCredential.url}</p>
              </div>
            </div>
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{pendingCredential.username}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{'•'.repeat(12)}</span>
              </div>
            </div>
          </Card>

          {/* Master Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Master Password</label>
              <Input
                type="password"
                placeholder="Enter your master password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Unlocking...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <span>Unlock & Save</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UnlockAndSave;
