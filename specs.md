# DiskLens — Project Specification
> Disk analyzer desktop app · Tauri 2 + React 19 + TypeScript · v1.0 · March 2026

---

## 1. Stack

| Layer | Technology |
|---|---|
| Backend | Rust (Tauri 2) |
| Frontend | React 19 + TypeScript |
| Build | Vite 5 |
| Table | TanStack Table v8 + TanStack Virtual v3 |
| State | Zustand v4 |
| Icons | Lucide React |
| Rust crates | `sysinfo` · `ntfs` · `trash` · `serde` · `winapi` |

---

## 2. Project Structure

```
DiskLens/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── models.rs          # FileEntry, DiskInfo, ScanResult structs
│   │   └── commands/
│   │       ├── scan.rs        # scan_dir, get_drives, get_dir_children
│   │       ├── file_ops.rs    # delete_to_trash, delete_permanent, rename_file
│   │       └── system.rs      # open_in_explorer, copy_to_clipboard, get_file_info
│   ├── Cargo.toml
│   └── tauri.conf.json
└── src/
    ├── App.tsx
    ├── components/
    │   ├── FileTable/          # TanStack Table — main view
    │   ├── Toolbar/            # drive picker, search, filters, column toggle
    │   ├── Breadcrumb/         # path navigation
    │   ├── SidePanel/          # file properties (no popups)
    │   ├── ContextMenu/        # right-click menu
    │   ├── DiskBar/            # used/free bar
    │   └── DeleteDialog/       # only popup in the app
    ├── store/
    │   └── useStore.ts         # Zustand global state
    ├── hooks/
    │   └── useKeyboard.ts      # all keyboard shortcuts
    └── types/
        └── index.ts            # shared TS types
```

---

## 3. Data Model

### FileEntry (Rust → TypeScript via Tauri)

```typescript
type FileKind = 'folder' | 'program' | 'document' | 'image' | 'video' | 'system' | 'archive' | 'other';

interface FileEntry {
  id:            string;   // SHA of full path
  name:          string;
  path:          string;   // full absolute path
  kind:          FileKind;
  sizeBytes:     number;   // actual size
  sizeOnDisk:    number;   // size including cluster slack
  pctDisk:       number;   // % of total drive used space
  pctParent:     number;   // % of parent folder total size
  modified:      string;   // ISO 8601
  accessed:      string;   // ISO 8601
  isHidden:      boolean;
  isReadOnly:    boolean;
  isSystem:      boolean;
  childFiles:    number;   // direct files (folders only)
  childFolders:  number;   // direct subfolders (folders only)
  totalItems:    number;   // recursive total (folders only)
}

interface DiskInfo {
  label:       string;
  filesystem:  'NTFS' | 'FAT' | 'FAT32' | 'exFAT' | 'ReFS' | 'Unknown';
  totalBytes:  number;
  usedBytes:   number;
  freeBytes:   number;
}
```

---

## 4. Scanning Strategy

Scan behavior is chosen automatically at runtime based on filesystem type and admin privileges.

```
scan_dir(path) {
  1. Detect filesystem type via GetVolumeInformation()
  2. Check if running as Administrator
  3. if filesystem == NTFS && is_admin:
       → read MFT directly (ntfs crate) — fastest path
  4. else:
       → use FindFirstFile / FindNextFile (Windows API) — universal fallback
  5. Both paths return identical Vec<FileEntry>
}
```

### Why per filesystem:

| Filesystem | Strategy | Reason |
|---|---|---|
| NTFS + Admin | MFT direct read | MFT is documented, single binary stream, extremely fast |
| NTFS no Admin | Windows API | No permission for raw disk access |
| ReFS | Windows API | Microsoft has not documented ReFS internal format |
| exFAT | Windows API | No centralized metadata store |
| FAT32 / FAT | Windows API | FAT + directory entries are simple; drives are small anyway |

### Rust implementation notes:
- Use `sysinfo` crate to detect filesystem type per mount point
- Use `windows` or `winapi` crate for `GetVolumeInformation`
- Use `ntfs` crate for MFT parsing on NTFS
- Use `std::fs` + `walkdir` as base for Windows API path
- All commands must be registered in `main.rs` via `.invoke_handler(tauri::generate_handler![...])`
- All structs need `#[derive(Serialize, Deserialize)]` for JSON bridge

---

## 5. Tauri Commands

All in `src-tauri/src/commands/`. Register all in `main.rs`.

```rust
// scan.rs
#[tauri::command] get_drives() -> Vec<DiskInfo>
#[tauri::command] scan_dir(path: String, depth: Option<u32>) -> ScanResult
#[tauri::command] get_dir_children(path: String) -> Vec<FileEntry>

// file_ops.rs
#[tauri::command] delete_to_trash(paths: Vec<String>) -> Result<(), String>
#[tauri::command] delete_permanent(paths: Vec<String>) -> Result<(), String>
#[tauri::command] rename_file(path: String, new_name: String) -> Result<(), String>

// system.rs
#[tauri::command] open_in_explorer(path: String) -> Result<(), String>
#[tauri::command] copy_to_clipboard(text: String) -> Result<(), String>
#[tauri::command] get_file_info(path: String) -> Result<FileEntry, String>
```

### tauri.conf.json permissions needed:
```json
"allowlist": {
  "fs": { "all": true, "scope": ["**"] },
  "shell": { "open": true },
  "clipboard": { "writeText": true }
}
```

---

## 6. Global State (Zustand)

```typescript
interface AppState {
  // Scan
  currentPath:     string;
  scanRoot:        string;
  entries:         FileEntry[];
  isScanning:      boolean;
  diskInfo:        DiskInfo | null;

  // Navigation
  breadcrumbs:     string[];

  // Selection
  selectedIds:     Set<string>;

  // UI
  sidePanelItem:   FileEntry | null;
  sidePanelOpen:   boolean;
  visibleColumns:  string[];
  activeFilter:    FileKind | 'all';
  searchQuery:     string;
  showHidden:      boolean;
  sortKey:         keyof FileEntry;
  sortDir:         'asc' | 'desc';
}
```

---

## 7. Features

### 7.1 Toolbar (top)
- Drive dropdown → lists all mounted drives from `get_drives()`
- Custom path text input + Browse button
- Scan button → calls `scan_dir()`
- Search input → debounced 200ms, filters by name client-side
- Type filter chips: All · Folders · Programs · Documents · Images · Videos · System · Archives
- Show hidden toggle
- Column visibility button (gear icon) → dropdown with checkboxes

### 7.2 Breadcrumb
- Shows full path segments from scan root to current folder
- Each segment clickable → navigates to that level
- Backspace → parent folder
- Home → scan root

### 7.3 Disk Usage Bar
- Full-width bar below toolbar
- Shows: used (blue fill) / free / total
- Label: "X GB used of Y GB (Z%)"

### 7.4 File Table (TanStack Table)
Columns (all toggleable except Name):
- Checkbox · Name · Size · Size on Disk · % Disk · % Parent · Type · Modified · Accessed

Behavior:
- Default sort: Size descending
- Click header → sort asc/desc
- Double-click folder → navigate into it
- Right-click row → context menu
- Checkbox → select row
- Ctrl+A → select all visible
- Shift+click → range select
- Color coding per row based on % of parent:
  - >30% → red background
  - 10–30% → amber background
  - <10% → green background
- Virtual scroll via TanStack Virtual (handles 100,000+ rows)
- Sub-label under name: "842 files, 120 folders" for folders

### 7.5 Context Menu (right-click)
```
Open in Explorer
Copy Path
Copy Name
───────────
Delete →
  Send to Trash        ← no confirmation
  Delete Permanently   ← confirmation dialog
───────────
Properties
```
- Close on: Escape · outside click · scroll

### 7.6 Row Action Buttons (visible on hover)
Only two inline buttons per row:
- Delete (trash icon)
- Open in Explorer

Everything else is in the context menu.

### 7.7 Side Panel (right side, 280px default)
- Opens on: Properties in context menu · P key
- No popup/modal — it's a persistent panel
- Resizable (drag handle) · collapsible
- Shows:
  - Name (editable inline → calls rename_file)
  - Full path
  - Kind + icon
  - Size (human-readable + raw bytes)
  - Size on disk
  - % of disk
  - % of parent
  - Modified date/time
  - Accessed date/time
  - Attributes: Hidden · Read-only · System (badge toggles)
  - For folders: child files · child folders · total items (recursive)
  - Copy Path button at bottom

### 7.8 Delete Flow
- **Send to Trash** → `delete_to_trash()` · no confirmation · instant
- **Delete Permanently** → show `DeleteDialog` first:
  - Lists items (name + size each)
  - Shows total size to be freed
  - Buttons: Cancel · Delete Permanently (red)
  - This is the ONLY popup/modal in the app

### 7.9 Keyboard Shortcuts

| Key | Action |
|---|---|
| Delete | Send selected to Trash |
| Shift+Delete | Delete permanently (shows dialog) |
| Backspace | Navigate to parent folder |
| Enter / Double-click | Open/navigate into folder |
| Ctrl+A | Select all visible |
| Ctrl+C | Copy path of selected |
| Escape | Clear selection / close side panel |
| P | Open Properties in side panel |
| F5 | Re-scan current folder |
| Ctrl+F | Focus search input |

All shortcuts in a single `useKeyboard` hook attached at App level.

---

## 8. Implementation Phases

### Phase 1 — Foundation
- [ ] Tauri scaffold + verify dev server runs
- [ ] `get_drives` Rust command
- [ ] `scan_dir` Rust command (Windows API path first)
- [ ] Basic React file table with sort
- [ ] Breadcrumb navigation
- [ ] Backspace to parent

### Phase 2 — Core Features
- [ ] MFT fast path for NTFS + admin
- [ ] Multi-select (checkbox, Ctrl+A, Shift+click)
- [ ] Context menu
- [ ] Delete (trash + permanent with dialog)
- [ ] Side panel properties
- [ ] All keyboard shortcuts via useKeyboard

### Phase 3 — Polish
- [ ] Color coding by size
- [ ] Show/hide columns
- [ ] Type filter chips
- [ ] Search (debounced)
- [ ] Disk usage bar
- [ ] % parent + % disk columns
- [ ] Virtual scroll (TanStack Virtual)
- [ ] Show hidden files toggle

### Phase 4 — Release
- [ ] Dark mode (system theme detection)
- [ ] App icon
- [ ] Build pipeline (GitHub Actions)
- [ ] README with screenshots
- [ ] GitHub release with .exe installer

---

## 9. Rules for Claude Code

1. Start with Phase 1 — nothing else works without `scan_dir`
2. `scan_dir` Windows API path first, MFT second
3. All Rust structs need `#[derive(Serialize, Deserialize, Clone)]`
4. Register ALL commands in `main.rs` builder or they won't be callable
5. TanStack Table owns sort/filter state — do NOT duplicate in Zustand
6. Side panel reads from `sidePanelItem` in Zustand store
7. `useKeyboard` hook at App level, single `useEffect`, cleanup on unmount
8. Context menu: close on Escape + mousedown outside + scroll
9. For Windows trash: use `trash` crate — do NOT use `std::fs::remove_file`
10. Test with a folder that has 50,000+ files before calling Phase 1 done