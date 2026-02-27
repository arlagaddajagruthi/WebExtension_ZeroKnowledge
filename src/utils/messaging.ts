// Type-safe Chrome messaging utilities

export const MessageType = {
    // Vault operations
    GET_VAULT_STATUS: 'GET_VAULT_STATUS',
    UNLOCK_VAULT: 'UNLOCK_VAULT',
    SAVE_CREDENTIAL: 'SAVE_CREDENTIAL',
    UPDATE_CREDENTIAL: 'UPDATE_CREDENTIAL',
    REQUEST_CREDENTIALS: 'REQUEST_CREDENTIALS',
    DELETE_CREDENTIAL: 'DELETE_CREDENTIAL',
    
    // Form detection and submission
    FORM_DETECTED: 'FORM_DETECTED',
    FORM_SUBMITTED: 'FORM_SUBMITTED',
    
    // Save prompt (handle redirects)
    GET_PENDING_SAVE_PROMPT: 'GET_PENDING_SAVE_PROMPT',
    
    // OTP for autofill
    REQUEST_AUTOFILL_OTP: 'REQUEST_AUTOFILL_OTP',
    VERIFY_AUTOFILL_OTP: 'VERIFY_AUTOFILL_OTP',
    
    // Master password verification for autofill
    VERIFY_MASTER_PASSWORD: 'VERIFY_MASTER_PASSWORD',
    VERIFY_AUTOFILL: 'VERIFY_AUTOFILL',
    
    // Unlock via popup (for saving credentials from webpage)
    REQUEST_UNLOCK_FOR_SAVE: 'REQUEST_UNLOCK_FOR_SAVE',
    UNLOCK_AND_SAVE_CREDENTIAL: 'UNLOCK_AND_SAVE_CREDENTIAL',
    GET_PENDING_UNLOCK_SAVE: 'GET_PENDING_UNLOCK_SAVE',
} as const;

export type MessageTypeValue = typeof MessageType[keyof typeof MessageType];

export interface FormData {
    url: string;
    username: string;
    password: string;
    usernameField?: string;
    passwordField?: string;
}

export interface Message {
    type: MessageTypeValue;
    data?: any;
    tabId?: number;
}

/**
 * Send a message from content script to background script
 */
export async function sendToBackground<T = any>(
    type: MessageTypeValue,
    data?: any
): Promise<T> {
    return new Promise((resolve, reject) => {
        // Check if extension context is valid
        if (!chrome.runtime?.id) {
            reject(new Error('Extension context invalidated'));
            return;
        }
        
        chrome.runtime.sendMessage({ type, data }, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Send a message from background to content script
 */
export async function sendToTab<T = any>(
    tabId: number,
    type: MessageTypeValue,
    data?: any
): Promise<T> {
    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, { type, data }, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

/**
 * Listen for messages (use in background or content script)
 */
export function onMessage(
    callback: (
        message: Message,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void
    ) => void | boolean
) {
    chrome.runtime.onMessage.addListener(callback);
}
