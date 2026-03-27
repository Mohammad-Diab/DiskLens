# Task 07 — Zustand Store

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src/store/useStore.ts`

## Goal
Set up the global Zustand store with all state slices and actions needed across phases.

## Full store shape

```typescript
import { create } from 'zustand';
import { FileEntry, DiskInfo, FileKind } from '../types';

interface AppState {
  // Scan state
  currentPath:    string;
  scanRoot:       string;
  entries:        FileEntry[];
  isScanning:     boolean;
  diskInfo:       DiskInfo | null;

  // Navigation
  breadcrumbs:    string[];

  // Selection
  selectedIds:    Set<string>;

  // UI
  sidePanelItem:  FileEntry | null;
  sidePanelOpen:  boolean;
  visibleColumns: string[];
  activeFilter:   FileKind | 'all';
  searchQuery:    string;
  showHidden:     boolean;

  // Actions
  setCurrentPath:   (path: string) => void;
  setScanRoot:      (path: string) => void;
  setEntries:       (entries: FileEntry[]) => void;
  setIsScanning:    (v: boolean) => void;
  setDiskInfo:      (info: DiskInfo | null) => void;
  setBreadcrumbs:   (crumbs: string[]) => void;
  setSelectedIds:   (ids: Set<string>) => void;
  toggleSelected:   (id: string) => void;
  clearSelection:   () => void;
  setSidePanelItem: (item: FileEntry | null) => void;
  setSidePanelOpen: (open: boolean) => void;
  setVisibleColumns:(cols: string[]) => void;
  setActiveFilter:  (f: FileKind | 'all') => void;
  setSearchQuery:   (q: string) => void;
  setShowHidden:    (v: boolean) => void;
}
```

## Default values
- `currentPath`: `''`
- `scanRoot`: `''`
- `entries`: `[]`
- `isScanning`: `false`
- `diskInfo`: `null`
- `breadcrumbs`: `[]`
- `selectedIds`: `new Set()`
- `sidePanelItem`: `null`
- `sidePanelOpen`: `false`
- `visibleColumns`: all columns except hidden by default
- `activeFilter`: `'all'`
- `searchQuery`: `''`
- `showHidden`: `false`

## Notes
- TanStack Table owns sort/filter state — do NOT add `sortKey`/`sortDir` here
- `Set<string>` needs careful handling with Zustand (create new Set on update for reactivity)
- Import `create` from `zustand` (not `zustand/vanilla`)
