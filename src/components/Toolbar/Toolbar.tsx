import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Settings, Scan } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiskInfo, FileKind, ScanResult } from '../../types';
import './Toolbar.css';

function buildBreadcrumbs(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.map((_, i) => {
    const raw = parts.slice(0, i + 1).join('\\');
    return i === 0 && raw.includes(':') ? raw + '\\' : raw;
  });
}

const TOGGLEABLE_COLUMNS: { id: string; label: string }[] = [
  { id: 'sizeBytes', label: 'Size' },
  { id: 'sizeOnDisk', label: 'Size on Disk' },
  { id: 'pctDisk', label: '% Disk' },
  { id: 'pctParent', label: '% Parent' },
  { id: 'kind', label: 'Type' },
  { id: 'modified', label: 'Modified' },
  { id: 'accessed', label: 'Accessed' },
];

const KIND_FILTERS: { value: FileKind | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'folder', label: 'Folders' },
  { value: 'program', label: 'Programs' },
  { value: 'document', label: 'Documents' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'system', label: 'System' },
  { value: 'archive', label: 'Archives' },
];

export function Toolbar() {
  const {
    currentPath,
    isScanning,
    entries,
    visibleColumns,
    activeFilter,
    showHidden,
    setCurrentPath,
    setScanRoot,
    setEntries,
    setIsScanning,
    setBreadcrumbs,
    setDiskInfo,
    setVisibleColumns,
    setActiveFilter,
    setSearchQuery,
    setShowHidden,
  } = useStore();
  // searchQuery is set via setSearchQuery in the debounce effect; used by FileTable

  const [drives, setDrives] = useState<DiskInfo[]>([]);
  const [inputPath, setInputPath] = useState('');
  const [error, setError] = useState('');
  const [showColMenu, setShowColMenu] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<DiskInfo[]>('get_drives').then(setDrives).catch(console.error);
  }, []);

  useEffect(() => {
    setInputPath(currentPath);
  }, [currentPath]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(localSearch), 200);
    return () => clearTimeout(id);
  }, [localSearch]);

  // Close col menu on outside click
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

  async function handleScan() {
    const path = inputPath.trim();
    if (!path) return;
    setError('');
    setIsScanning(true);
    try {
      const result = await invoke<ScanResult>('scan_dir', { path });
      setEntries(result.entries);
      setCurrentPath(result.path);
      setScanRoot(result.path);
      setBreadcrumbs(buildBreadcrumbs(result.path));
      const drive = drives.find((d) =>
        result.path.toLowerCase().startsWith(d.driveLetter.toLowerCase())
      );
      setDiskInfo(drive ?? null);
    } catch (e) {
      setError(String(e));
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

  // Count entries per kind for filter badges
  const kindCounts: Record<string, number> = { all: entries.length };
  entries.forEach((e) => {
    kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1;
  });

  return (
    <div className="toolbar">
      {/* Row 1: drive + path + scan */}
      <div className="toolbar-row">
        <select className="drive-select" onChange={(e) => setInputPath(e.target.value)} defaultValue="">
          <option value="" disabled>Drive</option>
          {drives.map((d) => (
            <option key={d.driveLetter} value={d.driveLetter}>
              {d.driveLetter} {d.label ? `(${d.label})` : ''}
            </option>
          ))}
        </select>

        <input
          className="path-input"
          type="text"
          value={inputPath}
          onChange={(e) => setInputPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          placeholder="Enter path or select a drive..."
          spellCheck={false}
        />

        <button className="scan-btn" onClick={handleScan} disabled={isScanning || !inputPath.trim()}>
          <Scan size={14} />
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Row 2: search + filters + toggles */}
      <div className="toolbar-row toolbar-row-2">
        {/* Search */}
        <div className="search-box">
          <Search size={13} className="search-icon" />
          <input
            className="search-input"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search..."
          />
          {localSearch && (
            <button className="search-clear" onClick={() => { setLocalSearch(''); setSearchQuery(''); }}>×</button>
          )}
        </div>

        {/* Type filter chips */}
        <div className="filter-chips">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`chip${activeFilter === f.value ? ' chip-active' : ''}`}
              onClick={() => setActiveFilter(activeFilter === f.value && f.value !== 'all' ? 'all' : f.value)}
            >
              {f.label}
              {kindCounts[f.value] !== undefined && (
                <span className="chip-count">{kindCounts[f.value]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Show hidden toggle */}
        <label className="toggle-label">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Hidden
        </label>

        {/* Column visibility */}
        <div className="col-menu-wrap" ref={colMenuRef}>
          <button className="icon-btn" onClick={() => setShowColMenu((v) => !v)} title="Columns">
            <Settings size={14} />
          </button>
          {showColMenu && (
            <div className="col-menu">
              {TOGGLEABLE_COLUMNS.map((col) => (
                <label key={col.id} className="col-menu-item">
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

      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}
