# Backend Completion Plan for ZeroVault Password Manager

## Overview
This document outlines the plan to complete the backend functionality for the ZeroVault password manager web extension.

## Current State
The project has a solid foundation with:
- Encryption using AES-GCM with PBKDF2 key derivation
- Credential storage in chrome.storage.local
- Basic sync service (mock implementation)
- Authentication flow (register/login)
- Content script for form detection and autofill
- Background script for session management
- Multiple settings pages

## Tasks to Complete

### Phase 1: Fix TODOs and Incomplete Features

#### 1.1 Implement Password Change Detection (background/index.ts)
- **Current**: Has TODO comment "// TODO: Update prompt"
- **Needed**: When a user logs in and detects password change, show update prompt
- **Files**: src/extension/background/index.ts

#### 1.2 Implement Blacklist Feature (contentScript/index.ts)
- **Current**: Has TODO comment "// TODO: Add to blacklist"
- **Needed**: When user clicks "Never" on save prompt, add domain to blacklist
- **Files**: src/extension/contentScript/index.ts, src/utils/urlMatcher.ts

#### 1.3 Connect Auto-lock Settings (AutoLockSettings.tsx)
- **Current**: handleSave function is empty
- **Needed**: Save timeout to chrome.storage and update background script
- **Files**: src/pages/settings/subpages/AutoLockSettings.tsx, src/extension/background/index.ts

#### 1.4 Connect Sync Button (SyncSettings.tsx)
- **Current**: "Sync Now" button doesn't trigger sync
- **Needed**: Connect button to vaultStore.syncVault()
- **Files**: src/pages/settings/subpages/SyncSettings.tsx

#### 1.5 Secure Export (ExportVault.tsx)
- **Current**: Exports unencrypted JSON
- **Needed**: Either encrypt export or add prominent warning
- **Files**: src/pages/settings/subpages/ExportVault.tsx

### Phase 2: Enhance Backend Services

#### 2.1 Improve Sync Service
- **Current**: Mock implementation with random delays
- **Needed**: 
  - Add real API integration (optional, can be placeholder)
  - Better conflict resolution
  - Offline support improvements
- **Files**: src/services/sync.service.ts

#### 2.2 Add Biometric Authentication Support
- **Current**: Only master password
- **Needed**: Add WebAuthn support for biometric unlock
- **Files**: src/utils/crypto.ts, src/pages/auth/Login.tsx

#### 2.3 Enhance Security Audit
- **Current**: Only checks weak/reused passwords
- **Needed**: 
  - Add breach checking (HaveIBeenPwned API integration - optional)
  - More comprehensive password analysis
- **Files**: src/pages/security/SecurityAudit.tsx

### Phase 3: Additional Backend Features

#### 3.1 Add Import Functionality
- **Current**: Only export is implemented
- **Needed**: Import from JSON, CSV (from other password managers)
- **Files**: Add new import page

#### 3.2 Complete Change Password Functionality
- **Current**: Need to check if implemented
- **Needed**: Allow user to change master password
- **Files**: src/pages/settings/subpages/ChangePassword.tsx

#### 3.3 Add Secure Notes Support
- **Current**: Notes field exists but not fully utilized
- **Needed**: Add secure notes functionality
- **Files**: src/utils/types.ts, src/pages/vault/CredentialForm.tsx

## Implementation Order

1. Fix TODOs and incomplete features (Phase 1)
2. Improve sync service (Phase 2)
3. Add biometric support (Phase 2)
4. Add import functionality (Phase 3)
5. Complete remaining features (Phase 3)

## Notes
- The extension uses Manifest V3
- Storage uses chrome.storage.local for credentials
- Encryption uses Web Crypto API (SubtleCrypto)
- State management uses Zustand
- UI uses React with Tailwind CSS
