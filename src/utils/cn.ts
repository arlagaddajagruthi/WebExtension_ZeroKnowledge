/**
 * cn.ts
 * 
 * Utility function for conditionally joining class names.
 * Primarily used for cleaning up Tailwind CSS class strings in React components.
 */
export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}