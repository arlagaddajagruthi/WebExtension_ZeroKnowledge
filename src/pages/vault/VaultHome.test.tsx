import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
// import userEvent from '@testing-library/user-event';
import VaultHome from './VaultHome';
import { useVaultStore } from '../../store/vaultStore';
import { BrowserRouter } from 'react-router-dom';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Copy: () => <span data-testid="copy-icon">Copy</span>,
    Trash2: () => <span data-testid="trash-icon">Trash</span>,
    Edit: () => <span data-testid="edit-icon">Edit</span>,
    Search: () => <span data-testid="search-icon">Search</span>,
    LogOut: () => <span data-testid="logout-icon">LogOut</span>,
    Plus: () => <span data-testid="plus-icon">Plus</span>,
    RefreshCw: () => <span data-testid="sync-icon">Sync</span>,
    Wifi: () => <span data-testid="wifi-icon">Wifi</span>,
    WifiOff: () => <span data-testid="wifi-off-icon">WifiOff</span>,
    ShieldCheck: () => <span data-testid="shield-icon">Shield</span>,
    Settings: () => <span data-testid="settings-icon">Settings</span>,
    Key: () => <span data-testid="key-icon">Key</span>,
    Cloud: () => <span data-testid="cloud-icon">Cloud</span>,
    CloudOff: () => <span data-testid="cloud-off-icon">CloudOff</span>,
    AlertTriangle: () => <span data-testid="alert-icon">Alert</span>,
}));

// Mock UI components
vi.mock('../../components/ui', async () => {
    return {
        // @ts-ignore
        ...await vi.importActual('../../components/ui'),
        Input: (props: any) => <input {...props} data-testid="mock-input" />,
        Toast: ({ message }: any) => <div data-testid="mock-toast">{message}</div>,
    };
});

describe('VaultHome', () => {
    beforeEach(() => {
        useVaultStore.getState().reset();

        // Add mock data
        useVaultStore.getState().addCredential({
            name: 'GitHub',
            url: 'https://github.com',
            username: 'dev@test.com',
            password: 'password123',
            notes: '',
            tags: []
        });
    });

    it('should render credentials list', () => {
        render(
            <BrowserRouter>
                <VaultHome />
            </BrowserRouter>
        );
        expect(screen.getByText('GitHub')).toBeInTheDocument();
        expect(screen.getByText('dev@test.com')).toBeInTheDocument();
    });

    it('should filter credentials by search', async () => {
        // const user = userEvent.setup();
        render(
            <BrowserRouter>
                <VaultHome />
            </BrowserRouter>
        );

        const searchInput = screen.getByPlaceholderText('Search vault...');

        fireEvent.change(searchInput, { target: { value: 'Google' } });

        // Debug check
        // screen.debug();
        // expect(screen.getByTestId('debug-state')).toHaveTextContent(expect.stringContaining('"search":"Google"'));

        expect(screen.queryByText('GitHub')).not.toBeInTheDocument();

        fireEvent.change(searchInput, { target: { value: 'Git' } });
        expect(screen.getByText('GitHub')).toBeInTheDocument();
    });

    it('should copy password to clipboard', async () => {
        // const user = userEvent.setup();
        render(
            <BrowserRouter>
                <VaultHome />
            </BrowserRouter>
        );

        const passwordCopyButton = screen.getByTestId('copy-password-btn');
        fireEvent.click(passwordCopyButton);

        await waitFor(() => {
            expect(navigator.clipboard.writeText).toHaveBeenCalled();
            expect(screen.getByTestId('mock-toast')).toHaveTextContent('Password copied to clipboard');
        });
    });
});
