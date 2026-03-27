# Task 25 — Show Hidden Files Toggle

**Phase**: 3 — Polish
**Status**: [ ] Not started
**File**: `src/components/Toolbar/Toolbar.tsx`

## Goal
A toggle in the toolbar to show or hide files/folders with the `isHidden` attribute.

## UI
- Toggle switch or checkbox labeled "Show hidden"
- Default: off (hidden files not shown)
- State lives in Zustand: `showHidden: boolean`

## Behavior
- When off: filter out entries where `isHidden === true`
- When on: show all entries including hidden ones
- Hidden entries when shown: render with reduced opacity (e.g. `opacity: 0.5`) so the user can distinguish them
- Applied client-side in FileTable, combined with type filter + search

## FileTable filter
```tsx
const visible = entries
  .filter(e => showHidden || !e.isHidden)
  .filter(e => activeFilter === 'all' || e.kind === activeFilter)
  .filter(e => !searchQuery || e.name.toLowerCase().includes(searchQuery.toLowerCase()));
```

## Notes
- `showHidden` in Zustand (Task 07)
- Does not trigger a re-scan — purely client-side filter
- System files (`isSystem`) are not affected by this toggle — they're always visible unless filtered by type
