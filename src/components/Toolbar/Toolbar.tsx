import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Scan, FolderOpen, FolderSearch } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiskInfo, FileKind, ScanResult } from '../../types';
import './Toolbar.css';

const KIND_FILTERS: { value: FileKind | 'all'; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'folder',   label: 'Folders' },
  { value: 'program',  label: 'Programs' },
  { value: 'document', label: 'Documents' },
  { value: 'image',    label: 'Images' },
  { value: 'video',    label: 'Videos' },
  { value: 'system',   label: 'System' },
  { value: 'archive',  label: 'Archives' },
];

interface ToolbarProps {
  showFilters?: boolean;
}

export function Toolbar({ showFilters = true }: ToolbarProps) {
  const {
    currentPath,
    isScanning,
    viewEntries,
    activeFilter,
    showHidden,
    navigate,
    setScanRoot,
    setEntries,
    setIsScanning,
    setDiskInfo,
    setKnownTotal,
    mergeKnownTotals,
    setActiveFilter,
    setSearchQuery,
    setShowHidden,
    resetScan,
  } = useStore();

  const [drives, setDrives]           = useState<DiskInfo[]>([]);
  const [inputPath, setInputPath]     = useState('');
  const [error, setError]             = useState('');
  const [localSearch, setLocalSearch] = useState('');

  // Path autocomplete
  const [showDropdown, setShowDropdown]     = useState(false);
  const [dropdownMode, setDropdownMode]     = useState<'drives' | 'suggestions'>('drives');
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const pathWrapRef = useRef<HTMLDivElement>(null);

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

  // Debounce path suggestions
  useEffect(() => {
    if (!inputPath.trim()) {
      setShowDropdown(false);
      setPathSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const suggestions = await invoke<string[]>('get_path_suggestions', { partial: inputPath });
        setPathSuggestions(suggestions);
        setDropdownMode('suggestions');
        const normalized = inputPath.trim().replace(/[\\/]+$/, '').toLowerCase();
        const exactMatch = suggestions.length === 1 &&
          suggestions[0].toLowerCase() === normalized;
        setShowDropdown(suggestions.length > 0 && !exactMatch);
      } catch {
        setShowDropdown(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [inputPath]);

  // Close path dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    function handle(e: MouseEvent) {
      if (pathWrapRef.current && !pathWrapRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showDropdown]);

  async function handleScan() {
    const path = inputPath.trim();
    if (!path) return;
    setError('');
    setShowDropdown(false);
    setIsScanning(true);
    try {
      const [result, driveList] = await Promise.all([
        invoke<ScanResult>('scan_dir', { path }),
        invoke<DiskInfo[]>('get_drives'),
      ]);
      setEntries(result.entries);
      setScanRoot(result.path);
      setKnownTotal(result.path, result.total);
      mergeKnownTotals(result.folderSizes);
      const drive = (driveList as DiskInfo[]).find((d) =>
        result.path.toLowerCase().startsWith(d.driveLetter.toLowerCase())
      );
      setDiskInfo(drive ?? null);
      navigate(result.path);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsScanning(false);
    }
  }

  async function handleBrowse() {
    try {
      const picked = await invoke<string | null>('pick_folder');
      if (picked) {
        setInputPath(picked);
        setShowDropdown(false);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function handlePathFocus() {
    if (!inputPath.trim() && drives.length > 0) {
      setDropdownMode('drives');
      setShowDropdown(true);
    }
  }

  function selectSuggestion(path: string) {
    setInputPath(path);
    setShowDropdown(false);
  }

  // viewEntries is kept in sync by FileTable (covers both scanned and lazy-loaded folders)
  const kindCounts: Record<string, number> = { all: viewEntries.length };
  viewEntries.forEach((e) => {
    kindCounts[e.kind] = (kindCounts[e.kind] ?? 0) + 1;
  });

  return (
    <div className="toolbar">
      {/* ── Hero mode: path selector + browse ── */}
      {!showFilters && (
        <div className="toolbar-row">
          <div className="path-wrap" ref={pathWrapRef}>
            <input
              className="path-input"
              type="text"
              value={inputPath}
              onChange={(e) => setInputPath(e.target.value)}
              onFocus={handlePathFocus}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { setShowDropdown(false); handleScan(); }
                if (e.key === 'Escape') setShowDropdown(false);
              }}
              placeholder="Enter path, select a drive, or Browse..."
              spellCheck={false}
            />
            {showDropdown && (
              <div className="path-dropdown">
                {dropdownMode === 'drives'
                  ? drives.map((d) => (
                      <div
                        key={d.driveLetter}
                        className="path-suggestion"
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(d.driveLetter); }}
                      >
                        <span className="suggestion-drive">{d.driveLetter}</span>
                        {d.label && <span className="suggestion-label">{d.label}</span>}
                      </div>
                    ))
                  : pathSuggestions.map((s) => (
                      <div
                        key={s}
                        className="path-suggestion"
                        onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s + '\\'); }}
                      >
                        {s}
                      </div>
                    ))
                }
              </div>
            )}
          </div>

          <button className="browse-btn" onClick={handleBrowse} disabled={isScanning}>
            <FolderOpen size={14} />
            Browse
          </button>
        </div>
      )}

      {/* Hero scan row */}
      {!showFilters && (
        <div className="toolbar-row toolbar-scan-hero">
          <button className="scan-btn" onClick={handleScan} disabled={isScanning || !inputPath.trim()}>
            <Scan size={14} />
            {isScanning ? 'Scanning...' : 'Scan'}
          </button>
        </div>
      )}

      {/* ── Normal mode: search + filters + new-scan ── */}
      {showFilters && (
        <div className="toolbar-row toolbar-row-2">
          {/* New scan — far left */}
          <button
            className="icon-btn"
            onClick={resetScan}
            title="Start a new scan"
          >
            <FolderSearch size={14} />
          </button>

          {/* Type filter chips — hide chips with 0 items in current folder */}
          <div className="filter-chips">
            {KIND_FILTERS.filter((f) =>
              f.value === 'all' || (kindCounts[f.value] ?? 0) > 0
            ).map((f) => (
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

          {/* Show hidden files toggle */}
          <label className="toggle-label" title="Show files and folders hidden by Windows">
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden
          </label>

          {/* Search — far right */}
          <div className="search-box" style={{ marginLeft: 'auto' }}>
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

        </div>
      )}

      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}
