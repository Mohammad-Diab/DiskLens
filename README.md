# DiskLens

A fast Windows disk space analyzer built with Tauri 2 + React + Rust.

[![Build](https://github.com/mhdaib/DiskLens/actions/workflows/build.yml/badge.svg)](https://github.com/mhdaib/DiskLens/actions/workflows/build.yml)

## Features

- **Instant scanning** — uses Windows `FindFirstFile`/`FindNextFile` API for fast traversal; falls back to NTFS MFT for admin-level speed
- **Sorted file table** — click any column header to sort by name, size, type, or date; virtually scrolled for 50,000+ entries
- **Breadcrumb navigation** — click into folders and navigate back without rescanning
- **Multi-select** — Ctrl+click, Shift+click, or rubber-band drag to select multiple items
- **Context menu** — right-click to open, reveal in Explorer, copy path/name, send to Trash, or delete permanently
- **Type filter chips** — quickly filter to folders, images, videos, documents, archives, etc.
- **Search** — debounced name search across the current folder
- **Show hidden files** toggle
- **Side panel** — click a file to see properties (size, dates, kind)
- **Disk usage bar** — footer shows drive capacity, used, and free space at drive root
- **Color-coded rows** — red (>30% of parent), amber (10–30%), green (<10%)
- **Dark mode** — follows system preference automatically
- **Keyboard shortcuts** — Delete, Escape, Ctrl+A, arrow keys, Enter to open

## Download

Download the latest `.msi` installer from [Releases](../../releases/latest).

## Build from Source

**Prerequisites**

- [Node.js 20+](https://nodejs.org/)
- [Rust stable](https://rustup.rs/)

```bash
git clone https://github.com/mhdaib/DiskLens.git
cd DiskLens
npm install
npm run tauri build
```

The installer is placed in `src-tauri/target/release/bundle/msi/`.

**Development server:**

```bash
npm run tauri dev
```

## Architecture

| Layer | Technology |
|-------|-----------|
| Window shell | Tauri 2 |
| Frontend | React 19 + TypeScript |
| State | Zustand |
| Table | TanStack Table v8 + Virtual v3 |
| Backend | Rust |
| File scan | Windows `FindFirstFile` API / NTFS MFT |
| File ops | `trash` crate (safe delete), `std::fs` (permanent) |

## License

MIT
