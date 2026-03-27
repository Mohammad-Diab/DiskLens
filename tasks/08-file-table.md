# Task 08 — Basic FileTable

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**Files**: `src/components/FileTable/FileTable.tsx`, `src/components/FileTable/columns.tsx`

## Goal
Render the main file list using TanStack Table v8 with sorting. This is the primary UI component.

## Columns (Phase 1 subset)
| Column key  | Header         | Notes |
|-------------|----------------|-------|
| name        | Name           | Not toggleable; shows icon + sub-label for folders |
| sizeBytes   | Size           | Format: human-readable (KB/MB/GB) |
| sizeOnDisk  | Size on Disk   | Same format |
| kind        | Type           | FileKind label |
| modified    | Modified       | Format: `yyyy-MM-dd HH:mm` |

Full column set (toggleable) added in Phase 3.

## Behavior
- Default sort: `sizeBytes` descending
- Click column header → toggle asc/desc sort
- Double-click folder row → call `setCurrentPath` + `scan_dir` for that folder
- Row hover → show inline action buttons (Task 14 adds delete/open)
- Right-click → context menu (Task 13)

## Implementation

```tsx
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from '@tanstack/react-table';

// columns.tsx — define ColumnDef<FileEntry>[] array
// FileTable.tsx — useReactTable hook + render <table>
```

### Sub-label for folders
Under the folder name, render:
```tsx
{row.kind === 'folder' && row.totalItems > 0 && (
  <span className="sub-label">{row.childFiles} files, {row.childFolders} folders</span>
)}
```

### Human-readable size helper
```ts
function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
  return n + ' B';
}
```

## Notes
- Sorting state lives in TanStack Table (not Zustand)
- Read `entries` from Zustand store
- Phase 3 adds virtual scroll — design with that in mind (keep the row render simple)
- Install deps: `npm install @tanstack/react-table`
