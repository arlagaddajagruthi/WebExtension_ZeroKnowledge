import React, { useEffect } from 'react';
import { cn } from './index';
import { X, Check, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    onClose: () => void;
    duration?: number;
}

export const Toast = ({ message, type = 'info', onClose, duration = 3000 }: ToastProps) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const icons = {
        success: <Check className="w-4 h-4 text-emerald-500" />,
        error: <AlertCircle className="w-4 h-4 text-destructive" />,
        info: <Info className="w-4 h-4 text-blue-500" />
    };

    const styles = {
        success: "border-emerald-200 bg-emerald-50",
        error: "border-red-200 bg-red-50",
        info: "border-blue-200 bg-blue-50"
    };

    return (
        <div className={cn(
            "fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border min-w-[280px] animate-in fade-in slide-in-from-bottom-5 duration-300",
            styles[type]
        )}>
            <div className="shrink-0">
                {icons[type]}
            </div>
            <p className="text-sm font-medium text-gray-800 flex-1">{message}</p>
            <button
                onClick={onClose}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
