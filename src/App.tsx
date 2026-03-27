import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import './App.css';
import { Breadcrumb } from './components/Breadcrumb/Breadcrumb';
import { DiskBar } from './components/DiskBar/DiskBar';
import { FileTable } from './components/FileTable/FileTable';
import { SidePanel } from './components/SidePanel/SidePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useKeyboard } from './hooks/useKeyboard';
import { useStore } from './store/useStore';

function App() {
  const sidePanelOpen = useStore((s) => s.sidePanelOpen);
  const entries         = useStore((s) => s.entries);
  const isScanning      = useStore((s) => s.isScanning);
  const setScanProgress = useStore((s) => s.setScanProgress);

  useKeyboard();

  // Listen to scan_progress events from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<number>('scan_progress', (event) => {
      setScanProgress(event.payload);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setScanProgress]);

  // Reset progress counter when a new scan begins
  useEffect(() => {
    if (isScanning) setScanProgress(0);
  }, [isScanning]);

  const hasScanned = entries.length > 0 || isScanning;

  if (!hasScanned) {
    return (
      <div className="app app-hero">
        <div className="hero-center">
          <div className="hero-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="10" fill="#3b82f6" />
              <rect x="10" y="28" width="8" height="12" rx="2" fill="#fff" fillOpacity="0.9" />
              <rect x="20" y="20" width="8" height="20" rx="2" fill="#fff" fillOpacity="0.7" />
              <rect x="30" y="12" width="8" height="28" rx="2" fill="#fff" fillOpacity="0.5" />
            </svg>
          </div>
          <div className="hero-title">DiskLens</div>
          <div className="hero-subtitle">Select a folder to analyze disk space usage</div>
          <div className="hero-toolbar">
            <Toolbar showFilters={false} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Toolbar />
      <DiskBar />
      <Breadcrumb />
      <div className="main-content">
        <FileTable />
        {sidePanelOpen && <SidePanel />}
      </div>
    </div>
  );
}

export default App;
