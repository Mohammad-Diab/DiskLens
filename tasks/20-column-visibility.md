# Task 20 — Column Visibility Toggle

**Phase**: 3 — Polish
**Status**: [ ] Not started
**Files**: `src/components/Toolbar/Toolbar.tsx`, `src/components/FileTable/FileTable.tsx`

## Goal
Let the user show/hide columns via a gear icon dropdown in the toolbar.

## All columns (Phase 3 full set)
| Key         | Label        | Toggleable |
|-------------|--------------|------------|
| name        | Name         | No (always visible) |
| sizeBytes   | Size         | Yes |
| sizeOnDisk  | Size on Disk | Yes |
| pctDisk     | % Disk       | Yes |
| pctParent   | % Parent     | Yes |
| kind        | Type         | Yes |
| modified    | Modified     | Yes |
| accessed    | Accessed     | Yes |

## Toolbar gear button
- Click gear icon → dropdown with checkboxes
- One checkbox per toggleable column
- Toggling a checkbox adds/removes that column key from `visibleColumns` in Zustand

## FileTable integration
```tsx
const { visibleColumns } = useStore();
// Filter columns array to only include visible ones + always-visible 'name'
const activeColumns = allColumns.filter(c => c.id === 'name' || visibleColumns.includes(c.id));
```

## Notes
- Default visible: all columns except `accessed` and `pctDisk` (keep table readable by default)
- `visibleColumns` lives in Zustand (Task 07)
- Dropdown closes on outside click (same pattern as context menu)
