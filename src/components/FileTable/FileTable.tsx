import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store/useStore';
import { FileEntry, ScanResult } from '../../types';
import { allColumns } from './columns';
import { ContextMenu } from '../ContextMenu/ContextMenu';
import './FileTable.css';

function buildBreadcrumbs(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.map((_, i) => {
    const raw = parts.slice(0, i + 1).join('\\');
    return i === 0 && raw.includes(':') ? raw + '\\' : raw;
  });
}

interface CtxState {
  x: number;
  y: number;
  entry: FileEntry;
}

export function FileTable() {
  const {
    entries,
    visibleColumns,
    selectedIds,
    setCurrentPath,
    setBreadcrumbs,
    setEntries,
    setIsScanning,
    setSelectedIds,
    clearSelection,
    setSidePanelItem,
    setSidePanelOpen,
  } = useStore();

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sizeBytes', desc: true },
  ]);

  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);
  const anchorIndexRef = useRef<number | null>(null);

  const columns = allColumns.filter(
    (col) => col.id === 'name' || visibleColumns.includes(col.id as string)
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  async function navigateTo(entry: FileEntry) {
    if (entry.kind !== 'folder') return;
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
      const rangeIds = new Set<string>();
      for (let i = start; i <= end; i++) {
        rangeIds.add(rows[i].original.id);
      }
      setSelectedIds(rangeIds);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        anchorIndexRef.current = rowIndex;
      }
      setSelectedIds(next);
      return;
    }

    anchorIndexRef.current = rowIndex;
    setSelectedIds(new Set([id]));
  }

  function handleCheckboxChange(e: React.ChangeEvent<HTMLInputElement>, entry: FileEntry, rowIndex: number) {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(entry.id)) {
      next.delete(entry.id);
    } else {
      next.add(entry.id);
      anchorIndexRef.current = rowIndex;
    }
    setSelectedIds(next);
  }

  function handleHeaderCheckbox() {
    if (selectedIds.size === rows.length) {
      clearSelection();
    } else {
      setSelectedIds(new Set(rows.map((r) => r.original.id)));
    }
  }

  async function handleDeleteTrash(entry: FileEntry) {
    try {
      await invoke('delete_to_trash', { paths: [entry.path] });
      setEntries(entries.filter((e) => e.id !== entry.id));
      clearSelection();
    } catch (err) {
      console.error('Trash failed:', err);
    }
  }

  async function handleDeletePermanent(entry: FileEntry) {
    setDeleteTarget(entry);
  }

  async function confirmDeletePermanent() {
    if (!deleteTarget) return;
    try {
      await invoke('delete_permanent', { paths: [deleteTarget.path] });
      setEntries(entries.filter((e) => e.id !== deleteTarget.id));
      clearSelection();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteTarget(null);
    }
  }

  function handleProperties(entry: FileEntry) {
    setSidePanelItem(entry);
    setSidePanelOpen(true);
  }

  const allSelected = rows.length > 0 && selectedIds.size === rows.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

  return (
    <div className="file-table-wrapper">
      {selectedIds.size > 0 && (
        <div className="selection-bar">
          {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
        </div>
      )}

      <table className="file-table">
        <thead>
          <tr>
            <th className="col-checkbox">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected; }}
                onChange={handleHeaderCheckbox}
              />
            </th>
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <th
                key={header.id}
                onClick={header.column.getToggleSortingHandler()}
                className={header.column.getCanSort() ? 'sortable' : ''}
              >
                {flexRender(header.column.columnDef.header, header.getContext())}
                {header.column.getIsSorted() === 'asc' && ' ▲'}
                {header.column.getIsSorted() === 'desc' && ' ▼'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => {
            const entry = row.original;
            const isSelected = selectedIds.has(entry.id);
            const pct = entry.pctParent;
            let rowClass = isSelected ? 'row-selected' : '';
            if (!isSelected) {
              if (pct > 30) rowClass = 'row-red';
              else if (pct >= 10) rowClass = 'row-amber';
              else if (pct > 0) rowClass = 'row-green';
            }

            return (
              <tr
                key={row.id}
                className={rowClass}
                onClick={(e) => handleRowClick(e, entry, rowIndex)}
                onDoubleClick={() => navigateTo(entry)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtx({ x: e.clientX, y: e.clientY, entry });
                }}
              >
                <td className="col-checkbox" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => handleCheckboxChange(e, entry, rowIndex)}
                  />
                </td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          entry={ctx.entry}
          onClose={() => setCtx(null)}
          onDeleteTrash={handleDeleteTrash}
          onDeletePermanent={handleDeletePermanent}
          onProperties={handleProperties}
        />
      )}

      {deleteTarget && (
        <div className="dialog-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Permanently</h2>
            <p className="dialog-warning">
              This cannot be undone. The following will be permanently deleted:
            </p>
            <div className="dialog-item">
              <strong>{deleteTarget.name}</strong>
            </div>
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={confirmDeletePermanent}>
                Delete Permanently
              </button>
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
