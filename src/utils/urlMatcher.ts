// URL matching utilities for credential lookup
// Handles domain extraction, subdomain normalization, and URL matching

/**
 * Extract the base domain from a URL
 * Examples:
 *   https://login.github.com/signin → github.com
 *   https://www.google.com/accounts → google.com
 *   http://localhost:3000 → localhost
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Handle localhost and IP addresses
        if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return hostname;
        }

        // Remove www. prefix
        const withoutWww = hostname.replace(/^www\./, '');

        // Extract base domain (handle subdomains)
        const parts = withoutWww.split('.');

        // For domains like login.github.com, get github.com
        // For domains like co.uk, keep full domain
        if (parts.length >= 2) {
            return parts.slice(-2).join('.');
        }

        return withoutWww;
    } catch (error) {
        console.error('Error extracting domain:', error);
        return url;
    }
}

/**
 * Check if a saved URL matches the current URL
 * Matches based on base domain, ignoring subdomains and paths
 */
export function matchURL(savedURL: string, currentURL: string): boolean {
    try {
        const savedDomain = extractDomain(savedURL);
        const currentDomain = extractDomain(currentURL);
        return savedDomain === currentDomain;
    } catch (error) {
        console.error('Error matching URLs:', error);
        return false;
    }
}

/**
 * Normalize a URL for storage
 * Removes protocol, www, and trailing slashes
 */
export function normalizeURL(url: string): string {
    try {
        const urlObj = new URL(url);
        let normalized = urlObj.hostname;

        // Remove www.
        normalized = normalized.replace(/^www\./, '');

        // Add path if it's not just /
        if (urlObj.pathname && urlObj.pathname !== '/') {
            normalized += urlObj.pathname;
        }

        // Remove trailing slash
        normalized = normalized.replace(/\/$/, '');

        return normalized;
    } catch (error) {
        console.error('Error normalizing URL:', error);
        return url;
    }
}

/**
 * Get the display name for a URL
 * Examples:
 *   https://github.com/login → GitHub
 *   https://accounts.google.com → Google
 */
export function getDisplayName(url: string): string {
    try {
        const domain = extractDomain(url);
        const name = domain.split('.')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    } catch (error) {
        return url;
    }
}

/**
 * Check if a URL should be blacklisted (never save passwords)
 * Add sensitive sites like banks, government sites, etc.
 */
export function isBlacklisted(url: string): boolean {
    const blacklist: string[] = [
        // Add sensitive domains here
        // 'bankofamerica.com',
        // 'chase.com',
    ];

    const domain = extractDomain(url);
    return blacklist.some((blocked: string) => domain.includes(blocked));
}
