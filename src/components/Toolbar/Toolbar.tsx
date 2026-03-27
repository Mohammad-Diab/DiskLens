import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Scan } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DiskInfo, ScanResult } from '../../types';
import './Toolbar.css';

function buildBreadcrumbs(path: string): string[] {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const crumbs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const raw = parts.slice(0, i + 1).join('\\');
    crumbs.push(i === 0 && raw.includes(':') ? raw + '\\' : raw);
  }
  return crumbs;
}

export function Toolbar() {
  const {
    currentPath,
    isScanning,
    setCurrentPath,
    setScanRoot,
    setEntries,
    setIsScanning,
    setBreadcrumbs,
    setDiskInfo,
  } = useStore();

  const [drives, setDrives] = useState<DiskInfo[]>([]);
  const [inputPath, setInputPath] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    invoke<DiskInfo[]>('get_drives').then(setDrives).catch(console.error);
  }, []);

  useEffect(() => {
    setInputPath(currentPath);
  }, [currentPath]);

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

      // Set diskInfo from matching drive
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

  function handleDriveSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setInputPath(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleScan();
  }

  return (
    <div className="toolbar">
      <div className="toolbar-row">
        <select className="drive-select" onChange={handleDriveSelect} defaultValue="">
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
          onKeyDown={handleKeyDown}
          placeholder="Enter path or select a drive..."
          spellCheck={false}
        />

        <button
          className="scan-btn"
          onClick={handleScan}
          disabled={isScanning || !inputPath.trim()}
        >
          <Scan size={14} />
          {isScanning ? 'Scanning...' : 'Scan'}
        </button>
      </div>

      {error && <div className="toolbar-error">{error}</div>}
    </div>
  );
}
