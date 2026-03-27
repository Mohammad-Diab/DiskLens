import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, Settings, Scan, FolderOpen } from 'lucide-react';
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

interface ToolbarProps {
  showFilters?: boolean;
}

export function Toolbar({ showFilters = true }: ToolbarProps) {
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

  const [drives, setDrives] = useState<DiskInfo[]>([]);
  const [inputPath, setInputPath] = useState('');
  const [error, setError] = useState('');
  const [showColMenu, setShowColMenu] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  // Path autocomplete
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownMode, setDropdownMode] = useState<'drives' | 'suggestions'>('drives');
  const [pathSuggestions, setPathSuggestions] = useState<string[]>([]);
  const pathWrapRef = useRef<HTMLDivElement>(null);
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
        setShowDropdown(suggestions.length > 0);
      } catch {
        setShowDropdown(false);
      }
    }, 200);
    return () => clearTimeout(id);
  }, [inputPath]);

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
      {/* Row 1: path + browse + scan */}
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

        <button className="scan-btn" onClick={handleScan} disabled={isScanning || !inputPath.trim()}>
          <Scan size={14} />
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {/* Row 2: search + filters + toggles (hidden in hero mode) */}
      {showFilters && (
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
      )}

      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}
