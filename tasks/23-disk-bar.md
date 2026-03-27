# Task 23 — Disk Usage Bar

**Phase**: 3 — Polish
**Status**: [ ] Not started
**File**: `src/components/DiskBar/DiskBar.tsx`

## Goal
Full-width bar below the toolbar showing disk usage for the currently selected drive.

## Layout
```
[████████████████████░░░░░░░░░░░░]  47.3 GB used of 100 GB (47%)
```

- Blue filled portion = `usedBytes / totalBytes * 100%`
- Light gray empty portion = free space
- Label below or beside: `"X GB used of Y GB (Z%)"`

## Data source
- Read `diskInfo: DiskInfo | null` from Zustand store
- Toolbar populates `diskInfo` after `get_drives()` call (when drive is selected)
- If `diskInfo` is null, render nothing

## Component
```tsx
interface DiskBarProps {
  diskInfo: DiskInfo;
}

function DiskBar({ diskInfo }: DiskBarProps) {
  const usedPct = (diskInfo.usedBytes / diskInfo.totalBytes) * 100;
  return (
    <div className="disk-bar-container">
      <div className="disk-bar-track">
        <div className="disk-bar-fill" style={{ width: `${usedPct}%` }} />
      </div>
      <span>{formatBytes(diskInfo.usedBytes)} used of {formatBytes(diskInfo.totalBytes)} ({usedPct.toFixed(0)}%)</span>
    </div>
  );
}
```

## Notes
- Place between Toolbar and Breadcrumb in the layout
- Color the fill blue (`#3b82f6`) — optionally turn red if > 90% full
- `formatBytes` helper reused from FileTable (Task 08) — consider moving to a shared utils file
