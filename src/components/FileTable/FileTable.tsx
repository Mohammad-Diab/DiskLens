import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store/useStore';
import { FileEntry, ScanResult } from '../../types';
import { allColumns } from './columns';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import './FileTable.css';

const ROW_HEIGHT = 38;

function buildBreadcrumbs(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.map((_, i) => {
    const raw = parts.slice(0, i + 1).join('\\');
    return i === 0 && raw.includes(':') ? raw + '\\' : raw;
  });
}

interface CtxState { x: number; y: number; entry: FileEntry; }

export function FileTable() {
  // Individual selectors — component only re-renders when the specific
  // value it uses changes, not on every unrelated store update.
  const entries        = useStore((s) => s.entries);
  const isScanning     = useStore((s) => s.isScanning);
  const visibleColumns = useStore((s) => s.visibleColumns);
  const selectedIds    = useStore((s) => s.selectedIds);
  const activeFilter   = useStore((s) => s.activeFilter);
  const searchQuery    = useStore((s) => s.searchQuery);
  const showHidden     = useStore((s) => s.showHidden);

  // Actions are stable references — fine to grab all at once
  const setCurrentPath  = useStore((s) => s.setCurrentPath);
  const setBreadcrumbs  = useStore((s) => s.setBreadcrumbs);
  const setEntries      = useStore((s) => s.setEntries);
  const setIsScanning   = useStore((s) => s.setIsScanning);
  const setSelectedIds  = useStore((s) => s.setSelectedIds);
  const clearSelection  = useStore((s) => s.clearSelection);
  const setSidePanelItem = useStore((s) => s.setSidePanelItem);
  const setSidePanelOpen = useStore((s) => s.setSidePanelOpen);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'sizeBytes', desc: true }]);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const anchorIndexRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoised filter — only recalculates when data or filter params change,
  // NOT when selectedIds or other unrelated state changes.
  const filtered = useMemo(() =>
    entries.filter((e) => {
      if (!showHidden && e.isHidden) return false;
      if (activeFilter !== 'all' && e.kind !== activeFilter) return false;
      if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }),
    [entries, showHidden, activeFilter, searchQuery]
  );

  // Memoised columns — only recalculates when column visibility changes.
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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = virtualizer.getVirtualItems();

  async function navigateTo(entry: FileEntry) {
    if (entry.kind !== 'folder' || isScanning) return;
    setIsScanning(true);
    try {
      const result = await invoke<ScanResult>('scan_dir', { path: entry.path });
      setEntries(result.entries);
      setCurrentPath(result.path);
      setBreadcrumbs(buildBreadcrumbs(result.path));
      clearSelection();
    } finally {
      setIsScanning(false);
    }
  }

  function handleRowClick(e: React.MouseEvent, entry: FileEntry, rowIndex: number) {
    const id = entry.id;
    if (e.shiftKey && anchorIndexRef.current !== null) {
      const start = Math.min(anchorIndexRef.current, rowIndex);
      const end = Math.max(anchorIndexRef.current, rowIndex);
      const ids = new Set<string>();
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

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
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
            const row = rows[vRow.index];
            const entry = row.original;
            const isSelected = selectedIds.has(entry.id);
            const pct = entry.pctParent;
            let rowClass = 'file-row';
            if (isSelected) rowClass += ' row-selected';
            else if (pct > 30) rowClass += ' row-red';
            else if (pct >= 10) rowClass += ' row-amber';
            else if (pct > 0) rowClass += ' row-green';
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
