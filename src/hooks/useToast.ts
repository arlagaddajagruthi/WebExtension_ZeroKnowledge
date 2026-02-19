import { useState, useCallback } from 'react';

interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const useToast = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = crypto.randomUUID();
        const toast = { id, message, type };

        setToasts((prev) => [...prev, toast]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    return { toasts, showToast };
};
