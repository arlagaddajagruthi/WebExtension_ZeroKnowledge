import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge tailwind classes safely
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
    size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'default', ...props }, ref) => {
        const variants = {
            primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
            secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
            ghost: 'hover:bg-accent hover:text-accent-foreground',
            destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        };

        const sizes = {
            default: 'h-10 px-4 py-2',
            sm: 'h-8 rounded-md px-3 text-xs',
            lg: 'h-11 rounded-md px-8',
            icon: 'h-9 w-9',
        };

        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
                    variants[variant],
                    sizes[size],
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
Input.displayName = 'Input';

export const Card = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
        {...props}
    >
        {children}
    </div>
);

export const Label = ({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label
        className={cn(
            'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-opacity-70',
            className
        )}
        {...props}
    >
        {children}
    </label>
);

export * from './Toast';
