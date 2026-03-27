# Task 19 — Color Coding by Size

**Phase**: 3 — Polish
**Status**: [ ] Not started
**File**: `src/components/FileTable/FileTable.tsx`

## Goal
Color each row's background based on how large the item is relative to its parent folder (`pctParent`).

## Rules
| pctParent   | Background color   |
|-------------|-------------------|
| > 30%       | Red (e.g. `#fee2e2` / `bg-red-100`)   |
| 10% – 30%   | Amber (`#fef3c7` / `bg-amber-100`)    |
| < 10%       | Green (`#dcfce7` / `bg-green-100`)    |
| 0 (unknown) | No color           |

## Implementation
Apply background color via inline style or CSS class on each `<tr>`:
```tsx
function getRowColor(pctParent: number): string {
  if (pctParent === 0) return '';
  if (pctParent > 30) return 'row-red';
  if (pctParent >= 10) return 'row-amber';
  return 'row-green';
}
```

## Notes
- `pctParent` is computed by the Rust backend during scan — available in every `FileEntry`
- Selected rows still show selection highlight (selection style should override color coding)
- Keep colors subtle (pastel) so text remains readable
