# Task 13 — Context Menu

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src/components/ContextMenu/ContextMenu.tsx`

## Goal
Right-click context menu on file table rows. A custom-rendered floating div (not native OS menu).

## Menu items
```
Open in Explorer
Copy Path
Copy Name
───────────
Delete →
  Send to Trash        ← no confirmation, immediate
  Delete Permanently   ← opens DeleteDialog
───────────
Properties
```

## Behavior
- Triggered by `onContextMenu` on each row
- Position: appears at mouse cursor coordinates
- Stays within viewport (flip if near edge)
- **Close on**:
  1. `Escape` key
  2. `mousedown` outside the menu
  3. `scroll` anywhere on page

## State
Keep context menu state local (not in Zustand):
```ts
const [menu, setMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null);
```

## Actions wired up
- **Open in Explorer** → `invoke('open_in_explorer', { path: entry.path })`
- **Copy Path** → `invoke('copy_to_clipboard', { text: entry.path })`
- **Copy Name** → `invoke('copy_to_clipboard', { text: entry.name })`
- **Send to Trash** → `invoke('delete_to_trash', { paths: [entry.path] })` then refresh
- **Delete Permanently** → set `deleteTarget` state → renders `DeleteDialog`
- **Properties** → `setSidePanelItem(entry)` + `setSidePanelOpen(true)`

## Notes
- Use `useEffect` to attach `mousedown` and `scroll` listeners when menu is open, clean up when closed
- "Delete →" item should expand to a submenu on hover, OR just show the two items inline with indentation
- No animation needed for Phase 2
