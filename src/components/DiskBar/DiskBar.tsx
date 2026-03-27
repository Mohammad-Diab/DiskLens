import { useStore } from '../../store/useStore';
import './DiskBar.css';

function formatBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + ' TB';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  return (n / 1e3).toFixed(0) + ' KB';
}

function isDriveRoot(path: string): boolean {
  // Matches "C:\", "C:", "c:\" etc.
  return /^[A-Za-z]:\\?$/.test(path.trim());
}

export function DiskBar() {
  const diskInfo   = useStore((s) => s.diskInfo);
  const currentPath = useStore((s) => s.currentPath);

  if (!diskInfo || !isDriveRoot(currentPath)) return null;

  const usedPct = diskInfo.totalBytes > 0
    ? (diskInfo.usedBytes / diskInfo.totalBytes) * 100
    : 0;

  const fillColor = usedPct > 90 ? '#ef4444' : '#3b82f6';

  // Drive letter without trailing slash, e.g. "C:"
  const driveLetter = diskInfo.driveLetter.replace(/\\+$/, '');

  return (
    <div className="disk-bar">
      <span className="disk-bar-drive">
        {driveLetter}
        {diskInfo.label && <span className="disk-bar-drive-label">{diskInfo.label}</span>}
      </span>
      <div className="disk-bar-track">
        <div
          className="disk-bar-fill"
          style={{ width: `${usedPct}%`, background: fillColor }}
        />
      </div>
      <span className="disk-bar-label">
        {formatBytes(diskInfo.usedBytes)} used of {formatBytes(diskInfo.totalBytes)} ({usedPct.toFixed(0)}%)
        &nbsp;·&nbsp;{formatBytes(diskInfo.freeBytes)} free
        {diskInfo.filesystem ? ` [${diskInfo.filesystem}]` : ''}
      </span>
    </div>
  );
}
