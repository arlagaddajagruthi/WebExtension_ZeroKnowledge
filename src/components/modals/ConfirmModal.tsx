import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    isDestructive = false,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-background rounded-lg shadow-lg w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-border">
                <div className="p-4 border-b border-border flex justify-between items-center">
                    <h3 className="font-semibold flex items-center gap-2">
                        {isDestructive && <AlertTriangle className="w-4 h-4 text-destructive" />}
                        {title}
                    </h3>
                    <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-4">
                    <p className="text-sm text-muted-foreground">{message}</p>
                </div>
                <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={isDestructive ? 'destructive' : 'primary'}
                        size="sm"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
