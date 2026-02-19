# ZeroVault Security Validation & Testing Guide

## Security Architecture Overview

ZeroVault implements a zero-knowledge password manager with the following security guarantees:

### 1. Client-Side Encryption
- **Algorithm**: AES-256-GCM with PBKDF2 key derivation
- **Key Derivation**: PBKDF2 with 100,000 iterations and SHA-256
- **Salt**: 16-byte random salt generated per user
- **IV**: 12-byte random IV generated per encryption operation

### 2. Server-Side Security
- **Zero Knowledge**: Server never sees plaintext passwords
- **Row Level Security (RLS)**: PostgreSQL RLS enforces user-level access control
- **Encrypted Storage**: All credentials stored encrypted with user's master key
- **No Server-Side Decryption**: Server cannot decrypt credentials

### 3. Transport Security
- **HTTPS Only**: All communication uses TLS 1.3+
- **k-anonymity**: Breach monitoring uses k-anonymity (sends only 5-char hash prefix)
- **Session Management**: Session keys stored in chrome.storage.session (not persistent)

### 4. Authentication
- **Email/Password**: Supabase JWT-based authentication
- **Biometric (Optional)**: WebAuthn/FIDO2 for device-level authentication
- **MFA Ready**: Can be extended with TOTP or FIDO2

## Testing Checklist

### Unit Tests
```bash
npm run test
```

Run all unit tests including:
- ✅ Crypto utility tests (crypto.test.ts)
- ✅ Breach monitoring tests (breach-monitoring.test.ts)
- ✅ Vault store tests (vaultStore.test.ts)
- ✅ Password generator tests (PasswordGenerator.test.tsx)

### Integration Tests

#### 1. Encryption/Decryption Flow
```typescript
// Test case: Full credential encryption cycle
1. Generate salt
2. Derive master key from password
3. Create credential
4. Encrypt credential
5. Decrypt credential
6. Verify plaintext matches
```

#### 2. Multi-Device Sync
```typescript
// Test case: Synchronize encrypted credentials across devices
1. Create credential on Device A
2. Upload encrypted credential to Supabase
3. Fetch on Device B with same master password
4. Verify Device B can decrypt credential
5. Modify credential on Device B
6. Resolve conflicts (last-write-wins)
7. Verify all devices have latest version
```

#### 3. Authentication Flow
```typescript
// Test case: User registration and login
1. Register account with email + password (Supabase)
2. Create master password (local derivation)
3. Login with account credentials
4. Unlock vault with master password
5. Verify session key is set
6. Verify can access credentials
7. Logout and verify session cleared
```

#### 4. Biometric Authentication
```typescript
// Test case: WebAuthn enrollment and use
1. Check device supports WebAuthn
2. Enroll biometric credential
3. Store credential locally
4. Use biometric to authenticate
5. Verify session key is set
6. Disable biometric
7. Verify credential is removed
```

### Security Tests

#### 1. Master Password Validation
```
Test 1: Wrong password should not decrypt vault
- Input: Wrong master password
- Expected: Decryption fails with error
- Status: [TODO: Test manually]

Test 2: Password strength requirements
- Input: Weak password (< 8 chars)
- Expected: Error message, vault not created
- Status: [TODO: Test manually]

Test 3: Timing attack prevention
- Input: Multiple attempts with wrong passwords
- Expected: No timing differences in validation
- Status: [TODO: Verify with timing analysis]
```

#### 2. Encryption Security
```
Test 1: IV uniqueness (prevents pattern detection)
- Input: Encrypt same plaintext twice
- Expected: Different ciphertexts each time
- Verification: crypto.test.ts - "should encrypt to different ciphertexts"
- Status: ✅ PASSING

Test 2: No plaintext leakage
- Input: Monitor localStorage/SessionStorage during encryption
- Expected: No plaintext passwords visible
- Status: [TODO: Test with browser DevTools]

Test 3: Salt randomness (prevents rainbow tables)
- Input: Generate 1000 salts
- Expected: All unique, cryptographically random
- Verification: crypto.test.ts - "should generate a random salt"
- Status: ✅ PASSING
```

#### 3. Server-Side Security
```
Test 1: Row Level Security (RLS) enforcement
- Input: User A attempts to access User B's credentials
- Expected: PostgreSQL returns no rows
- Status: [TODO: Test with Supabase admin]

Test 2: Master password hash storage
- Input: Check Supabase user_metadata table
- Expected: Only hash + salt stored, never plaintext
- Status: [TODO: Verify in database]

Test 3: Session key isolation
- Input: Check chrome.storage.session
- Expected: Session key not in localStorage/chrome.storage.local
- Status: [TODO: Test with browser DevTools]
```

#### 4. Breach Monitoring
```
Test 1: Password hash privacy (k-anonymity)
- Input: Check HaveIBeenPwned API requests
- Expected: Only 5-char hash prefix sent, not full hash
- Verification: breach-monitoring.ts - "async function checkPasswordBreach"
- Status: ✅ IMPLEMENTED

Test 2: No false negatives
- Input: Check known compromised password (e.g., "password123")
- Expected: Detected as compromised
- Status: [TODO: Test with real API]

Test 3: Cache validity
- Input: Check last_checked timestamp
- Expected: Older than 7 days triggers refresh
- Status: [TODO: Test cache refresh logic]
```

#### 5. Credential Import/Export
```
Test 1: Encrypted export integrity
- Input: Export vault as encrypted (.zerovault)
- Expected: Can decrypt with master password
- Status: [TODO: Test end-to-end]

Test 2: Unencrypted export warning
- Input: Export as JSON
- Expected: Warning shown, file is plaintext
- Status: [TODO: Test warning display]

Test 3: Import validation
- Input: Import JSON with invalid format
- Expected: Clear error message, no import
- Status: [TODO: Test error handling]

Test 4: Duplicate detection
- Input: Import credentials already in vault
- Expected: Duplicates skipped with message
- Status: [TODO: Test duplicate handling]
```

### Penetration Testing Scenarios

#### 1. Man-in-the-Middle (MITM) Attack
```
Scenario: Attacker intercepts network traffic
Mitigation: HTTPS/TLS 1.3+ prevents interception
Test: Use Burp Suite to verify HTTPS enforcement
Status: [TODO]
```

#### 2. Device Loss/Theft
```
Scenario: Device with extension is stolen
Protection:
  1. Session key only in chrome.storage.session (not persistent)
  2. Master password is required to unlock vault
  3. Auto-lock timer clears session key
Status: [TODO: Test with real device]
```

#### 3. Malicious JavaScript Injection
```
Scenario: XSS attack injects code into extension
Mitigation: Content Security Policy (CSP)
Test: CSP headers in manifest.json
Status: [TODO: Verify CSP configuration]
```

#### 4. Brute Force Password Attack
```
Scenario: Attacker tries to brute force master password
Protection:
  1. PBKDF2 with 100k iterations = 1-2s per attempt
  2. Browser rate limiting
  3. Supabase account lockout
Status: [TODO: Calculate time to brute force]
```

#### 5. Credential Harvesting (HaveIBeenPwned)
```
Scenario: Attacker intercepts API requests to HIBP
Mitigation: k-anonymity (5-char hash prefix)
Status: ✅ IMPLEMENTED
```

## Cryptographic Correctness

### Key Derivation (PBKDF2)
- Iterations: 100,000 (OWASP recommendation)
- Hash Function: SHA-256
- Salt Length: 16 bytes (128 bits)
- Output Length: 256 bits

Reference: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

### Encryption (AES-GCM)
- Algorithm: AES-256-GCM
- Key Length: 256 bits
- IV Length: 12 bytes (96 bits)
- Authentication Tag: 128 bits (included)
- Mode: Authenticated encryption with associated data (AEAD)

Reference: https://csrc.nist.gov/publications/detail/sp/800-38d/final

### Random Number Generation
- Source: crypto.getRandomValues() (CSPRNG)
- Used for: Salt, IV, password generation

## Manual Testing Instructions

### 1. Test Master Password Encryption
```
1. Register new account
2. Set master password to "TestPassword123!"
3. Add credential: gmail.com / user@gmail.com / secretpass123
4. Open DevTools → Storage → Local Storage
5. Verify vault_credentials is encrypted (base64, not plaintext)
6. Clear vault_credentials
7. Logout and login
8. Verify credential is gone (cached only)
9. Restore from backup
10. Verify credential decrypts correctly
```

### 2. Test Sync Encryption
```
1. Set up two browsers with same Supabase account
2. Add credential on Browser 1
3. Verify credential is encrypted in Supabase
4. Switch to Browser 2
5. Perform sync
6. Verify credential appears with correct data
7. Open Supabase browser
8. Check credentials table - should show encrypted_data (not plaintext)
```

### 3. Test Breach Monitoring
```
1. Add credential with weak password "123456"
2. Go to Security Audit
3. Click "Check for Breaches"
4. Verify breach check completes without exposing full password to API
5. Verify "123456" is reported as compromised
6. Verify cache is stored locally
7. Check browser Network tab - only 5-char hash sent to HIBP
```

### 4. Test Auto-lock
```
1. Set auto-lock to 1 minute
2. Unlock vault
3. Verify session key is in chrome.storage.session
4. Wait 1+ minutes without interaction
5. Verify session key is cleared
6. Verify vault is locked
7. Verify must re-enter master password
```

## Security Audit Checklist

- [ ] Code review of crypto.ts (PBKDF2, AES-GCM implementation)
- [ ] Review Supabase RLS policies
- [ ] Verify CSP headers in manifest.json
- [ ] Check for unencrypted storage of passwords
- [ ] Audit third-party dependencies for vulnerabilities
- [ ] Test CORS and authentication flows
- [ ] Verify session isolation between tabs
- [ ] Test clipboard handling (auto-clear passwords)
- [ ] Review error messages (no information leakage)
- [ ] Test with OWASP ZAP or Burp Suite

## Known Limitations & Future Improvements

### Current Limitations
1. **Biometric data on device**: Stored in browser localStorage (not hardware-backed)
2. **Local-only credentials**: If local cache is cleared, must re-sync from Supabase
3. **No offline mode yet**: Requires internet for sync operations
4. **Breach monitoring**: Requires manual checking (no scheduled scans yet)

### Future Improvements
1. **Scheduled breach checks**: Automatic daily/weekly checks
2. **Hardware security module (HSM)**: Store keys in TPM
3. **Backup encryption**: Encrypt backups with different key
4. **Two-factor authentication**: Add TOTP/FIDO2 MFA
5. **Secure clipboard clearing**: Auto-clear copied passwords after 30 seconds
6. **Offline mode**: Store encrypted cache for offline access
7. **Audit logging**: Track access to sensitive operations

## Compliance References

- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **NIST Cybersecurity Framework**: https://www.nist.gov/cyberframework
- **FIPS 140-2**: https://en.wikipedia.org/wiki/FIPS_140-2
- **Zero-Knowledge Proof**: https://en.wikipedia.org/wiki/Zero-knowledge_proof

## Support & Reporting

For security issues:
1. **Do NOT open public GitHub issues**
2. Email: security@zerovault.example.com
3. Include: Description, affected component, reproduction steps
4. Allow: 90 days for fix before disclosure

## Testing Status

| Component | Unit Tests | Integration | Manual | Penetration |
|-----------|-----------|-------------|--------|------------|
| Crypto | ✅ PASSING | [TODO] | [TODO] | [TODO] |
| Breach Monitor | ✅ PASSING | [TODO] | [TODO] | [TODO] |
| Encryption | ✅ PASSING | [TODO] | [TODO] | [TODO] |
| Auth | [TODO] | [TODO] | [TODO] | [TODO] |
| Sync | [TODO] | [TODO] | [TODO] | [TODO] |
| RLS | [TODO] | [TODO] | [TODO] | [TODO] |

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024 | Initial security documentation |
