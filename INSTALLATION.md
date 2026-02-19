# ZeroVault Chrome Extension - Installation Guide

## 🚀 Quick Start

### Step 1: Build the Extension

```bash
npm install
npm run build
```

This creates a `dist` folder with all the compiled extension files.

### Step 2: Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `dist` folder from your project directory

### Step 3: Pin the Extension

1. Click the **Extensions** icon (puzzle piece) in Chrome toolbar
2. Find **ZeroVault** in the list
3. Click the **pin** icon to keep it visible

## 📱 Using the Extension

### Popup (Main Interface)
- Click the ZeroVault icon in your toolbar
- **First time**: You'll see the Welcome screen
- **Register**: Create your master password (minimum 8 characters)
- **Login**: Unlock your vault with your master password
- **Vault**: View, add, edit, and delete credentials
- **Generator**: Create strong random passwords
- **Settings**: Configure extension preferences

### Options Page (Full Dashboard)
- Right-click the extension icon → **Options**
- OR click "Settings" in the popup → "Open Dashboard"
- Full-screen interface with:
  - Vault management
  - Security analytics
  - Sync dashboard
  - Advanced settings

### Content Script (Autofill)
- Visit any login page
- Look for the ZeroVault bubble near password fields
- Click to select and autofill saved credentials

## 🔧 Development Mode

To test changes during development:

```bash
npm run dev
```

**Note**: `npm run dev` starts a development server for testing components, but **you must load the extension from the `dist` folder** after running `npm run build`.

## 🌐 Browser Compatibility

### Chrome/Chromium-based Browsers
- ✅ Google Chrome
- ✅ Microsoft Edge
- ✅ Brave
- ✅ Opera
- ✅ Vivaldi

**Installation**: Same as above (use `chrome://extensions/` or `edge://extensions/`)

### Firefox
To make this work in Firefox, you need to:

1. Update `manifest.json`:
   - Change `"manifest_version": 3` to `"manifest_version": 2`
   - Replace `"service_worker"` with `"scripts": ["background.js"]`
   - Update permissions format

2. Load in Firefox:
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click **Load Temporary Add-on**
   - Select `manifest.json` from the `dist` folder

### Safari
Requires additional conversion using Xcode's Safari Web Extension Converter.

## 🐛 Troubleshooting

### Extension doesn't appear
- Make sure you selected the `dist` folder, not the root project folder
- Check that `dist` contains `manifest.json`
- Refresh the extensions page

### Popup shows blank screen
- Open DevTools on the popup (right-click extension icon → Inspect popup)
- Check console for errors
- Rebuild: `npm run build`

### Changes not reflecting
- Click the **reload** icon on the extension card in `chrome://extensions/`
- Or remove and re-add the extension

### Storage/State issues
- Open DevTools → Application → Storage
- Clear `localStorage` for the extension
- Reset vault from Settings → Danger Zone

## 📦 Distribution

To distribute your extension:

1. **Build for production**: `npm run build`
2. **Zip the dist folder**: `dist.zip`
3. **Chrome Web Store**:
   - Create developer account ($5 one-time fee)
   - Upload `dist.zip`
   - Fill in store listing details
   - Submit for review

## 🔐 Security Notes

- Master password is **never** stored
- All credentials are encrypted locally
- Zero-knowledge architecture: only you can decrypt your data
- For production: Replace crypto mocks with real implementations (AES-256-GCM, Argon2)

## 📝 Project Structure

```
dist/
├── manifest.json          # Extension configuration
├── popup.html            # Popup UI entry
├── options.html          # Dashboard entry
├── assets/               # Compiled JS/CSS
│   ├── popup-*.js
│   ├── options-*.js
│   ├── background-*.js
│   └── content-*.js
└── icons/                # Extension icons
```

## ⚡ Next Steps

1. **Test thoroughly** in different scenarios
2. **Add real crypto** implementations
3. **Implement sync** with backend API
4. **Add breach monitoring**
5. **Create promotional materials** for store listing
