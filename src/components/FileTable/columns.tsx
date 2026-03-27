import { ColumnDef } from '@tanstack/react-table';
import { FileEntry } from '../../types';

export function formatBytes(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' KB';
  return n + ' B';
}

function formatDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${day} ${h}:${m}`;
  } catch {
    return iso;
  }
}

export const allColumns: ColumnDef<FileEntry>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => {
      const entry = row.original;
      const isFolder = entry.kind === 'folder';
      return (
        <div className="cell-name">
          <span className={`kind-icon kind-${entry.kind}`} />
          <span className="cell-name-text">{entry.name}</span>
          {isFolder && entry.totalItems > 0 && (
            <span className="sub-label">
              {entry.childFiles} files, {entry.childFolders} folders
            </span>
          )}
        </div>
      );
    },
  },
  {
    id: 'sizeBytes',
    accessorKey: 'sizeBytes',
    header: 'Size',
    cell: ({ getValue }) => formatBytes(getValue() as number),
  },
  {
    id: 'sizeOnDisk',
    accessorKey: 'sizeOnDisk',
    header: 'Size on Disk',
    cell: ({ getValue }) => formatBytes(getValue() as number),
  },
  {
    id: 'pctDisk',
    accessorKey: 'pctDisk',
    header: '% Disk',
    cell: ({ getValue }) => ((getValue() as number) || 0).toFixed(2) + '%',
  },
  {
    id: 'pctParent',
    accessorKey: 'pctParent',
    header: '% Parent',
    cell: ({ getValue }) => ((getValue() as number) || 0).toFixed(1) + '%',
  },
  {
    id: 'kind',
    accessorKey: 'kind',
    header: 'Type',
    cell: ({ getValue }) => {
      const k = getValue() as string;
      return k.charAt(0).toUpperCase() + k.slice(1);
    },
  },
  {
    id: 'modified',
    accessorKey: 'modified',
    header: 'Modified',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
  {
    id: 'accessed',
    accessorKey: 'accessed',
    header: 'Accessed',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
];
