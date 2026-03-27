# DiskLens

A fast Windows disk analyzer desktop app. Scan any folder or drive and instantly see which files and folders are eating your disk space — sorted by size, filterable by type, with a virtual list that handles 100,000+ entries smoothly.

Built with **Tauri 2** (Rust backend) + **React 19** + **TypeScript**.

---

## Features

- **Instant scan** — uses `FindFirstFile`/`FindNextFile` Windows API; auto-upgrades to direct MFT read on NTFS + admin for maximum speed
- **Virtual scroll** — smooth scrolling through 100,000+ entries via TanStack Virtual
- **Sort by size** — default sort shows largest items first; click any column header to re-sort
- **Color coding** — rows tinted red/amber/green by % of parent folder size
- **Multi-select** — checkbox, Ctrl+click, Shift+click, Ctrl+A
- **Context menu** — right-click for Open in Explorer, Copy Path, Trash, Delete Permanently, Properties
- **Side panel** — persistent properties view with inline rename
- **Type filters** — filter by Folders, Programs, Documents, Images, Videos, System, Archives
- **Search** — debounced 200ms client-side name filter
- **Disk usage bar** — used / free / total with color alert above 90%
- **Column visibility** — toggle columns via gear icon
- **Show hidden files** toggle
- **Dark mode** — follows system preference automatically
- **Keyboard shortcuts** — Delete, Shift+Delete, Backspace, Enter, Ctrl+A, Ctrl+C, Escape, P, F5, Ctrl+F

---

## Download

Get the latest `.msi` installer from the [Releases](../../releases) page.

---

## Build from Source

**Prerequisites:**
- [Node.js 20+](https://nodejs.org/)
- [Rust stable](https://rustup.rs/)
- Windows 10/11

```bash
git clone https://github.com/your-username/DiskLens.git
cd DiskLens
npm install
npm run tauri build
# Installer: src-tauri/target/release/bundle/msi/
```

**Dev mode:**
```bash
npm run tauri dev
```

---

## Architecture

| Layer    | Technology |
|----------|-----------|
| Backend  | Rust (Tauri 2) |
| Frontend | React 19 + TypeScript |
| Build    | Vite 5 |
| Table    | TanStack Table v8 + Virtual v3 |
| State    | Zustand v4 |
| Icons    | Lucide React |

**Scan strategy (auto-selected at runtime):**

| Condition | Method |
|-----------|--------|
| NTFS + running as Administrator | Direct MFT read (`ntfs` crate) — fastest |
| Everything else | `FindFirstFile`/`FindNextFile` Windows API |

---

## License

MIT
