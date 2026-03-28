import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store/useStore';
import { DiskInfo, FileEntry, ScanResult } from '../../types';
import { allColumns } from './columns';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import './FileTable.css';

const ROW_HEIGHT = 38;

interface CtxState {
  x: number;
  y: number;
  entry: FileEntry;
  entries: FileEntry[];  // items the menu acts on
}

interface RubberBand {
  x0: number; y0: number;  // client viewport coords at mousedown
  x1: number; y1: number;  // current client viewport coords
}

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

  const [sorting, setSorting]               = useState<SortingState>([{ id: 'sizeBytes', desc: true }]);
  const [ctx, setCtx]                       = useState<CtxState | null>(null);
  const [deleteTargets, setDeleteTargets]   = useState<FileEntry[] | null>(null);
  const [shallowEntries, setShallowEntries] = useState<FileEntry[]>([]);
  const [rubberBand, setRubberBand]         = useState<RubberBand | null>(null);

  const anchorIndexRef = useRef<number | null>(null);
  const scrollRef      = useRef<HTMLDivElement>(null);
  const rowsRef        = useRef<typeof rows>([]); // kept current for rubber-band closure

  // ── In-tree entries for current path ───────────────────────────────────────

  const treeEntries = useMemo(() =>
    entries.filter((e) => e.parent.toLowerCase() === currentPath.toLowerCase()),
    [entries, currentPath]
  );

  // ── Shallow listing for unscanned paths ────────────────────────────────────

  useEffect(() => {
    if (!currentPath || isScanning || treeEntries.length > 0) {
      setShallowEntries([]);
      return;
    }
    let cancelled = false;
    invoke<FileEntry[]>('get_dir_children', { path: currentPath })
      .then((children) => {
        if (cancelled) return;
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

  const baseEntries = treeEntries.length > 0 ? treeEntries : shallowEntries;

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

  const rows = table.getRowModel().rows;

  // keep rowsRef current for use inside event handler closures
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  const virtualizer  = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  const virtualItems = virtualizer.getVirtualItems();

  // ── Navigation ─────────────────────────────────────────────────────────────

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

  // ── Row click / selection ──────────────────────────────────────────────────

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

  function handleCheckbox(
    e: React.ChangeEvent<HTMLInputElement>,
    entry: FileEntry,
    rowIndex: number,
  ) {
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

  // ── Context menu ───────────────────────────────────────────────────────────

  function handleContextMenu(e: React.MouseEvent, entry: FileEntry, rowIndex: number) {
    e.preventDefault();
    const inSelection = selectedIds.has(entry.id);

    let targetEntries: FileEntry[];
    if (inSelection && selectedIds.size > 1) {
      // Right-click on a selected item → act on entire selection
      targetEntries = rows
        .filter((r) => selectedIds.has(r.original.id))
        .map((r) => r.original);
    } else {
      // Right-click on an unselected item → select only that item
      targetEntries = [entry];
      setSelectedIds(new Set([entry.id]));
      anchorIndexRef.current = rowIndex;
    }

    setCtx({ x: e.clientX, y: e.clientY, entry, entries: targetEntries });
  }

  // ── Delete helpers ─────────────────────────────────────────────────────────

  async function handleDeleteTrash(entriesToDelete: FileEntry[]) {
    try {
      await invoke('delete_to_trash', { paths: entriesToDelete.map((e) => e.path) });
      const ids = new Set(entriesToDelete.map((e) => e.id));
      setEntries(entries.filter((e) => !ids.has(e.id)));
      clearSelection();
    } catch (err) { console.error(err); }
  }

  async function confirmDeletePermanent() {
    if (!deleteTargets) return;
    try {
      await invoke('delete_permanent', { paths: deleteTargets.map((e) => e.path) });
      const ids = new Set(deleteTargets.map((e) => e.id));
      setEntries(entries.filter((e) => !ids.has(e.id)));
      clearSelection();
    } catch (err) { console.error(err); }
    finally { setDeleteTargets(null); }
  }

  // ── Rubber-band selection ──────────────────────────────────────────────────

  const handleBodyMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start rubber-band on background (not on a row)
    if ((e.target as HTMLElement).closest('.file-row')) return;
    if (e.button !== 0) return;

    clearSelection();
    const container = scrollRef.current!;
    const rect = container.getBoundingClientRect();
    const x0Client = e.clientX;
    const y0Client = e.clientY;

    setRubberBand({ x0: x0Client, y0: y0Client, x1: x0Client, y1: y0Client });

    function onMove(me: MouseEvent) {
      setRubberBand({ x0: x0Client, y0: y0Client, x1: me.clientX, y1: me.clientY });

      // Compute which rows intersect the band (using row index * height)
      const scrollTop = scrollRef.current?.scrollTop ?? 0;
      const y0Scroll = y0Client - rect.top + scrollTop;
      const y1Scroll = me.clientY - rect.top + scrollTop;
      const top    = Math.min(y0Scroll, y1Scroll);
      const bottom = Math.max(y0Scroll, y1Scroll);

      if (bottom - top < 4) return; // too small to count as a drag

      const ids = new Set<string>();
      rowsRef.current.forEach((row, i) => {
        const rowTop    = i * ROW_HEIGHT;
        const rowBottom = rowTop + ROW_HEIGHT;
        if (rowTop < bottom && rowBottom > top) ids.add(row.original.id);
      });
      setSelectedIds(ids);
    }

    function onUp() {
      setRubberBand(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  }, [clearSelection, setSelectedIds]);

  const allSelected  = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;
  const headerGroups = table.getHeaderGroups();

  return (
    <div className="file-table-wrapper">
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
      <div
        ref={scrollRef}
        className="file-table-body"
        onMouseDown={handleBodyMouseDown}
      >
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
                onDoubleClick={() => {
                  if (entry.kind === 'folder') {
                    navigateTo(entry);
                  } else {
                    invoke('open_path', { path: entry.path }).catch(console.error);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, entry, vRow.index)}
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

        {/* Rubber-band selection rectangle */}
        {rubberBand && scrollRef.current && (() => {
          const rect = scrollRef.current.getBoundingClientRect();
          const left   = Math.min(rubberBand.x0, rubberBand.x1) - rect.left;
          const top    = Math.min(rubberBand.y0, rubberBand.y1) - rect.top + scrollRef.current.scrollTop;
          const width  = Math.abs(rubberBand.x1 - rubberBand.x0);
          const height = Math.abs(rubberBand.y1 - rubberBand.y0);
          return (
            <div
              className="rubber-band"
              style={{ left, top, width, height }}
            />
          );
        })()}
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
          entries={ctx.entries}
          onClose={() => setCtx(null)}
          onDeleteTrash={handleDeleteTrash}
          onDeletePermanent={(entriesToDelete) => {
            setDeleteTargets(entriesToDelete);
            setCtx(null);
          }}
          onProperties={(e) => { setSidePanelItem(e); setSidePanelOpen(true); }}
        />
      )}

      {deleteTargets && (
        <div className="dialog-overlay" onClick={() => setDeleteTargets(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Permanently</h2>
            <p className="dialog-warning">This cannot be undone:</p>
            {deleteTargets.map((e) => (
              <div key={e.id} className="dialog-item"><strong>{e.name}</strong></div>
            ))}
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setDeleteTargets(null)}>Cancel</button>
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
