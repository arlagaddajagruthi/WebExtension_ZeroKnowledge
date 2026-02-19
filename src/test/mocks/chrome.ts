import { vi } from 'vitest';

export const chrome = {
    storage: {
        local: {
            get: vi.fn(),
            set: vi.fn(),
            remove: vi.fn(),
            clear: vi.fn(),
        },
        session: {
            get: vi.fn(),
            set: vi.fn(),
            remove: vi.fn(),
            clear: vi.fn(),
        },
        onChanged: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
    },
    runtime: {
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
        },
        lastError: null,
    },
    tabs: {
        query: vi.fn(),
        sendMessage: vi.fn(),
        create: vi.fn(),
    },
};
