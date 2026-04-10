import { ColumnDef } from '@tanstack/react-table';
import {
  Folder,
  File,
  FileText,
  FileImage,
  FileVideo,
  Archive,
  Settings,
  Binary,
} from 'lucide-react';
import { FileKind, FileEntry } from '../../types';

const KIND_ICON: Record<FileKind, React.ReactNode> = {
  folder:   <Folder   size={14} color="#f59e0b" fill="#fef3c7" />,
  document: <FileText size={14} color="#3b82f6" />,
  image:    <FileImage size={14} color="#10b981" />,
  video:    <FileVideo size={14} color="#8b5cf6" />,
  archive:  <Archive  size={14} color="#f97316" />,
  system:   <Settings size={14} color="#6b7280" />,
  program:  <Binary   size={14} color="#ef4444" />,
  other:    <File     size={14} color="#9ca3af" />,
};

export function formatBytes(n: number): string {
  if (n < 0) return '—';
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
          <div className="cell-name-row">
            <span className="kind-icon">{KIND_ICON[entry.kind]}</span>
            <span className="cell-name-text">{entry.name}</span>
          </div>
          {isFolder && entry.totalItems > 0 && (
            <span className="sub-label">
              {entry.totalFiles.toLocaleString()} files, {entry.totalFolders.toLocaleString()} folders
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
    id: 'items',
    header: 'Files / Folders',
    accessorFn: (row) => row.totalFiles + row.totalFolders,
    cell: ({ row }) => {
      const entry = row.original;
      if (entry.kind !== 'folder') return '—';
      if (entry.totalFiles === 0 && entry.totalFolders === 0) return '—';
      return `${entry.totalFiles.toLocaleString()} / ${entry.totalFolders.toLocaleString()}`;
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
