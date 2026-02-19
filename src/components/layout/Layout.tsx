import React from 'react';
import { cn } from '../../components/ui';

interface LayoutProps {
    children: React.ReactNode;
    className?: string;
    fullHeight?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, className, fullHeight = true }) => {
    return (
        <div className={cn(
            "flex flex-col bg-background text-foreground",
            fullHeight && "h-screen max-h-[600px]", // Constrain height for extension popup
            className
        )}>
            {children}
        </div>
    );
};

export const Header: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <header className={cn("p-4 border-b bg-card sticky top-0 z-10", className)}>
        {children}
    </header>
);

export const Content: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <main className={cn("flex-1 overflow-y-auto p-4 space-y-4", className)}>
        {children}
    </main>
);

export const Footer: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <footer className={cn("border-t bg-card p-2", className)}>
        {children}
    </footer>
);

export default Layout;
