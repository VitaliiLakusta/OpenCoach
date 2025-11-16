# OpenCoach - Electron Desktop App

OpenCoach is now available as a native desktop application for macOS and Windows!

## Features

- **Native Desktop Experience**: Runs as a standalone application without needing a browser
- **Cross-Platform**: Available for macOS and Windows
- **Offline Capable**: Works without internet when using local Ollama models
- **System Integration**: Appears in your Applications folder and Start Menu

## Development

To run OpenCoach in Electron development mode:

```bash
npm run electron:dev
```

This will:
1. Start the Next.js development server
2. Wait for it to be ready
3. Launch the Electron app

## Building Installers

### Prerequisites

- **macOS Build**: Requires macOS to build `.dmg` and `.zip` files
- **Windows Build**: Can be built on macOS using electron-builder

### Build Commands

**Build for macOS**:
```bash
npm run electron:build:mac
```

This creates:
- `dist/OpenCoach-0.1.0-universal.dmg` - Disk image installer (Universal: Intel + Apple Silicon)
- `dist/OpenCoach-0.1.0-universal-mac.zip` - Portable ZIP version

**Build for Windows**:
```bash
npm run electron:build:win
```

This creates:
- `dist/OpenCoach Setup 0.1.0.exe` - Windows installer (NSIS)
- `dist/OpenCoach 0.1.0.exe` - Portable executable

**Build for Both Platforms**:
```bash
npm run electron:build:all
```

## Distribution

After building, you'll find the installers in the `dist/` directory:

### macOS
- **DMG**: Drag-and-drop installer for macOS
- **ZIP**: Extract and run, no installation needed

### Windows
- **NSIS Installer**: Full installer with Start Menu shortcuts and uninstaller
- **Portable**: Run directly without installation

## Installation Instructions

### macOS
1. Download `OpenCoach-0.1.0-universal.dmg`
2. Open the DMG file
3. Drag OpenCoach to the Applications folder
4. Launch from Applications or Spotlight

**Note**: On first launch, you may need to:
- Right-click the app and select "Open" (due to Gatekeeper)
- Or go to System Settings → Privacy & Security and allow the app

### Windows
1. Download `OpenCoach Setup 0.1.0.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

## App Configuration

The Electron app works exactly like the web version:
- Configure your API keys in Settings (⚙️)
- Set your notes folder path
- Add your calendar URL
- Enable notifications

All settings are stored locally in your browser's localStorage within the Electron app.

## File Access

The Electron app can access your local file system for:
- Reading notes from your Obsidian vault
- Writing new notes
- Accessing calendar files

Make sure to provide the full absolute path to your notes folder in the configuration.

## Troubleshooting

### macOS: "App is damaged and can't be opened"
This happens with unsigned apps. Fix:
```bash
xattr -cr /Applications/OpenCoach.app
```

### Windows: SmartScreen Warning
Click "More info" then "Run anyway" on the SmartScreen warning.

### Port Already in Use
If port 3000 is busy, the app may fail to start. Close other Next.js apps or change the port in `electron/main.js`.

## Building Signed Apps (Advanced)

To create properly signed and notarized apps:

### macOS
1. Get an Apple Developer account
2. Create signing certificates
3. Set environment variables:
   ```bash
   export CSC_LINK=/path/to/certificate.p12
   export CSC_KEY_PASSWORD=your_password
   export APPLE_ID=your@email.com
   export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```
4. Run build command

### Windows
1. Get a code signing certificate
2. Set environment variables:
   ```bash
   export WIN_CSC_LINK=/path/to/certificate.pfx
   export WIN_CSC_KEY_PASSWORD=your_password
   ```
3. Run build command

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **Next.js**: React framework for the UI
- **electron-builder**: Build and packaging tool

## License

Same as OpenCoach main project.
