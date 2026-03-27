import { invoke } from '@tauri-apps/api/core';
import { ChevronRight } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ScanResult } from '../../types';
import './Breadcrumb.css';

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

export function Breadcrumb() {
  const {
    breadcrumbs,
    currentPath,
    isScanning,
    setCurrentPath,
    setBreadcrumbs,
    setEntries,
    setIsScanning,
  } = useStore();

  async function navigateTo(path: string) {
    if (isScanning || path === currentPath) return;
    setIsScanning(true);
    try {
      const result = await invoke<ScanResult>('scan_dir', { path });
      setEntries(result.entries);
      setCurrentPath(result.path);
      setBreadcrumbs(buildBreadcrumbs(result.path));
    } finally {
      setIsScanning(false);
    }
  }

  if (breadcrumbs.length === 0) return null;

  return (
    <div className="breadcrumb">
      {breadcrumbs.map((crumb, i) => {
        const isLast = i === breadcrumbs.length - 1;
        const label = crumb.split('\\').filter(Boolean).pop() ?? crumb;
        return (
          <span key={crumb} className="breadcrumb-segment">
            {i > 0 && <ChevronRight size={12} className="breadcrumb-sep" />}
            {isLast ? (
              <span className="breadcrumb-current">{label}</span>
            ) : (
              <button className="breadcrumb-link" onClick={() => navigateTo(crumb)}>
                {label}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}
