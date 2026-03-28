import { useStore } from '../../store/useStore';
import './Footer.css';

function formatBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + ' TB';
  if (n >= 1e9)  return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6)  return (n / 1e6).toFixed(1) + ' MB';
  return (n / 1e3).toFixed(0) + ' KB';
}

function isDriveRoot(path: string): boolean {
  return /^[A-Za-z]:\\?$/.test(path.trim());
}

export function Footer() {
  const entries     = useStore((s) => s.entries);
  const currentPath = useStore((s) => s.currentPath);
  const selectedIds = useStore((s) => s.selectedIds);
  const diskInfo    = useStore((s) => s.diskInfo);

  const folderEntries = entries.filter(
    (e) => e.parent.toLowerCase() === currentPath.toLowerCase()
  );
  const itemCount     = folderEntries.length;
  const folderSize    = folderEntries.reduce((sum, e) => sum + e.sizeBytes, 0);
  const selectedCount = selectedIds.size;

  const showDisk = diskInfo && isDriveRoot(currentPath);
  const usedPct  = showDisk
    ? (diskInfo!.totalBytes > 0 ? (diskInfo!.usedBytes / diskInfo!.totalBytes) * 100 : 0)
    : 0;
  const fillColor = usedPct > 90 ? '#ef4444' : '#3b82f6';

  return (
    <div className="footer">
      {/* Disk usage — only visible at drive root, no layout shift */}
      <div className="footer-disk">
        {showDisk && diskInfo && (
          <>
            <span className="footer-drive">
              {diskInfo.driveLetter.replace(/\\+$/, '')}
              {diskInfo.label && <span className="footer-drive-label"> {diskInfo.label}</span>}
            </span>
            <div className="footer-disk-track">
              <div
                className="footer-disk-fill"
                style={{ width: `${usedPct}%`, background: fillColor }}
              />
            </div>
            <span className="footer-disk-text">
              {formatBytes(diskInfo.usedBytes)} / {formatBytes(diskInfo.totalBytes)}
              {' '}({usedPct.toFixed(0)}%)
              {' '}·{' '}{formatBytes(diskInfo.freeBytes)} free
              {diskInfo.filesystem ? ` [${diskInfo.filesystem}]` : ''}
            </span>
          </>
        )}
      </div>

      {/* Folder / selection stats */}
      <div className="footer-stats">
        {itemCount > 0 && (
          <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
        )}
        {itemCount > 0 && folderSize > 0 && <span className="footer-dot">·</span>}
        {folderSize > 0 && <span>{formatBytes(folderSize)}</span>}
        {selectedCount > 0 && <span className="footer-dot">·</span>}
        {selectedCount > 0 && (
          <span className="footer-selected">{selectedCount} selected</span>
        )}
      </div>
    </div>
  );
}
