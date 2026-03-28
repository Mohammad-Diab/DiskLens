export type FileKind =
  | 'folder'
  | 'program'
  | 'document'
  | 'image'
  | 'video'
  | 'system'
  | 'archive'
  | 'other';

export interface FileEntry {
  id: string;
  name: string;
  path: string;
  parent: string;
  kind: FileKind;
  sizeBytes: number;
  sizeOnDisk: number;
  pctDisk: number;
  pctParent: number;
  modified: string;
  accessed: string;
  isHidden: boolean;
  isReadOnly: boolean;
  isSystem: boolean;
  childFiles: number;
  childFolders: number;
  totalItems: number;
}

export interface DiskInfo {
  driveLetter: string;
  label: string;
  filesystem: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export interface ScanResult {
  path: string;
  entries: FileEntry[];
  total: number;
  /** Every scanned directory and its accumulated byte size. */
  folderSizes: Record<string, number>;
}
