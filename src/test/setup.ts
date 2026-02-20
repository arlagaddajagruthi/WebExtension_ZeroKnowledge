import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { chrome } from './mocks/chrome';

// Mock the global chrome object
global.chrome = chrome as any;

// Mock matchMedia for UI components
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // deprecated
        removeListener: vi.fn(), // deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
    value: {
        writeText: vi.fn().mockResolvedValue(undefined),
    },
    writable: true,
});

// Mock ScrollTo
window.scrollTo = vi.fn();
