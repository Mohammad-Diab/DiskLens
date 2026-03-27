# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DiskLens** is a Windows disk analyzer desktop app built with Tauri 2 (Rust backend) + React 19 + TypeScript frontend. It scans directories and displays file/folder sizes with sorting, filtering, and file operations.

## Commands

### Development
```bash
npm run tauri dev     # Start full app (Vite dev server + Tauri window)
npm run dev           # Vite dev server only (http://localhost:1420)
```

### Build
```bash
npm run tauri build   # Production binary
npm run build         # Frontend bundle only
```

### Rust (run from src-tauri/)
```bash
cargo check           # Check for compile errors (fast)
cargo build           # Debug build
```

## Architecture

### Backend (Rust — `src-tauri/src/`)
- `main.rs` — entry point, delegates to `lib.rs`
- `lib.rs` — registers all Tauri commands in `.invoke_handler(tauri::generate_handler![...])`; **every new command must be registered here**
- `models.rs` — `FileEntry`, `DiskInfo`, `ScanResult` structs; all need `#[derive(Serialize, Deserialize, Clone)]`
- `commands/scan.rs` — `get_drives`, `scan_dir`, `get_dir_children`
- `commands/file_ops.rs` — `delete_to_trash`, `delete_permanent`, `rename_file`
- `commands/system.rs` — `open_in_explorer`, `copy_to_clipboard`, `get_file_info`

### Frontend (React — `src/`)
- `store/useStore.ts` — Zustand global state (scan state, selection, UI flags)
- `hooks/useKeyboard.ts` — all keyboard shortcuts in a single `useEffect` at App level
- `components/FileTable/` — TanStack Table v8 + TanStack Virtual v3 (owns sort/filter state — do NOT duplicate in Zustand)
- `types/index.ts` — shared TypeScript types mirroring Rust structs

### IPC Bridge
Rust structs serialize to JSON automatically via Tauri. Frontend calls commands with `invoke('command_name', { args })`.

## Scanning Strategy

`scan_dir` auto-selects at runtime:
1. **NTFS + Admin** → MFT direct read via `ntfs` crate (fastest)
2. **All others** → `FindFirstFile`/`FindNextFile` Windows API via `walkdir`

Implement Windows API path first, MFT second.

## Key Rules (from specs.md)

- **Phase order matters**: Phase 1 (foundation) must be complete before anything else — `scan_dir` is the core
- **Trash delete**: Use `trash` crate — never `std::fs::remove_file` for user-initiated deletes
- **Context menu**: Must close on Escape + mousedown outside + scroll
- **Side panel** is not a popup — it's a persistent resizable panel driven by `sidePanelItem` in Zustand
- **DeleteDialog** is the only modal/popup in the app
- **Performance gate**: Test with 50,000+ files before marking Phase 1 done

## Implementation Phases

- **Phase 1**: `get_drives` + `scan_dir` (Windows API) + basic file table + breadcrumb navigation
- **Phase 2**: MFT fast path, multi-select, context menu, delete flow, side panel, keyboard shortcuts
- **Phase 3**: Color coding, column visibility, type filters, search, disk usage bar, virtual scroll
- **Phase 4**: Dark mode, app icon, CI/CD, GitHub release
