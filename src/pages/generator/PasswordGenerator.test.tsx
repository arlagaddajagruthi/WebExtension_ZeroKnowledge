import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordGenerator from './PasswordGenerator';
import { BrowserRouter } from 'react-router-dom';
import { generateRandomPassword } from '../../utils/crypto';

// Mock crypto utility
vi.mock('../../utils/crypto', () => ({
    generateRandomPassword: vi.fn((length) => 'A'.repeat(length)),
}));

describe('PasswordGenerator', () => {
    it('should render with default settings', () => {
        render(
            <BrowserRouter>
                <PasswordGenerator />
            </BrowserRouter>
        );
        expect(screen.getByText('Password Generator')).toBeInTheDocument();
    });

    it('should update password length', () => {
        render(
            <BrowserRouter>
                <PasswordGenerator />
            </BrowserRouter>
        );
        const slider = screen.getByRole('slider');
        fireEvent.change(slider, { target: { value: 20 } });
        expect(generateRandomPassword).toHaveBeenCalledWith(20, expect.any(Object));
    });

    it('should toggle options', () => {
        render(
            <BrowserRouter>
                <PasswordGenerator />
            </BrowserRouter>
        );
        const symbolsCheckbox = screen.getByText('Symbols');
        fireEvent.click(symbolsCheckbox);
        expect(generateRandomPassword).toHaveBeenCalled();
    });
});
