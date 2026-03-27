import { useStore } from '../../store/useStore';
import './DiskBar.css';

function formatBytes(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + ' TB';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  return (n / 1e3).toFixed(0) + ' KB';
}

export function DiskBar() {
  const diskInfo = useStore((s) => s.diskInfo);

  if (!diskInfo) return null;

  const usedPct = diskInfo.totalBytes > 0
    ? (diskInfo.usedBytes / diskInfo.totalBytes) * 100
    : 0;

  const fillColor = usedPct > 90 ? '#ef4444' : '#3b82f6';

  return (
    <div className="disk-bar">
      <div className="disk-bar-track">
        <div
          className="disk-bar-fill"
          style={{ width: `${usedPct}%`, background: fillColor }}
        />
      </div>
      <span className="disk-bar-label">
        {formatBytes(diskInfo.usedBytes)} used of {formatBytes(diskInfo.totalBytes)} ({usedPct.toFixed(0)}%)
        &nbsp;·&nbsp;{formatBytes(diskInfo.freeBytes)} free
        {diskInfo.label ? ` · ${diskInfo.label}` : ''}
        {diskInfo.filesystem ? ` [${diskInfo.filesystem}]` : ''}
      </span>
    </div>
  );
}
