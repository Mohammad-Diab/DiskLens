# Task 17 — Side Panel

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src/components/SidePanel/SidePanel.tsx`

## Goal
Persistent right-side panel showing file/folder properties. Not a popup — it pushes the table content area to the left.

## Layout
- Default width: 280px
- Resizable via drag handle on the left edge
- Collapsible (hide/show via `sidePanelOpen` in Zustand)
- Driven by `sidePanelItem: FileEntry | null` in Zustand

## Content to display
```
[Icon]  filename.ext
        folder or file type badge

Path:         C:\Users\...
Kind:         Document
Size:         3.2 MB (3,342,156 bytes)
Size on Disk: 3.4 MB
% of Disk:    0.02%
% of Parent:  12.4%

Modified:     2024-11-15 14:32
Accessed:     2025-01-02 09:10

Attributes:   [Hidden] [Read-only] [System]  ← badge chips

— Folders only —
Child files:    842
Child folders:  12
Total items:    854

[Copy Path]  ← button at bottom
```

## Rename in-place
- The filename at the top is an inline-editable field
- Click to edit → input appears → Enter or blur → calls `invoke('rename_file', { path, newName })`
- On success: update the entry in Zustand store + refresh `sidePanelItem`
- On error: revert to original name + show error

## Notes
- Open on: `Properties` context menu item, or `P` key (keyboard handled in Task 18)
- Close on: `Escape` key (sets `sidePanelOpen: false`)
- When `sidePanelItem` changes, do NOT re-fetch — just re-render from the current entry
- Attribute badges are display-only in Phase 2 (no toggle functionality needed)
