# Task 14 — Delete Flow

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**Files**: `src/components/DeleteDialog/DeleteDialog.tsx`

## Goal
Implement both delete paths: send to trash (instant, no confirm) and permanent delete (confirmation dialog first).

## Send to Trash
- Call `invoke('delete_to_trash', { paths: string[] })`
- No dialog, no confirmation
- On success: remove deleted entries from `entries` in store, clear selection
- On error: show a brief inline error (toast or status bar message)

## Delete Permanently — DeleteDialog
Only modal/popup in the entire app.

### Dialog content
```
Delete Permanently

The following items will be permanently deleted and cannot be recovered:

  📄 report.pdf          3.2 MB
  📁 old-backups/       842 MB
  ...

Total: 845.2 MB will be freed

[Cancel]  [Delete Permanently]  ← red button
```

### Behavior
- Opens when: "Delete Permanently" clicked in context menu, OR Shift+Delete keyboard shortcut
- Lists all targeted items (name + human-readable size each)
- Shows total size sum
- Cancel → closes dialog, nothing deleted
- Delete Permanently → calls `invoke('delete_permanent', { paths })`, then removes from store + closes dialog
- Clicking outside the dialog or pressing Escape → same as Cancel

## Notes
- This is the ONLY modal/popup in the app — keep it focused
- `DeleteDialog` receives `items: FileEntry[]` + `onConfirm` + `onCancel` props
- Render it at App level (portal or conditional render) so it overlays everything
- After deletion, re-scan or surgically remove entries from the store (surgical removal is faster)
