# ZeroVault: Complete Security Engineer Architecture Design

## Executive Summary

This document defines the complete technical architecture for ZeroVault, a Manifest V3 Chrome Extension implementing a **zero-knowledge password manager** with client-side encryption, multi-device sync, and offline-first capabilities.

**Design Principle**: No plaintext data ever leaves the client. The server cannot decrypt credentials.

---

## 1. Overall System Architecture

### 1.1 Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   CHROME BROWSER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐   │
│  │           EXTENSION SANDBOX                            │   │
│  │                                                         │   │
│  │  ┌──────────────────┐        ┌─────────────────────┐  │   │
│  │  │  manifest.json   │        │  popup.html         │  │   │
│  │  │  ├─ Permissions  │        │  (380x600px UI)     │  │   │
│  │  │  ├─ Scripts      │        │  ├─ Login           │  │   │
│  │  │  └─ Icons        │        │  ├─ Register        │  │   │
│  │  └──────────────────┘        │  ├─ Vault           │  │   │
│  │                               │  ├─ Settings        │  │   │
│  │  ┌──────────────────────┐    │  └─ Sync Status     │  │   │
│  │  │ Background Script    │    └─────────────────────┘  │   │
│  │  │ (service-worker.js)  │                              │   │
│  │  │ ├─ Session Manager   │    ┌─────────────────────┐  │   │
│  │  │ ├─ Message Router    │    │  options.html       │  │   │
│  │  │ ├─ Storage Manager   │    │  (Dashboard)        │  │   │
│  │  │ ├─ Sync Coordinator  │    └─────────────────────┘  │   │
│  │  │ └─ Auto-lock Timer   │                              │   │
│  │  └──────────────────────┘                              │   │
│  │           ▲                                             │   │
│  │           │ chrome.runtime.sendMessage                 │   │
│  │           │ chrome.storage.local/session               │   │
│  │           │ chrome.alarms                              │   │
│  │           │                                             │   │
│  │  ┌────────┴──────────────────────────────────────┐    │   │
│  │  │    Content Scripts (Injected in Pages)        │    │   │
│  │  │                                                │    │   │
│  │  │  ┌────────────────────────────────────────┐  │    │   │
│  │  │  │ Form Detection Engine                  │  │    │   │
│  │  │  │ ├─ Detect login forms                  │  │    │   │
│  │  │  │ ├─ Identify username/password fields   │  │    │   │
│  │  │  │ ├─ Monitor form submissions            │  │    │   │
│  │  │  │ └─ Handle dynamic form injection       │  │    │   │
│  │  │  └────────────────────────────────────────┘  │    │   │
│  │  │                                                │    │   │
│  │  │  ┌────────────────────────────────────────┐  │    │   │
│  │  │  │ Secure Injection Engine                │  │    │   │
│  │  │  │ ├─ Autofill credentials                │  │    │   │
│  │  │  │ ├─ DOM mutation prevention             │  │    │   │
│  │  │  │ └─ Secure clipboard handling           │  │    │   │
│  │  │  └────────────────────────────────────────┘  │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        LOCAL STORAGE                                │  │
│  │  (chrome.storage.local - Encrypted Vault)           │  │
│  │  ├─ Encrypted Credentials                           │  │
│  │  ├─ Master Password Hash + Salt                     │  │
│  │  ├─ Device ID & Sync Metadata                       │  │
│  │  └─ Offline Transaction Queue                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        SESSION STORAGE                              │  │
│  │  (chrome.storage.session - Session Keys)            │  │
│  │  ├─ Decrypted AES Key (volatile)                    │  │
│  │  └─ Session Token (auto-cleared on extension close) │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
        ┌───────▼──────┐ ┌──▼──────┐ ┌─▼────────┐
        │ Backend API  │ │ HIBP    │ │ NTP      │
        │ (Supabase)   │ │ (Breach)│ │ (Time)   │
        │              │ │         │ │          │
        │ ├─ Auth      │ │ └─ k-   │ │ └─ Clock │
        │ ├─ Sync      │ │   anon  │ │   verify │
        │ ├─ Metadata  │ │   hash  │ │          │
        │ └─ Logging   │ │ checks  │ │          │
        └──────────────┘ └─────────┘ └──────────┘
```

### 1.2 Manifest V3 Configuration

**manifest.json** defines:
- **Permissions**: storage, webRequest, activeTab, scripting, alarms
- **Service Worker**: background.ts (no DOM access, runs in background)
- **Content Scripts**: Run in isolated context on web pages
- **Host Permissions**: Matches patterns for autofill
- **Icons**: 16x16, 48x48, 128x128
- **Action**: Default popup (popup.html, 380x600px)

**Key Security Configuration**:
```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",          // Local + Session storage
    "alarms",           // Auto-lock timer
    "webRequest",       // Monitor network (audit)
    "activeTab",        // Get current tab
    "scripting"         // Inject form detection
  ],
  "host_permissions": [
    "<all_urls>"        // Autofill everywhere
  ],
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"],
      "all_frames": true,
      "run_at": "document_start"
    }
  ]
}
```

### 1.3 Component Responsibilities

| Component | Responsibility | Key Functions |
|-----------|---|---|
| **Manifest** | Extension metadata & permissions | Defines runtime environment |
| **Popup UI** | User interface | Login, vault management, settings |
| **Background** | Core logic & coordination | Encryption, session management, sync |
| **Content Script** | Page interaction | Form detection, autofill |
| **Local Storage** | Persistent encrypted data | Vault, hashes, metadata |
| **Session Storage** | Volatile session data | Decrypted key, session token |

---

## 2. Complete User Workflow

### 2.1 Registration Workflow

```
USER                    POPUP               BACKGROUND           LOCAL STORAGE
 │                       │                      │                      │
 ├─ Click "Register"     │                      │                      │
 │                       │                      │                      │
 ├────── Email ─────────>│                      │                      │
 │       Password        │                      │                      │
 │                       │                      │                      │
 │                       ├─ Validate input ────>│                      │
 │                       │                      │                      │
 │                       │   ┌─ Generate salt   │                      │
 │                       │   ├─ PBKDF2(pass)    │                      │
 │                       │   └─ Hash = SHA256   │                      │
 │                       │<─ Return (hash,salt) │                      │
 │                       │                      │                      │
 │                       ├─ Submit to backend ─────────────────────────>
 │                       │                      │
 │                       │  ┌─ Create JWT token
 │                       │  └─ User ID assigned
 │                       │<─ Auth successful
 │                       │                      │
 │                       ├─ Save hash + salt ──────────────────────────>
 │                       │  (encrypted)         │                      │
 │                       │                      │                      │
 │                       ├─ Initialize vault ──>│                      │
 │                       │                      │ (empty, encrypted)   │
 │                       │<─────────────────────┤                      │
 │<─ Show "Register OK"  │                      │                      │
 │   Redirect to login   │                      │                      │
```

**Step 1: Input Validation**
```
Input: email, password, passwordConfirm
Checks:
  ✓ Email format valid (RFC 5321)
  ✓ Password >= 12 characters
  ✓ Passwords match
  ✓ Not in common password list
Result: Error or proceed
```

**Step 2: Master Key Derivation** (ZERO-KNOWLEDGE POINT)
```
Input: password, (generate random salt)
Algorithm: PBKDF2-SHA256
  - Iterations: 100,000
  - Salt: 16 bytes random
  - Output: 256-bit key
Result: masterKey (never sent to server)
```

**Step 3: Backend Registration**
```
Send to Supabase:
  {
    email: "user@example.com",
    password: "random-session-password",  // For account, not vault
    userAgent: navigator.userAgent
  }

Receive:
  {
    userId: "uuid-string",
    sessionToken: "jwt-token",
    deviceId: "device-uuid"
  }
```

**Step 4: Local Vault Initialization**
```
Create empty vault:
  {
    credentials: [],
    metadata: {
      createdAt: timestamp,
      version: 1,
      deviceId: "device-uuid"
    }
  }

Encrypt with masterKey and save to chrome.storage.local
```

### 2.2 Login Workflow

```
USER                    POPUP               BACKGROUND           STORAGE
 │                       │                      │                      │
 ├─ Click "Login"        │                      │                      │
 │                       │                      │                      │
 ├─ Email ──────────────>│                      │                      │
 │  Password             │                      │                      │
 │                       │                      │                      │
 │                       ├─ Send to backend ────────────────────────────>
 │                       │                      │
 │                       │<─────────────────────── JWT + Device info
 │                       │                      │
 │                       │  ┌─ Retrieve salt    │
 │                       │<──────────────────────── (from local storage)
 │                       │                      │
 │                       ├─ PBKDF2(password) ──>│
 │                       │  + salt              │
 │                       │<─ masterKey (256-bit)
 │                       │                      │
 │                       ├─ Decrypt vault ─────>│
 │                       │                      │ ┌─ Load encrypted vault
 │                       │                      │ ├─ Decrypt all creds
 │                       │                      │ └─ Verify MAC
 │                       │<─ Credentials       │ (or show error)
 │                       │                      │
 │                       ├─ Save masterKey in ─────────────────────────>
 │                       │  chrome.storage.    │   (SESSION ONLY)
 │                       │  session            │
 │                       │                      │
 │<─ Show Vault           │                      │                      │
 │   (Unlocked)          │                      │                      │
```

**Step 1: Account Authentication** (ZERO-KNOWLEDGE)
```
Input: email, account_password
Send to Supabase:
  POST /auth/v1/token
  {
    email: "user@example.com",
    password: "account_password"
  }

Response:
  {
    access_token: "jwt-string",
    session: {
      user: {
        id: "user-id",
        email: "user@example.com"
      }
    }
  }

Note: This is account authentication, NOT vault decryption
```

**Step 2: Retrieve Master Password Salt**
```
Retrieve from chrome.storage.local:
  - masterPasswordSalt (public, stored in plaintext)
  - masterPasswordHash (stored encrypted)

If not found: Error "Account not registered on this device"
```

**Step 3: Derive Master Key**
```
Input: user_provided_master_password, salt_from_storage
Algorithm: PBKDF2-SHA256
  iterations: 100000
  hash: "SHA-256"
Output: masterKey (256 bits)

Validation:
  - Hash(masterKey) === masterPasswordHash
  - If not: Show error "Wrong master password"
```

**Step 4: Decrypt Vault**
```
Retrieve from chrome.storage.local:
  {
    encryptedVault: "base64-ciphertext",
    vaultVersion: 1,
    lastSyncedAt: timestamp
  }

Decrypt using masterKey:
  Algorithm: AES-256-GCM
  Result: Plain JSON vault

If decryption fails: 
  - Show "Vault corrupted - recover from backup?"
```

**Step 5: Save Session Key** (VOLATILE)
```
Save to chrome.storage.session:
  {
    masterKey: masterKey,
    sessionToken: sessionToken,
    sessionExpiry: Date.now() + 24*60*60*1000
  }

Note: This is VOLATILE and cleared when extension closes
```

### 2.3 Vault Unlock/Lock Workflow

**UNLOCK**:
```
User enters master password
  ↓
PBKDF2 derivation
  ↓
Verify against masterPasswordHash
  ↓
If valid: Load masterKey to chrome.storage.session
  ↓
Set isLocked = false
  ↓
Show decrypted credentials
```

**AUTO-LOCK**:
```
Set alarm: chrome.alarms.create('autoLock', {delayInMinutes: 15})
  ↓
On user interaction: Clear alarm, reschedule
  ↓
On alarm trigger:
  - Clear chrome.storage.session (masterKey deleted)
  - Set isLocked = true
  - Hide credentials from UI
  ↓
Next access: Requires master password again
```

**MANUAL LOCK**:
```
User clicks "Lock Vault"
  ↓
Clear chrome.storage.session
  ↓
Set isLocked = true
  ↓
Clear all decrypted data from memory
```

**LOGOUT**:
```
User clicks "Logout"
  ↓
Clear chrome.storage.session (masterKey, token)
  ↓
Clear vault from memory
  ↓
Clear all UI state
  ↓
Redirect to login screen
```

---

## 3. Credential Management Workflow

### 3.1 Adding New Credentials

```
USER                POPUP               BACKGROUND           LOCAL STORAGE
 │                   │                      │                      │
 ├─ Click "Add"      │                      │                      │
 │                   │                      │                      │
 │                   ├─ Show form ──────────>│                      │
 │                   │ (URL, username,       │                      │
 │                   │  password, notes)     │                      │
 │                   │                      │                      │
 ├─ Enter data ──────>│                      │                      │
 │                   │                      │                      │
 │                   ├─ Validate (URL regex)>│                      │
 │<─ Show error or ───│                      │                      │
 │   confirm          │                      │                      │
 │                   │                      │                      │
 │ ├─ Confirm        │                      │                      │
 │ │                 │                      │                      │
 │                   ├─ Create credential ──>│                      │
 │                   │ object with:          │                      │
 │                   │  - id (UUID)          │                      │
 │                   │  - created (now)      │                      │
 │                   │  - version (1)        │                      │
 │                   │  - lastModified       │                      │
 │                   │  - deviceId           │                      │
 │                   │                      │                      │
 │                   │  ┌─ Add to vault
 │                   │  ├─ Encrypt vault
 │                   │  └─ Save to storage   │                      │
 │                   │<─ Credential added ───── (encrypted, new hash)
 │                   │                      │                      │
 │<─ Show success ────│                      │                      │
 │   Sync prompt      │                      │                      │
 │                   │                      │                      │
 ├─ "Sync Now" ──────>│                      │                      │
 │                   │                      │                      │
 │                   ├─────── SYNC WORKFLOW (See Section 5) ──────>
```

**Step 1: Form Validation**
```
Field          Validation
url            Regex: https?://.*
username       Max 512 chars
password       Max 1024 chars
notes          Max 4096 chars
customFields   Max 10 fields

Validation errors stop submission
Success: Create credential object
```

**Step 2: Generate Credential ID & Metadata**
```
New credential object:
{
  id: crypto.randomUUID(),
  url: "https://example.com/login",
  username: "user@example.com",
  password: "SecurePassword123!",
  notes: "Personal account",
  customFields: {},
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  version: 1,
  deviceId: "this-device-id",
  tags: ["email", "personal"]
}
```

**Step 3: Update Vault in Memory**
```
Current vault in chrome.storage.session:
{
  credentials: [...existing]
}

↓

vault.credentials.push(newCredential)
```

**Step 4: Encrypt & Persist**
```
Vault JSON:
{
  credentials: [
    { id, url, username, password, ... },
    { id, url, username, password, ... }
  ],
  metadata: {
    version: 1,
    lastSynced: timestamp,
    deviceId: "device-id"
  }
}

↓

Encrypt with AES-256-GCM:
  Algorithm: AES-256-GCM
  Key: masterKey (from session)
  IV: crypto.getRandomValues(12 bytes)
  AAD: (optional: version number)
  
Result: encryptedVault (base64 string)

↓

Save to chrome.storage.local:
{
  vault: encryptedVault,
  vaultHash: SHA256(encryptedVault),  // Integrity check
  vaultVersion: 2,
  lastModified: timestamp,
  pendingSync: true
}
```

### 3.2 Editing Credentials

```
USER                POPUP               BACKGROUND           LOCAL STORAGE
 │                   │                      │                      │
 ├─ Click credential │                      │                      │
 │                   │                      │                      │
 │<─ Show details ────│                      │                      │
 │   with edit button │                      │                      │
 │                   │                      │                      │
 ├─ Click "Edit"     │                      │                      │
 │                   │                      │                      │
 │<─ Show form ───────│                      │                      │
 │   (prefilled)      │                      │                      │
 │                   │                      │                      │
 ├─ Modify fields ───>│                      │                      │
 │                   │                      │                      │
 │                   ├─ Validate ───────────>│                      │
 │<─ Show error ──────│                      │                      │
 │   or confirm       │                      │                      │
 │                   │                      │                      │
 ├─ Confirm         │                      │                      │
 │                   │                      │                      │
 │                   ├─ Update credential ──>│                      │
 │                   │ (keep id, update      │                      │
 │                   │  timestamp, version++)│                      │
 │                   │                      │                      │
 │                   │  ┌─ Update in vault
 │                   │  ├─ Re-encrypt vault
 │                   │  └─ Save to storage   │                      │
 │                   │<─ Updated ────────────── (new version, hash)
 │                   │                      │                      │
 │<─ Show success ────│                      │                      │
```

**Key Points**:
- `id` stays same (immutable identifier)
- `modifiedAt` updated to now
- `version` incremented (for sync conflict resolution)
- `deviceId` = this device
- Entire vault re-encrypted
- Old encrypted vault discarded

### 3.3 Deleting Credentials

```
Method: SOFT DELETE (for sync)

Delete flow:
  1. Mark credential: deleted = true, deletedAt = now
  2. Keep credential in vault (for sync tracking)
  3. Filter from UI display
  4. On sync: Send deletion to server
  5. On server sync: Remove if all devices deleted

Alternative: HARD DELETE (local only)
  - Remove immediately from vault
  - Cannot recover on other devices
  - Use only if never synced
```

---

## 4. Autofill Workflow

### 4.1 Form Detection Process

**Content Script runs on EVERY page load**:

```
Page Load (DOMContentLoaded)
  ↓
Query DOM for login forms:
  - <form> with password input
  - OR <input type="password">
  - OR aria-label="password"
  ↓
For each form found:
  1. Check if form is visible (not hidden by CSS)
  2. Find username field:
     - <input type="email">
     - <input type="text"> with name="username|email|login"
     - <input> with aria-label containing "email|user"
  3. Find password field:
     - <input type="password">
  4. Find submit button:
     - <button type="submit">
     - <input type="submit">
  5. Store form reference + field positions
  ↓
Report forms to background: chrome.runtime.sendMessage({
  type: 'FORMS_DETECTED',
  forms: [
    {
      id: form_instance_id,
      url: window.location.href,
      usernameField: reference,
      passwordField: reference,
      submitButton: reference,
      isSuspicious: is_phishing_detector()
    }
  ]
})
```

### 4.2 Credential Matching

```
Content Script detects form → Sends to Background

Background receives:
  {
    url: "https://example.com/login",
    forms: [...]
  }

Background logic:
  1. Parse URL: Extract domain
  2. Query vault:
     - Get all credentials with matching domain
     - Match algorithm:
       * Exact match: url === credentialUrl
       * Domain match: credentialUrl includes domain
       * Partial match: credentialUrl contains first path segment
  3. If matches found:
     - Send to content script: 'CREDENTIALS_AVAILABLE'
     - Include: username, masked password
  4. If no matches:
     - Send: 'NO_CREDENTIALS_FOUND'
     - Allow manual entry
```

### 4.3 Secure Injection

```
User clicks autofill UI button
  ↓
Content Script requests decrypted credential
  ↓
Background:
  1. Verify session key still valid
  2. Decrypt requested credential from vault
  3. Send ONLY to content script (never to page script)
  ↓
Content Script:
  1. Receive credential (encrypted in transit)
  2. Decrypt locally (browser level, not JS level)
  3. Inject into password field:
     - Set .value property (not textContent)
     - Trigger 'input' + 'change' events (for JS frameworks)
  4. Clear credential from memory immediately
  5. Clear clipboard after 30 seconds
  ↓
Form ready for submission
```

**Injection Code Pattern**:
```javascript
// In content script
const credential = await requestCredential(credentialId);

// Inject username
usernameField.value = credential.username;
usernameField.dispatchEvent(new Event('input', {bubbles: true}));
usernameField.dispatchEvent(new Event('change', {bubbles: true}));

// Inject password
passwordField.value = credential.password;
passwordField.dispatchEvent(new Event('input', {bubbles: true}));
passwordField.dispatchEvent(new Event('change', {bubbles: true}));

// Clear from memory
credential.password = '';
credential = null;
```

### 4.4 Form Submission Detection

```
Monitor page for form submission:

Method 1: Submit event listener
  form.addEventListener('submit', (e) => {
    Extract username + password from fields
    Send to background: 'FORM_SUBMITTED'
  })

Method 2: Navigation detection
  window.addEventListener('beforeunload', () => {
    If form has changes: 'FORM_SUBMITTED'
  })

Background receives submission:
  {
    url: "https://example.com/login",
    username: "user@example.com",
    password: "NewPasswordIfChanged",
    action: "SAVE_PROMPT" | "UPDATE_PROMPT" | "IGNORE"
  }

Action determination:
  - SAVE_PROMPT: New credential, ask user
  - UPDATE_PROMPT: Credential exists, password changed
  - IGNORE: Credential matches existing, no action
```

---

## 5. Multi-Device Sync Workflow

### 5.1 Overall Sync Architecture

```
DEVICE A                DEVICE B              SYNC SERVER           DATABASE
(User editing)          (User checking)       (Coordinator)         (Encrypted)
  │                       │                      │                      │
  ├─ Add credential A     │                      │                      │
  │  (v1)                 │                      │                      │
  │                       │                      │                      │
  ├─ Encrypt vault ──────>│                      │                      │
  │                       │                      │                      │
  │                       ├─ Queue for sync     │                      │
  │                       │  (background job)   │                      │
  │                       │                      │                      │
  │                       │                      ├─ POST /sync/push ───>
  │                       │                      │ (encrypted vault)    │
  │                       │                      │                      │
  │                       │                      │                      ├─ Store
  │                       │                      │                      │  encrypted
  │                       │                      │                      │  vault
  │                       │                      │                      │
  │                       │                      │<─ Return success ────┤
  │                       │                      │                      │
  │                       │    ┌─ Sync signal   │                      │
  │                       │    └─ via WebSocket │                      │
  │                       │                      │                      │
  │                       ├─ GET /sync/pull ───>│                      │
  │                       │ (since lastSync)    │                      │
  │                       │                      │                      ├─ Query
  │                       │                      │                      │  newer
  │                       │                      │                      │  versions
  │                       │                      │                      │
  │                       │                      │<─ Return encrypted ──┤
  │                       │                      │   changes            │
  │                       │                      │                      │
  │                       ├─ Merge changes      │                      │
  │                       │  (conflict res.)    │                      │
  │                       │                      │                      │
  │                       ├─ Decrypt changes    │                      │
  │                       │  with masterKey     │                      │
  │                       │                      │                      │
  │                       ├─ Merge locally:     │                      │
  │                       │  - New creds: add   │                      │
  │                       │  - Updated: merge   │                      │
  │                       │  - Deleted: remove  │                      │
  │                       │                      │                      │
  │                       ├─ Re-encrypt vault   │                      │
  │                       │ (with new version)  │                      │
  │                       │                      │                      │
  │<─ Sync complete ──────│<─ Notification ─────┤                      │
```

### 5.2 Upload/Push Sync

```
USER TRIGGERS SYNC (or automatic timer)
  ↓
Background check:
  1. Is masterKey in session? (If not, skip)
  2. Is there pending changes? (Check pendingSync flag)
  3. Is device online? (Check navigator.onLine)
  ↓
If ready:
  1. Retrieve encrypted vault from chrome.storage.local
  2. Create sync payload:
     {
       deviceId: "device-uuid",
       timestamp: Date.now(),
       vaultVersion: 2,
       encryptedVault: base64_string,
       changes: [  // For incremental sync
         {
           credentialId: "uuid",
           action: "created|updated|deleted",
           version: 2,
           timestamp: Date.now()
         }
       ]
     }
  3. Sign payload: HMAC-SHA256(payload, sessionToken)
  4. POST to backend:
     POST /api/vault/sync/push
     Headers: Authorization: Bearer {sessionToken}
     Body: payload
  ↓
Server processing:
  1. Verify signature
  2. Verify timestamp (not older than 1 hour)
  3. Check version number:
     - If version < server.version: CONFLICT
     - If version == server.version: Update
     - If version > server.version: ERROR
  4. Store encrypted vault (server cannot decrypt)
  5. Index metadata for efficient retrieval
  ↓
Response:
  {
    success: true,
    serverVersion: 3,
    conflictDetected: false,
    nextSyncTime: timestamp + 1 hour
  }
  ↓
Client updates:
  - Set pendingSync = false
  - Update lastSyncTime
  - Schedule next sync
```

### 5.3 Download/Pull Sync

```
Check if new data available:
  1. On device B: Ask server for updates since lastSync
  2. POST /api/vault/sync/pull
     {
       lastSyncVersion: 2,
       lastSyncTime: timestamp
     }
  ↓
Server response:
  - If no new changes: Return empty []
  - If changes exist:
    {
      changes: [
        {
          credentialId: uuid,
          action: "created|updated|deleted",
          version: 3,
          encryptedData: "...",
          timestamp: Date.now(),
          deviceId: "device-A-id"
        }
      ],
      newVersion: 3
    }
  ↓
Client processes:
  For each change:
    1. Determine action (create/update/delete)
    2. If UPDATE/CREATE: Encrypted data provided, merge into vault
    3. If DELETE: Mark credential as deleted (soft delete)
  ↓
Conflict Resolution:
  - Compare timestamps:
    * If deviceA.timestamp > deviceB.timestamp: Use A's version
    * If equal: Use alphabetically first deviceId (deterministic)
  - Update version numbers accordingly
  ↓
Merge vault:
  1. Load current vault from storage
  2. Apply changes in order (oldest to newest)
  3. Re-encrypt entire vault with masterKey
  4. Save with new version number
  ↓
Update metadata:
  - lastSyncTime = now
  - lastSyncVersion = server.version
```

### 5.4 Conflict Resolution Strategy

**LAST-WRITE-WINS (LWW) Algorithm**:

```
When two devices modify same credential:

Device A:
  modifiedAt: 1704067200000
  version: 2
  password: "OldPassword"

Device B (simultaneously):
  modifiedAt: 1704067210000  (10 seconds later)
  version: 2
  password: "NewPassword"

Conflict resolution:
  if (A.modifiedAt > B.modifiedAt) → Use A
  else → Use B
  
Result: Use B's version (newer timestamp)
Apply: password = "NewPassword"
Final version: 3
```

**CUSTOM FIELD MERGE**:
```
If conflict is in optional fields (notes, tags):

Device A: { notes: "Personal" }
Device B: { tags: ["email"] }

Merge result: { notes: "Personal", tags: ["email"] }
No conflict—both changes preserved
```

**CASCADE DELETE**:
```
If Device A deletes credential, Device B modified it:

Device A timestamp: 1704067200
Device B timestamp: 1704067150 (earlier)

Since A is newer: Credential deleted across all devices
(Deletion propagates to all devices on next sync)
```

### 5.5 Offline Mode

**Offline Operation**:
```
Check navigator.onLine:
  if (offline) {
    • Can still view credentials (cached in memory)
    • Can edit credentials (queued locally)
    • Cannot sync until online
    • Cannot access new changes from other devices
  }

Queue operations:
  - All changes stored in chrome.storage.local.syncQueue
  - Each operation: { action, credentialId, timestamp, data }
  - Maximum queue size: 100 operations

On reconnect:
  1. Detect online event: window.addEventListener('online')
  2. Flush queue:
     - For each queued operation:
       • Apply to local vault
       • Attempt sync
       • On success: Remove from queue
       • On failure: Keep in queue, retry later
  3. Pull latest changes from server
  4. Merge and resolve conflicts
```

---

## 6. Zero-Knowledge Enforcement

### 6.1 Data Classification

**NEVER TRANSMITTED IN PLAINTEXT**:
- Master password
- Decrypted credentials (usernames, passwords)
- Decrypted vault
- Master password hash (sent hashed)

**TRANSMITTED ENCRYPTED**:
- Encrypted vault (AES-256-GCM)
- Encrypted credentials (inside vault)
- Encrypted metadata

**TRANSMITTED IN PLAIN (UNAVOIDABLE)**:
- Email address (for account identification)
- Device ID (for device tracking)
- Timestamps (for sync ordering)
- Account salt (publicly known, derivation is key)

### 6.2 Server Capabilities

**The server CAN see**:
- Email addresses
- Device IDs and last-sync times
- Credential count (metadata)
- Vault size in bytes
- Sync frequency patterns
- IP addresses

**The server CANNOT see**:
- Master password
- Decrypted credentials
- Decrypted vault contents
- Website URLs of stored credentials
- Usernames or passwords
- Any plaintext data

**If server is compromised**:
- Attacker gets encrypted vaults (useless without masterKey)
- Attacker gets salt and device info (cannot derive masterKey)
- Attacker could see sync patterns and device activity
- Attacker CANNOT decrypt any credentials

### 6.3 Key Management

**Master Key Storage**:
```
┌─────────────────────────────────────┐
│  Master Password (in user's head)   │
└─────────────────────────────────────┘
            ↓ (not transmitted)
   PBKDF2 + salt (local)
            ↓
┌─────────────────────────────────────┐
│   Master Key (256-bit AES key)      │
└─────────────────────────────────────┘
            ↓
   Stored in chrome.storage.session
   (VOLATILE—cleared on close)
            ↓
   Used to encrypt/decrypt vault
```

**Per-Credential Keys**:
- No per-credential keys
- All credentials encrypted with same master key
- This is acceptable because key is never transmitted

**Session Key Lifecycle**:
```
Login:
  1. User enters master password
  2. Browser derives master key (PBKDF2)
  3. Master key stored in session storage
  4. Auto-lock timer started

During operation:
  1. Session key available for encrypt/decrypt
  2. Any page navigation preserves session
  3. Extension close clears session

Logout:
  1. User clicks logout
  2. Session key immediately cleared
  3. Vault re-locked, requires master password
```

---

## 7. Message Passing Architecture

### 7.1 Message Types & Flows

```
CONTENT SCRIPT ←→ BACKGROUND (chrome.runtime.sendMessage)
    ↓
POPUP ←→ BACKGROUND (chrome.runtime.sendMessage)
    ↓
STORAGE (chrome.storage.local/session)
```

### 7.2 Message Definitions

**AUTHENTICATION MESSAGES**:
```
Popup → Background: 'LOGIN'
  {
    email: string,
    password: string
  }
Response:
  {
    success: boolean,
    error?: string,
    userId?: string
  }

Popup → Background: 'REGISTER'
  {
    email: string,
    password: string,
    masterPassword: string
  }

Popup → Background: 'UNLOCK_VAULT'
  {
    masterPassword: string
  }

Popup → Background: 'LOCK_VAULT'
  {}

Popup → Background: 'LOGOUT'
  {}
```

**CREDENTIAL MESSAGES**:
```
Popup → Background: 'ADD_CREDENTIAL'
  {
    url: string,
    username: string,
    password: string,
    notes?: string
  }

Popup → Background: 'UPDATE_CREDENTIAL'
  {
    id: string,
    updates: {url?, username?, password?, notes?}
  }

Popup → Background: 'DELETE_CREDENTIAL'
  {
    id: string
  }

Popup ← Background: 'CREDENTIALS_UPDATED'
  {
    credentials: Credential[]
  }
```

**FORM & AUTOFILL MESSAGES**:
```
ContentScript → Background: 'FORMS_DETECTED'
  {
    url: string,
    forms: FormInfo[]
  }

ContentScript ← Background: 'CREDENTIALS_AVAILABLE'
  {
    credentialOptions: {
      id: string,
      username: string,
      domain: string
    }[]
  }

ContentScript → Background: 'REQUEST_CREDENTIAL'
  {
    credentialId: string
  }

ContentScript ← Background: 'CREDENTIAL_DATA'
  {
    username: string,
    password: string
  }

ContentScript → Background: 'FORM_SUBMITTED'
  {
    url: string,
    username: string,
    password: string
  }
```

**SYNC MESSAGES**:
```
Popup → Background: 'START_SYNC'
  {
    force?: boolean
  }

Popup ← Background: 'SYNC_STATUS'
  {
    status: 'idle' | 'syncing' | 'success' | 'error',
    lastSyncTime?: number,
    error?: string
  }

Background → Popup: 'SYNC_COMPLETED'
  {
    changes: number,
    conflicts: number,
    newVersion: number
  }
```

**SETTINGS MESSAGES**:
```
Popup → Background: 'UPDATE_SETTINGS'
  {
    settings: {
      autoLockTimeout?: number,
      autoSync?: boolean,
      syncInterval?: number,
      ...
    }
  }

Popup ← Background: 'SETTINGS_UPDATED'
  {
    settings: Settings
  }
```

### 7.3 Message Routing Pattern

```javascript
// Background script message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { type, data } = request;

  // Route based on message type
  switch(type) {
    case 'LOGIN':
      handleLogin(data, sendResponse);
      break;
    
    case 'ADD_CREDENTIAL':
      handleAddCredential(data, sendResponse);
      break;
    
    case 'FORMS_DETECTED':
      handleFormsDetected(data, sender.tab, sendResponse);
      break;
    
    default:
      sendResponse({ error: 'Unknown message type' });
  }

  // Return true for async response
  return true;
});

// Content script sending message
chrome.runtime.sendMessage({
  type: 'FORMS_DETECTED',
  data: {
    url: window.location.href,
    forms: detectedForms
  }
}, response => {
  if (response.error) {
    console.error('Error:', response.error);
  } else {
    handleCredentialsAvailable(response.credentialOptions);
  }
});
```

---

## 8. Error Handling & Recovery

### 8.1 Network Failure Scenarios

**SYNC FAILURE**:
```
Attempt sync:
  POST /api/vault/sync/push → TIMEOUT (5 seconds)

Action:
  1. Catch network error
  2. Mark sync as 'pending' (will retry)
  3. Queue operation for later
  4. Show user: "Offline—will sync when online"
  5. Set retry timer: exponential backoff
     - 1st retry: 5 seconds
     - 2nd retry: 10 seconds
     - 3rd retry: 30 seconds
     - 4th+ retry: 5 minutes
  ↓
On reconnect (navigator.onLine):
  - Resume sync immediately
```

**BACKEND DOWN**:
```
Response: HTTP 503 Service Unavailable

Action:
  1. Stop retrying (503 = server problem)
  2. Show error: "Service temporarily unavailable"
  3. Allow offline operation
  4. Retry every 5 minutes (check if recovered)
  5. Do NOT lose user data
```

### 8.2 Decryption Failure

**WRONG MASTER PASSWORD**:
```
User enters master password
PBKDF2 derivation → Hash doesn't match stored hash

Action:
  1. Show error: "Incorrect master password"
  2. Clear attempted key from memory
  3. Do NOT show vault
  4. Ask user to try again or reset
```

**CORRUPTED VAULT**:
```
Decrypt vault → AES-GCM authentication fails (wrong IV or tampered)

Causes:
  - Vault corrupted in storage
  - Device storage failure
  - Malware tampering

Action:
  1. Show error: "Vault is corrupted"
  2. Offer options:
     a) "Recover from server" (pull latest)
     b) "Recover from backup" (if available)
     c) "Start fresh" (lose all credentials)
  3. Create automatic backup before recovery
  4. Log incident for user review
```

**MALFORMED VAULT**:
```
Decrypt successful, but JSON.parse fails

Causes:
  - Version mismatch
  - Encryption algorithm changed
  - Incomplete write

Action:
  1. Attempt to parse vault schema
  2. If schema version unknown: "Upgrade extension"
  3. If JSON invalid: "Vault format error - recover from backup"
  4. Never auto-recover—inform user explicitly
```

### 8.3 Sync Conflict Resolution

**VERSION MISMATCH**:
```
Device A version: 5
Server version: 7
Device B version: 8

Device A pulls:
  - Server says: "Your version (5) is old"
  - Solution:
    1. Pull server version 8
    2. Merge with local version 5
    3. Apply conflict resolution (LWW)
    4. Update to version 9 (local change + server merge)
```

**PARALLEL EDITS**:
```
Both Device A and B edit same credential simultaneously:

Device A: password = "NewPass1" (modifiedAt: T)
Device B: password = "NewPass2" (modifiedAt: T)

Same timestamp:
  Use deterministic tiebreaker: alphabetically first deviceId
  Result: One wins, other is overwritten
```

**MISSING CREDENTIALS**:
```
Server has credential X.v5
Device B has credential X.v3 (older)
Device A deleted credential X (v4)

Resolution:
  1. Detect: X.v5 exists on server, X.v3 on device
  2. Compare X.v4 (deletion): deviceId="A", timestamp=T1
  3. Compare X.v5 (edit): deviceId="B", timestamp=T1
  4. T1 == T1: Use tiebreaker (deviceId)
  5. Result: X deleted if A > B, else X updated
```

### 8.4 Device Loss/Compromise

**LOST DEVICE**:
```
Device disappeared:

User action:
  1. Login on new device
  2. Browser derives masterKey (same password, same salt)
  3. Pull vault from server
  4. Vault decrypts immediately (no device-specific key)
  5. All credentials recovered

Security: ✓ Zero-knowledge maintained (server couldn't decrypt either)
```

**COMPROMISED DEVICE**:
```
Attacker has access to device:

What attacker CAN do:
  - See plaintext vault IF masterKey is in session
  - Capture form autofill
  - Modify credentials

What attacker CANNOT do:
  - Decrypt vault without masterKey
  - Access vault if device is locked
  - Recover credentials from backup (encrypted)

Mitigation:
  1. User changes master password (re-encrypts vault)
  2. Old masterKey invalidated
  3. Compromised vault version overwritten
  4. New devices auto-update on next sync
```

**STOLEN BACKUP**:
```
Attacker steals backup file (encrypted .backup)

Can attacker decrypt?
  - File is AES-256-GCM encrypted
  - Requires masterKey
  - MasterKey derived from password + salt (salt known)
  - Attacker must brute-force 2^256 possibilities
  - At 1 billion/second: 2^256 / 10^9 = ~10^68 years
  
Security: ✓ Backup is as secure as password strength
```

---

## 9. Complete Implementation Checklist

### Core Components
- [ ] manifest.json with proper permissions
- [ ] Background service worker (session management, sync)
- [ ] Popup UI (login, register, vault, settings)
- [ ] Options page (dashboard, advanced settings)
- [ ] Content script (form detection, autofill)

### Encryption & Crypto
- [ ] PBKDF2 key derivation (100k iterations)
- [ ] AES-256-GCM encryption/decryption
- [ ] Salt generation (16 bytes random)
- [ ] IV generation (12 bytes random per encryption)
- [ ] Password hashing (SHA-256)

### Storage
- [ ] Chrome storage.local (persistent encrypted vault)
- [ ] Chrome storage.session (volatile session key)
- [ ] IndexedDB (for large data, optional)
- [ ] Sync queue (offline operations)

### Authentication
- [ ] Registration flow (email + master password)
- [ ] Login flow (account auth + vault unlock)
- [ ] Master password validation
- [ ] Session key lifecycle
- [ ] Auto-lock timer

### Credential Management
- [ ] Add credential
- [ ] Edit credential
- [ ] Delete credential (soft delete)
- [ ] Search credentials
- [ ] Tag support

### Autofill
- [ ] Form detection (login forms)
- [ ] Domain matching
- [ ] Credential injection
- [ ] Form submission detection
- [ ] Save prompt

### Synchronization
- [ ] Push (encrypted upload)
- [ ] Pull (encrypted download)
- [ ] Conflict resolution (LWW)
- [ ] Version tracking
- [ ] Offline queue
- [ ] Retry logic

### Security
- [ ] Zero-knowledge validation
- [ ] Server cannot decrypt
- [ ] Master key lifecycle
- [ ] Secure message passing
- [ ] CSRF protection
- [ ] CSP headers

### Error Handling
- [ ] Network failure recovery
- [ ] Decryption failure handling
- [ ] Vault corruption recovery
- [ ] Sync conflict resolution
- [ ] User-friendly error messages

### Testing
- [ ] Unit tests (crypto, storage)
- [ ] Integration tests (workflows)
- [ ] Security audit
- [ ] Penetration testing
- [ ] Performance testing

---

## 10. Security Properties Summary

| Property | Status | Implementation |
|----------|--------|-----------------|
| Zero-Knowledge | ✓ | Server cannot decrypt vault |
| End-to-End Encryption | ✓ | AES-256-GCM on client |
| Key Derivation | ✓ | PBKDF2 with 100k iterations |
| Master Key Protection | ✓ | Session-only storage |
| Auto-Lock | ✓ | Timer clears session |
| Offline Support | ✓ | Sync queue for operations |
| Conflict Resolution | ✓ | Last-write-wins + tiebreaker |
| Integrity Checking | ✓ | GCM authentication tag |
| Device Tracking | ✓ | Device ID + sync history |
| Recovery | ✓ | Server-side backup restoration |

---

This architecture design provides enterprise-grade security with zero-knowledge guarantees, multi-device synchronization, and comprehensive error handling. All workflows are designed to maintain the fundamental principle: **No plaintext data ever leaves the client.**
