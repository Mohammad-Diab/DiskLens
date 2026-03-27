# Task 06 — TypeScript Types

**Phase**: 1 — Foundation
**Status**: [ ] Not started
**File**: `src/types/index.ts`

## Goal
Define all frontend TypeScript types that mirror the Rust structs exactly (camelCase, matching serde rename).

## Types to define

```typescript
export type FileKind =
  | 'folder' | 'program' | 'document' | 'image'
  | 'video' | 'system' | 'archive' | 'other';

export interface FileEntry {
  id:           string;
  name:         string;
  path:         string;
  kind:         FileKind;
  sizeBytes:    number;
  sizeOnDisk:   number;
  pctDisk:      number;
  pctParent:    number;
  modified:     string;   // ISO 8601
  accessed:     string;   // ISO 8601
  isHidden:     boolean;
  isReadOnly:   boolean;
  isSystem:     boolean;
  childFiles:   number;
  childFolders: number;
  totalItems:   number;
}

export interface DiskInfo {
  driveLetter: string;
  label:       string;
  filesystem:  string;
  totalBytes:  number;
  usedBytes:   number;
  freeBytes:   number;
}

export interface ScanResult {
  path:    string;
  entries: FileEntry[];
  total:   number;
}
```

## Notes
- Field names must match exactly what Rust serializes (camelCase via `#[serde(rename_all = "camelCase")]`)
- These types are used everywhere — define once, import everywhere
