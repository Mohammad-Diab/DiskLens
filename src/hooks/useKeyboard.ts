import { RefObject, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../store/useStore';
import { ScanResult } from '../types';

function buildBreadcrumbs(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.map((_, i) => {
    const raw = parts.slice(0, i + 1).join('\\');
    return i === 0 && raw.includes(':') ? raw + '\\' : raw;
  });
}

function parentOf(path: string): string | null {
  const normalized = path.replace(/\\/g, '/').replace(/\/$/, '');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return null;
  const parent = normalized.slice(0, idx).replace(/\//g, '\\');
  return parent.includes(':') && !parent.endsWith('\\') ? parent + '\\' : parent;
}

export function useKeyboard(searchRef?: RefObject<HTMLInputElement | null>) {
  const store = useStore();

  useEffect(() => {
    async function handler(e: KeyboardEvent) {
      // Skip when typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const { currentPath, entries, selectedIds } = store;

      // Delete → Send to Trash
      if (e.key === 'Delete' && !e.shiftKey) {
        e.preventDefault();
        const paths = entries
          .filter((en) => selectedIds.has(en.id))
          .map((en) => en.path);
        if (paths.length === 0) return;
        try {
          await invoke('delete_to_trash', { paths });
          store.setEntries(entries.filter((en) => !selectedIds.has(en.id)));
          store.clearSelection();
        } catch (err) {
          console.error(err);
        }
        return;
      }

      // Shift+Delete → permanently delete (not implemented as dialog here; handled in FileTable)
      // The FileTable dialog is the canonical path for permanent delete.

      // Backspace → navigate to parent
      if (e.key === 'Backspace') {
        e.preventDefault();
        const parent = parentOf(currentPath);
        if (!parent) return;
        store.setIsScanning(true);
        try {
          const result = await invoke<ScanResult>('scan_dir', { path: parent });
          store.setEntries(result.entries);
          store.setCurrentPath(result.path);
          store.setBreadcrumbs(buildBreadcrumbs(result.path));
          store.clearSelection();
        } finally {
          store.setIsScanning(false);
        }
        return;
      }

      // Enter → navigate into selected folder
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIds.size !== 1) return;
        const [id] = selectedIds;
        const entry = entries.find((en) => en.id === id);
        if (!entry || entry.kind !== 'folder') return;
        store.setIsScanning(true);
        try {
          const result = await invoke<ScanResult>('scan_dir', { path: entry.path });
          store.setEntries(result.entries);
          store.setCurrentPath(result.path);
          store.setBreadcrumbs(buildBreadcrumbs(result.path));
          store.clearSelection();
        } finally {
          store.setIsScanning(false);
        }
        return;
      }

      // Ctrl+A → select all visible
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        store.setSelectedIds(new Set(entries.map((en) => en.id)));
        return;
      }

      // Ctrl+C → copy path of first selected
      if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        if (selectedIds.size === 0) return;
        const [id] = selectedIds;
        const entry = entries.find((en) => en.id === id);
        if (!entry) return;
        try {
          await invoke('copy_to_clipboard', { text: entry.path });
        } catch (err) {
          console.error(err);
        }
        return;
      }

      // Escape → clear selection or close side panel
      if (e.key === 'Escape') {
        if (store.sidePanelOpen) {
          store.setSidePanelOpen(false);
        } else {
          store.clearSelection();
        }
        return;
      }

      // P → open properties in side panel
      if (e.key === 'p' || e.key === 'P') {
        if (selectedIds.size === 0) return;
        const [id] = selectedIds;
        const entry = entries.find((en) => en.id === id);
        if (!entry) return;
        store.setSidePanelItem(entry);
        store.setSidePanelOpen(true);
        return;
      }

      // F5 → re-scan current folder
      if (e.key === 'F5') {
        e.preventDefault();
        if (!currentPath) return;
        store.setIsScanning(true);
        try {
          const result = await invoke<ScanResult>('scan_dir', { path: currentPath });
          store.setEntries(result.entries);
          store.clearSelection();
        } finally {
          store.setIsScanning(false);
        }
        return;
      }

      // Ctrl+F → focus search
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchRef?.current?.focus();
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store, searchRef]);
}
