import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVaultStore } from './vaultStore';
import { act } from '@testing-library/react';
import { chrome } from '../test/mocks/chrome';

describe('VaultStore', () => {
    beforeEach(() => {
        useVaultStore.getState().reset();
        vi.clearAllMocks();
    });

    it('should add a credential and increment version', async () => {
        const credential = {
            name: 'Test',
            url: 'https://test.com',
            username: 'user',
            password: 'password',
            notes: '',
            tags: []
        };

        await act(async () => {
            await useVaultStore.getState().addCredential(credential);
        });

        const state = useVaultStore.getState();
        expect(state.credentials).toHaveLength(1);
        expect(state.credentials[0].name).toEqual(credential.name);
        expect(state.credentials[0].version).toBe(1);
    });

    it('should update a credential and increment version', async () => {
        const credential = {
            name: 'Test',
            url: 'https://test.com',
            username: 'user',
            password: 'password',
            notes: '',
            tags: []
        };

        let id = '';
        await act(async () => {
            await useVaultStore.getState().addCredential(credential);
            id = useVaultStore.getState().credentials[0].id;
        });

        const updatedCredential = { username: 'new-user' };

        await act(async () => {
            await useVaultStore.getState().updateCredential(id, updatedCredential);
        });

        const state = useVaultStore.getState();
        expect(state.credentials[0].username).toBe('new-user');
        expect(state.credentials[0].version).toBeGreaterThan(1);
    });

    it('should delete a credential', async () => {
        const credential = {
            name: 'Test',
            url: 'https://test.com',
            username: 'user',
            password: 'password',
            notes: '',
            tags: []
        };

        let id = '';
        await act(async () => {
            await useVaultStore.getState().addCredential(credential);
            id = useVaultStore.getState().credentials[0].id;
        });

        await act(async () => {
            await useVaultStore.getState().deleteCredential(id);
        });

        const state = useVaultStore.getState();
        expect(state.credentials).toHaveLength(0);
    });
});
