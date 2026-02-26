# Implementation Plan: Master Password in Extension Popup

## Task Summary
When user enters new credentials on a website and the vault is locked:
- Instead of asking for master password on the webpage, show it in the extension popup
- After unlocking, save the credentials automatically
- Autofill continues to use OTP verification (existing functionality)

## Steps Completed

### Step 1: Create UnlockAndSave Component ✅
- [x] Created `src/pages/auth/UnlockAndSave.tsx`
- [x] Handle master password input
- [x] Unlock vault and save credentials

### Step 2: Update Popup Routing ✅
- [x] Added route `/unlock-save` in `src/extension/popup/App.tsx`

### Step 3: Update Background Script ✅
- [x] Updated `src/extension/background/index.ts`
- [x] Handle pending credential storage
- [x] Implement unlock and save flow

### Step 4: Update Content Script ✅
- [x] Updated `src/extension/contentScript/index.ts`
- [x] Change notification to direct to extension popup
- [x] Remove inline master password prompt

## Notes
- Autofill already uses OTP verification (no changes needed)
- Existing save prompt functionality remains the same
- When vault is locked and user tries to save:
  1. Shows notification on webpage directing user to click extension icon
  2. User clicks extension icon
  3. Popup opens with unlock & save page
  4. User enters master password
  5. Credentials are saved and user is redirected to vault
