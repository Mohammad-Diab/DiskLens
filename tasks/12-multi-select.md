# Task 12 — Multi-Select

**Phase**: 2 — Core Features
**Status**: [ ] Not started
**File**: `src/components/FileTable/FileTable.tsx`

## Goal
Allow selecting multiple rows with checkbox, Ctrl+A, and Shift+click. Selection state lives in Zustand (`selectedIds: Set<string>`).

## Behaviors

### Checkbox column
- Add a checkbox as the first column in the table
- Clicking a row checkbox toggles that row's ID in `selectedIds`
- Header checkbox: checked if all visible rows selected, indeterminate if some, unchecked if none
- Header checkbox click → select all / deselect all visible

### Ctrl+A
- Select all currently visible rows (after filters applied)
- Handled in `useKeyboard` hook (Task 18) — but the "select all" logic lives here as a function

### Shift+click
- Click a row → set anchor
- Shift+click another row → select all rows between anchor and target (inclusive)
- Track anchor index in local component state (not Zustand)

### Visual feedback
- Selected rows get a highlight background (e.g. `bg-blue-50`)
- Show selection count in toolbar: `"3 items selected"` when > 0

## Notes
- `selectedIds` is a `Set<string>` — always create a new Set when mutating for Zustand reactivity
- Clicking a row without Ctrl/Shift clears selection and selects only that row
- Escape key clears selection (handled in `useKeyboard`)
