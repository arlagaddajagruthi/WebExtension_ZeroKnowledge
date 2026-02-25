# TODO - Web Extension Fixes

## Task 1: Fix/Enhance Master Password Prompt for Autofill
- [ ] Review and fix the autofill flow to properly prompt for master password
- [ ] Ensure vault status is correctly checked
- [ ] Ensure unlock properly sets session key
- [ ] Test the autofill works after unlock

## Current Issues Identified:
1. When vault is locked, credentials are still returned to content script (with passwords)
2. This defeats the purpose of the master password prompt
3. Need to fix the flow to only return credentials after unlock

## Implementation Plan:
1. Modify `REQUEST_CREDENTIALS` in background to NOT return passwords when vault is locked
2. Return only credential metadata (username, id, url) when locked
3. After unlock, background should provide the actual credentials
4. Enhance content script to handle this flow properly
