import {
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useStore } from '../../store/useStore';
import { FileEntry } from '../../types';
import { allColumns } from './columns';
import './FileTable.css';

function buildBreadcrumbs(path: string): string[] {
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const crumbs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    // Reconstruct absolute path per segment
    const segment = parts.slice(0, i + 1).join('/');
    // Re-add backslash for Windows drive root (e.g. "C:" → "C:\")
    crumbs.push(segment.includes(':') && i === 0 ? segment + '\\' : segment.replace(/\//g, '\\'));
  }
  return crumbs;
}

export function FileTable() {
  const {
    entries,
    visibleColumns,
    setCurrentPath,
    setBreadcrumbs,
    setEntries,
    setIsScanning,
  } = useStore();

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'sizeBytes', desc: true },
  ]);

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

  async function navigateTo(entry: FileEntry) {
    if (entry.kind !== 'folder') return;
    setIsScanning(true);
    try {
      const result = await invoke<{ path: string; entries: FileEntry[]; total: number }>(
        'scan_dir',
        { path: entry.path }
      );
      setEntries(result.entries);
      setCurrentPath(result.path);
      setBreadcrumbs(buildBreadcrumbs(result.path));
    } finally {
      setIsScanning(false);
    }
  }

  return (
    <div className="file-table-wrapper">
      <table className="file-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
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
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const entry = row.original;
            const pct = entry.pctParent;
            let rowClass = '';
            if (pct > 30) rowClass = 'row-red';
            else if (pct >= 10) rowClass = 'row-amber';
            else if (pct > 0) rowClass = 'row-green';

            return (
              <tr
                key={row.id}
                className={rowClass}
                onDoubleClick={() => navigateTo(entry)}
              >
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
    </div>
  );
}
