import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, ArrowRight, ArrowUp, RefreshCw, Settings, ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiskInfo, ScanResult } from '../../types';
import './Breadcrumb.css';

const TOGGLEABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'sizeBytes',   label: 'Size' },
  { id: 'sizeOnDisk',  label: 'Size on Disk' },
  { id: 'pctDisk',     label: '% Disk' },
  { id: 'pctParent',   label: '% Parent' },
  { id: 'kind',        label: 'Type' },
  { id: 'modified',    label: 'Modified' },
  { id: 'accessed',    label: 'Accessed' },
];

function getParentPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return null; // already at drive root like "C:"
  const parentParts = parts.slice(0, -1);
  const raw = parentParts.join('\\');
  // Drive root: "C:" → "C:\"
  if (raw.includes(':') && !raw.includes('\\')) return raw + '\\';
  return raw;
}

export function Breadcrumb() {
  const breadcrumbs    = useStore((s) => s.breadcrumbs);
  const currentPath    = useStore((s) => s.currentPath);
  const isScanning     = useStore((s) => s.isScanning);
  const history        = useStore((s) => s.history);
  const historyIndex   = useStore((s) => s.historyIndex);
  const visibleColumns = useStore((s) => s.visibleColumns);

  const navigate       = useStore((s) => s.navigate);
  const goBack         = useStore((s) => s.goBack);
  const goForward      = useStore((s) => s.goForward);
  const setIsScanning  = useStore((s) => s.setIsScanning);
  const setEntries     = useStore((s) => s.setEntries);
  const setScanRoot    = useStore((s) => s.setScanRoot);
  const setDiskInfo    = useStore((s) => s.setDiskInfo);
  const setKnownTotal  = useStore((s) => s.setKnownTotal);
  const setVisibleColumns = useStore((s) => s.setVisibleColumns);

  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColMenu) return;
    function handle(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showColMenu]);

  if (breadcrumbs.length === 0) return null;

  const canBack    = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;
  const parentPath = getParentPath(currentPath);

  async function scanCurrent() {
    if (isScanning || !currentPath) return;
    setIsScanning(true);
    try {
      const [result, drives] = await Promise.all([
        invoke<ScanResult>('scan_dir', { path: currentPath }),
        invoke<DiskInfo[]>('get_drives'),
      ]);
      setEntries(result.entries);
      setScanRoot(result.path);
      setKnownTotal(result.path, result.total);
      const drive = (drives as DiskInfo[]).find((d) =>
        result.path.toLowerCase().startsWith(d.driveLetter.toLowerCase())
      );
      setDiskInfo(drive ?? null);
      // Keep currentPath (already there), but update navigate to refresh history
      navigate(result.path);
    } finally {
      setIsScanning(false);
    }
  }

  function toggleColumn(id: string) {
    if (visibleColumns.includes(id)) {
      setVisibleColumns(visibleColumns.filter((c) => c !== id));
    } else {
      setVisibleColumns([...visibleColumns, id]);
    }
  }

  return (
    <div className="breadcrumb">
      {/* Back */}
      <button
        className="breadcrumb-nav-btn"
        onClick={goBack}
        disabled={!canBack || isScanning}
        title="Go back"
      >
        <ArrowLeft size={13} />
      </button>

      {/* Forward */}
      <button
        className="breadcrumb-nav-btn"
        onClick={goForward}
        disabled={!canForward || isScanning}
        title="Go forward"
      >
        <ArrowRight size={13} />
      </button>

      {/* Up */}
      <button
        className="breadcrumb-nav-btn"
        onClick={() => parentPath && navigate(parentPath)}
        disabled={!parentPath || isScanning}
        title="Go up one level"
      >
        <ArrowUp size={13} />
      </button>

      <div className="breadcrumb-sep-line" />

      {/* Path segments */}
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        const label  = crumb.split('\\').filter(Boolean).pop() ?? crumb;
        return (
          <span key={crumb} className="breadcrumb-segment">
            {i > 0 && <ChevronRight size={12} className="breadcrumb-chevron" />}
            {isLast ? (
              <span className="breadcrumb-current">{label}</span>
            ) : (
              <button
                className="breadcrumb-link"
                onClick={() => navigate(crumb)}
                disabled={isScanning}
              >
                {label}
              </button>
            )}
          </span>
        );
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Scan current folder */}
      <button
        className="breadcrumb-scan-btn"
        onClick={scanCurrent}
        disabled={isScanning}
        title={`Scan ${currentPath}`}
      >
        <RefreshCw size={12} />
        Scan
      </button>

      {/* Column visibility gear */}
      <div className="breadcrumb-col-wrap" ref={colMenuRef}>
        <button
          className="breadcrumb-icon-btn"
          onClick={() => setShowColMenu((v) => !v)}
          title="Columns"
        >
          <Settings size={13} />
        </button>
        {showColMenu && (
          <div className="breadcrumb-col-menu">
            {TOGGLEABLE_COLUMNS.map((col) => (
              <label key={col.id} className="breadcrumb-col-item">
                <input
                  type="checkbox"
                  checked={visibleColumns.includes(col.id)}
                  onChange={() => toggleColumn(col.id)}
                />
                {col.label}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
