# Task 21 — Type Filter Chips

**Phase**: 3 — Polish
**Status**: [ ] Not started
**File**: `src/components/Toolbar/Toolbar.tsx`

## Goal
Horizontal row of filter chips below the main toolbar row to filter the file list by type.

## Chips
```
[All] [Folders] [Programs] [Documents] [Images] [Videos] [System] [Archives]
```

## Behavior
- One chip active at a time (single-select)
- Clicking active chip → resets to "All"
- Active chip gets filled/highlighted style
- Filtering is client-side: filter `entries` in `FileTable` based on `activeFilter` from Zustand
- "All" shows everything (respects `showHidden` separately)

## Implementation in FileTable
```tsx
const { activeFilter, showHidden } = useStore();

const filtered = entries.filter(e => {
  if (!showHidden && e.isHidden) return false;
  if (activeFilter !== 'all' && e.kind !== activeFilter) return false;
  return true;
});
```

## Notes
- `activeFilter` state lives in Zustand (Task 07)
- Combine with search filter (Task 22) — both apply simultaneously
- Each chip shows a count badge: `Folders (12)` based on current entries
