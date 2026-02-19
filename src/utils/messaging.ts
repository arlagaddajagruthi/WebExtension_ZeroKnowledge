// Type-safe Chrome messaging utilities

export const MessageType = {
    // Content Script → Background
    FORM_DETECTED: 'FORM_DETECTED',
    FORM_SUBMITTED: 'FORM_SUBMITTED',
    REQUEST_CREDENTIALS: 'REQUEST_CREDENTIALS',

    // Background → Content Script
    CREDENTIALS_FOUND: 'CREDENTIALS_FOUND',
    SHOW_SAVE_PROMPT: 'SHOW_SAVE_PROMPT',
    SHOW_UPDATE_PROMPT: 'SHOW_UPDATE_PROMPT',

    // Bidirectional
    SAVE_CREDENTIAL: 'SAVE_CREDENTIAL',
    UPDATE_CREDENTIAL: 'UPDATE_CREDENTIAL',
    AUTOFILL_CREDENTIAL: 'AUTOFILL_CREDENTIAL',
    SET_SESSION_KEY: 'SET_SESSION_KEY',
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
