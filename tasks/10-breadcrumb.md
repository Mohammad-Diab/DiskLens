# Task 10 — Breadcrumb Navigation

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src/components/Breadcrumb/Breadcrumb.tsx`

## Goal
Show the current path as clickable segments. Clicking any segment navigates to that level and re-scans.

## Behavior
- Parse `currentPath` into segments: `C:\Users\foo\Documents` → `[C:\, Users, foo, Documents]`
- Render as: `C:\ > Users > foo > Documents`
- Each segment is a button — clicking it calls `scan_dir` for that path
- The last segment (current) is not a link
- **Backspace key** → navigate to parent (handled in `useKeyboard` — Task 18, but wire up the navigation logic here as a helper)
- **Home key** (or Home icon click) → navigate to `scanRoot`

## Helper: buildBreadcrumbs
```ts
function buildBreadcrumbs(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  // rebuild absolute paths for each segment
  // e.g. ["C:\\", "C:\\Users", "C:\\Users\\foo"]
}
```

## Notes
- Use `>` or a chevron icon (Lucide `ChevronRight`) as separator
- Keep it single-line with overflow hiding long paths on the left
- Update `breadcrumbs` in Zustand on every navigation
