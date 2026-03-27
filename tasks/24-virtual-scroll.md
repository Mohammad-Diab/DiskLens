# Task 24 — Virtual Scroll (TanStack Virtual)

**Phase**: 3 — Polish
**Status**: [ ] Not started
**File**: `src/components/FileTable/FileTable.tsx`

## Goal
Replace the plain `<table>` render with a virtualized list that only renders visible rows. Required for 100,000+ file performance.

## Library
`@tanstack/react-virtual` v3

## Implementation

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const rowVirtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 36,   // row height in px
  overscan: 20,
});

// Render:
<div ref={parentRef} style={{ height: '100%', overflow: 'auto' }}>
  <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
    {rowVirtualizer.getVirtualItems().map(virtualRow => {
      const row = rows[virtualRow.index];
      return (
        <div
          key={row.id}
          style={{
            position: 'absolute',
            top: 0,
            transform: `translateY(${virtualRow.start}px)`,
            width: '100%',
          }}
        >
          {/* render row */}
        </div>
      );
    })}
  </div>
</div>
```

## Notes
- Switch from `<table>/<tr>/<td>` to `<div>` layout for virtual rows (absolute positioning doesn't work with `<table>`)
- Keep column headers in a sticky non-virtualized `<div>` above the scroll container
- Row height should be consistent (36px or 40px) — variable height requires dynamic measurement
- Install: `npm install @tanstack/react-virtual`
- Test with a directory containing 50,000+ files — scroll should be smooth
