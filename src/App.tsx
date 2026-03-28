import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import './App.css';
import { Breadcrumb } from './components/Breadcrumb/Breadcrumb';
import { FileTable } from './components/FileTable/FileTable';
import { Footer } from './components/Footer/Footer';
import { SidePanel } from './components/SidePanel/SidePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { useKeyboard } from './hooks/useKeyboard';
import { useStore } from './store/useStore';

const BANNER_KEY = 'disklens-admin-banner-dismissed';

function App() {
  const sidePanelOpen = useStore((s) => s.sidePanelOpen);
  const [bannerVisible, setBannerVisible] = useState(() => localStorage.getItem(BANNER_KEY) !== '1');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    invoke<boolean>('is_admin').then(setIsAdmin).catch(() => {});
  }, []);
  const entries         = useStore((s) => s.entries);
  const isScanning      = useStore((s) => s.isScanning);
  const setScanProgress = useStore((s) => s.setScanProgress);
  const setScanStatus   = useStore((s) => s.setScanStatus);

  useKeyboard();

  // Listen to scan_progress events from Rust
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<number>('scan_progress', (event) => {
      setScanProgress(event.payload);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setScanProgress]);

  // Listen to scan_status events from Rust (phase descriptions)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>('scan_status', (event) => {
      setScanStatus(event.payload);
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [setScanStatus]);

  // Reset progress counter when a new scan begins
  useEffect(() => {
    if (isScanning) setScanProgress(0);
  }, [isScanning]);

  const hasScanned = entries.length > 0 || isScanning;

  const banner = bannerVisible && (
    <div className="app-banner">
      <span className="app-banner-icon">⚡</span>
      <span className="app-banner-text">
        {isAdmin
          ? 'Select a drive root (e.g. C:\\) for ultra-fast NTFS scanning via the file index.'
          : 'Run as Administrator and select a drive root (e.g. C:\\) for ultra-fast NTFS scanning via the file index.'}
      </span>
      <button
        className="app-banner-close"
        onClick={() => { localStorage.setItem(BANNER_KEY, '1'); setBannerVisible(false); }}
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );

  if (!hasScanned) {
    return (
      <div className="app app-hero">
        {banner}
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
      {banner}
      <Toolbar />
      <Breadcrumb />
      <div className="main-content">
        <FileTable />
        {sidePanelOpen && <SidePanel />}
      </div>
      <Footer />
    </div>
  );
}

export default App;
