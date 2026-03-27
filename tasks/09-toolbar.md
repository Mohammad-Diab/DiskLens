# Task 09 — Toolbar

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src/components/Toolbar/Toolbar.tsx`

## Goal
Top bar with drive picker, custom path input, and Scan button. The entry point for all scans.

## Layout (left to right)
```
[Drive dropdown] [Path input ________________________] [Browse] [Scan]
```
Phase 3 adds: Search input, type filter chips, show hidden toggle, column toggle.

## Behavior

### Drive dropdown
- On mount, call `invoke('get_drives')` to populate list
- Each option: `{driveLetter} ({label}) — {usedGB}/{totalGB}`
- Selecting a drive sets the path input to that drive letter

### Path input
- Free-text input; user can type any path
- Syncs with `currentPath` from Zustand store

### Browse button
- Opens Tauri's dialog picker: `open({ directory: true })`
- Sets path input to chosen directory

### Scan button
- Calls `invoke('scan_dir', { path })`
- Sets `isScanning: true` while running
- On success: calls `setEntries`, `setScanRoot`, `setCurrentPath`, builds breadcrumbs
- On error: show inline error message

## Notes
- Install `@tauri-apps/plugin-dialog` for directory picker if not bundled
- While scanning, disable Scan button and show a spinner
- Toolbar does NOT own state — reads/writes Zustand store
