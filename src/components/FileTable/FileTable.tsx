import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store/useStore';
import { DiskInfo, FileEntry, ScanResult } from '../../types';
import { allColumns } from './columns';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import './FileTable.css';

const ROW_HEIGHT = 38;

interface CtxState { x: number; y: number; entry: FileEntry; }

export function FileTable() {
  const entries        = useStore((s) => s.entries);
  const isScanning     = useStore((s) => s.isScanning);
  const scanProgress   = useStore((s) => s.scanProgress);
  const isPaused       = useStore((s) => s.isPaused);
  const visibleColumns = useStore((s) => s.visibleColumns);
  const selectedIds    = useStore((s) => s.selectedIds);
  const activeFilter   = useStore((s) => s.activeFilter);
  const searchQuery    = useStore((s) => s.searchQuery);
  const showHidden     = useStore((s) => s.showHidden);
  const currentPath    = useStore((s) => s.currentPath);
  const knownTotals    = useStore((s) => s.knownTotals);

  const navigate         = useStore((s) => s.navigate);
  const setScanRoot      = useStore((s) => s.setScanRoot);
  const setEntries       = useStore((s) => s.setEntries);
  const setIsScanning    = useStore((s) => s.setIsScanning);
  const setIsPaused      = useStore((s) => s.setIsPaused);
  const setDiskInfo      = useStore((s) => s.setDiskInfo);
  const setKnownTotal    = useStore((s) => s.setKnownTotal);
  const setSelectedIds   = useStore((s) => s.setSelectedIds);
  const clearSelection   = useStore((s) => s.clearSelection);
  const resetScan        = useStore((s) => s.resetScan);
  const setSidePanelItem = useStore((s) => s.setSidePanelItem);
  const setSidePanelOpen = useStore((s) => s.setSidePanelOpen);

  const [sorting, setSorting]           = useState<SortingState>([{ id: 'sizeBytes', desc: true }]);
  const [ctx, setCtx]                   = useState<CtxState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  // Shallow listing for paths not yet in the scanned tree
  const [shallowEntries, setShallowEntries] = useState<FileEntry[]>([]);
  const anchorIndexRef = useRef<number | null>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);

  // Direct children from the deep scan tree
  const treeEntries = useMemo(() =>
    entries.filter((e) => e.parent.toLowerCase() === currentPath.toLowerCase()),
    [entries, currentPath]
  );

  // When navigating to a path not in the tree, fetch a shallow listing
  useEffect(() => {
    if (!currentPath || isScanning || treeEntries.length > 0) {
      setShallowEntries([]);
      return;
    }
    let cancelled = false;
    invoke<FileEntry[]>('get_dir_children', { path: currentPath })
      .then((children) => {
        if (cancelled) return;
        // Enhance folder sizes with values from previously completed scans
        const enhanced = children.map((child) => {
          const known = knownTotals[child.path.toLowerCase()];
          if (child.kind === 'folder' && known !== undefined) {
            return { ...child, sizeBytes: known, sizeOnDisk: known };
          }
          return child;
        });
        setShallowEntries(enhanced);
      })
      .catch(() => { if (!cancelled) setShallowEntries([]); });
    return () => { cancelled = true; };
  }, [currentPath, treeEntries.length, isScanning]);

  // The base list: prefer deep-scan tree; fall back to shallow listing
  const baseEntries = treeEntries.length > 0 ? treeEntries : shallowEntries;

  // Apply search / kind / hidden filters
  const filtered = useMemo(() =>
    baseEntries.filter((e) => {
      if (!showHidden && e.isHidden) return false;
      if (activeFilter !== 'all' && e.kind !== activeFilter) return false;
      if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }),
    [baseEntries, showHidden, activeFilter, searchQuery]
  );

  const columns = useMemo(() =>
    allColumns.filter((col) => col.id === 'name' || visibleColumns.includes(col.id as string)),
    [visibleColumns]
  );

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows         = table.getRowModel().rows;
  const virtualizer  = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();

  async function navigateTo(entry: FileEntry) {
    if (entry.kind !== 'folder' || isScanning) return;

    const inTree = entries.some(
      (e) => e.parent.toLowerCase() === entry.path.toLowerCase()
    );

    if (inTree) {
      navigate(entry.path);
    } else {
      setIsScanning(true);
      try {
        const [result, drives] = await Promise.all([
          invoke<ScanResult>('scan_dir', { path: entry.path }),
          invoke<DiskInfo[]>('get_drives'),
        ]);
        setEntries(result.entries);
        setScanRoot(result.path);
        setKnownTotal(result.path, result.total);
        const drive = (drives as DiskInfo[]).find((d) =>
          result.path.toLowerCase().startsWith(d.driveLetter.toLowerCase())
        );
        setDiskInfo(drive ?? null);
        navigate(result.path);
      } finally {
        setIsScanning(false);
      }
    }
  }

  function handleRowClick(e: React.MouseEvent, entry: FileEntry, rowIndex: number) {
    const id = entry.id;
    if (e.shiftKey && anchorIndexRef.current !== null) {
      const start = Math.min(anchorIndexRef.current, rowIndex);
      const end   = Math.max(anchorIndexRef.current, rowIndex);
      const ids   = new Set<string>();
      for (let i = start; i <= end; i++) ids.add(rows[i].original.id);
      setSelectedIds(ids);
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      anchorIndexRef.current = rowIndex;
      setSelectedIds(next);
      return;
    }
    anchorIndexRef.current = rowIndex;
    setSelectedIds(new Set([id]));
  }

  function handleCheckbox(e: React.ChangeEvent<HTMLInputElement>, entry: FileEntry, rowIndex: number) {
    e.stopPropagation();
    const next = new Set(selectedIds);
    next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id);
    anchorIndexRef.current = rowIndex;
    setSelectedIds(next);
  }

  function handleHeaderCheckbox() {
    selectedIds.size === rows.length
      ? clearSelection()
      : setSelectedIds(new Set(rows.map((r) => r.original.id)));
  }

  async function handleDeleteTrash(entry: FileEntry) {
    try {
      await invoke('delete_to_trash', { paths: [entry.path] });
      setEntries(entries.filter((e) => e.id !== entry.id));
      clearSelection();
    } catch (err) { console.error(err); }
  }

  async function confirmDeletePermanent() {
    if (!deleteTarget) return;
    try {
      await invoke('delete_permanent', { paths: [deleteTarget.path] });
      setEntries(entries.filter((e) => e.id !== deleteTarget.id));
      clearSelection();
    } catch (err) { console.error(err); }
    finally { setDeleteTarget(null); }
  }

  const allSelected  = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;
  const headerGroups = table.getHeaderGroups();

  return (
    <div className="file-table-wrapper">
      {selectedIds.size > 0 && (
        <div className="selection-bar">
          {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
        </div>
      )}

      {/* Sticky header */}
      <div className="file-table-head">
        <div className="file-row file-row-header">
          <div className="file-cell col-checkbox">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => { if (el) el.indeterminate = someSelected; }}
              onChange={handleHeaderCheckbox}
            />
          </div>
          {headerGroups[0]?.headers.map((header) => (
            <div
              key={header.id}
              className={`file-cell${header.column.getCanSort() ? ' sortable' : ''}`}
              onClick={header.column.getToggleSortingHandler()}
              style={{ flex: header.id === 'name' ? '3' : '1' }}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {header.column.getIsSorted() === 'asc' && ' ▲'}
              {header.column.getIsSorted() === 'desc' && ' ▼'}
            </div>
          ))}
        </div>
      </div>

      {/* Virtual scroll body */}
      <div ref={scrollRef} className="file-table-body">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualItems.map((vRow) => {
            const row    = rows[vRow.index];
            const entry  = row.original;
            const isSelected = selectedIds.has(entry.id);
            const pct = entry.pctParent;
            let rowClass = 'file-row';
            if (isSelected)    rowClass += ' row-selected';
            else if (pct > 30)  rowClass += ' row-red';
            else if (pct >= 10) rowClass += ' row-amber';
            else if (pct > 0)   rowClass += ' row-green';
            if (entry.isHidden) rowClass += ' row-hidden';

            return (
              <div
                key={row.id}
                className={rowClass}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${vRow.start}px)`,
                  width: '100%',
                  height: ROW_HEIGHT,
                }}
                onClick={(e) => handleRowClick(e, entry, vRow.index)}
                onDoubleClick={() => navigateTo(entry)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({ x: e.clientX, y: e.clientY, entry });
                }}
              >
                <div className="file-cell col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleCheckbox(e, entry, vRow.index)}
                  />
                </div>
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className="file-cell"
                    style={{ flex: cell.column.id === 'name' ? '3' : '1' }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scanning overlay */}
      {isScanning && (
        <div className="table-scan-overlay">
          <div className={`table-scan-spinner${isPaused ? ' spinner-paused' : ''}`} />
          <span className="table-scan-label">
            {isPaused
              ? 'Paused'
              : `Scanning${scanProgress > 0 ? ` — ${scanProgress.toLocaleString()} items found` : '…'}`}
          </span>
          <div className="table-scan-actions">
            <button
              className="scan-ctrl-btn"
              onClick={async () => {
                if (isPaused) {
                  await invoke('resume_scan');
                  setIsPaused(false);
                } else {
                  await invoke('pause_scan');
                  setIsPaused(true);
                }
              }}
            >
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button
              className="scan-ctrl-btn scan-ctrl-stop"
              onClick={async () => {
                await invoke('stop_scan');
                setIsPaused(false);
                setIsScanning(false);
                resetScan();
              }}
            >
              ⏹ Stop
            </button>
          </div>
        </div>
      )}

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          entry={ctx.entry}
          onClose={() => setCtx(null)}
          onDeleteTrash={handleDeleteTrash}
          onDeletePermanent={(e) => setDeleteTarget(e)}
          onProperties={(e) => { setSidePanelItem(e); setSidePanelOpen(true); }}
        />
      )}

      {deleteTarget && (
        <div className="dialog-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Permanently</h2>
            <p className="dialog-warning">This cannot be undone:</p>
            <div className="dialog-item"><strong>{deleteTarget.name}</strong></div>
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn-danger" onClick={confirmDeletePermanent}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function selectAllRows(entries: FileEntry[], setSelectedIds: (ids: Set<string>) => void) {
  setSelectedIds(new Set(entries.map((e) => e.id)));
}
