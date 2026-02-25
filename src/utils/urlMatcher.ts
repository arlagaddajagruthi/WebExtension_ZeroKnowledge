// URL matching utilities for credential lookup
// Handles domain extraction, subdomain normalization, and URL matching

/**
 * List of equivalent domains that share the same credentials
 * Examples: sbi.co.in and onlinesbi.sbi, or google.com and youtube.com
 */
const EQUIVALENT_DOMAIN_GROUPS: string[][] = [
    ['sbi.co.in', 'onlinesbi.sbi', 'onlinesbi.com', 'statebankofindia.com', 'scgi.sbi'],
    ['google.com', 'youtube.com', 'gmail.com', 'accounts.google.com'],
    ['microsoft.com', 'live.com', 'outlook.com', 'hotmail.com'],
    ['apple.com', 'icloud.com'],
    ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de'],
    ['facebook.com', 'messenger.com', 'instagram.com']
];

/**
 * Extract the base registrable domain from a URL
 * Handles common multi-level TLDs like .co.in, .org.uk
 */
export function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();

        // Handle localhost and IP addresses
        if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
            return hostname;
        }

        // Remove www. prefix
        const withoutWww = hostname.replace(/^www\./, '');

        // Extract base domain (handle subdomains)
        const parts = withoutWww.split('.');

        if (parts.length <= 2) {
            return withoutWww;
        }

        // Common second-level TLDs
        const secondLevelTlds = ['co', 'gov', 'org', 'edu', 'net', 'ac', 'res'];
        const tld = parts[parts.length - 1];
        const sld = parts[parts.length - 2];

        // If it's a multi-level TLD (like .co.in), take 3 parts
        if (secondLevelTlds.includes(sld) && tld.length <= 3) {
            return parts.slice(-3).join('.');
        }

        // Otherwise take 2 parts
        return parts.slice(-2).join('.');
    } catch (error) {
        console.error('Error extracting domain:', error);
        return url;
    }
}

/**
 * Check if two domains are in the same equivalent group
 */
function areEquivalent(domain1: string, domain2: string): boolean {
    if (domain1 === domain2) return true;

    for (const group of EQUIVALENT_DOMAIN_GROUPS) {
        const d1InGroup = group.some(d => d === domain1 || domain1.endsWith('.' + d));
        const d2InGroup = group.some(d => d === domain2 || domain2.endsWith('.' + d));

        if (d1InGroup && d2InGroup) return true;
    }

    return false;
}

/**
 * Check if a saved URL matches the current URL
 * Matches based on base domain and equivalent domain groups
 */
export function matchURL(savedURL: string, currentURL: string): boolean {
    try {
        const savedDomain = extractDomain(savedURL);
        const currentDomain = extractDomain(currentURL);

        return areEquivalent(savedDomain, currentDomain);
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
