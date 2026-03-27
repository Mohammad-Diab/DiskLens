import { create } from 'zustand';
import { DiskInfo, FileEntry, FileKind } from '../types';

const DEFAULT_VISIBLE_COLUMNS = [
  'name',
  'sizeBytes',
  'sizeOnDisk',
  'kind',
  'modified',
];

interface AppState {
  // Scan state
  currentPath: string;
  scanRoot: string;
  entries: FileEntry[];
  isScanning: boolean;
  diskInfo: DiskInfo | null;

  // Navigation
  breadcrumbs: string[];

  // Selection
  selectedIds: Set<string>;

  // UI
  sidePanelItem: FileEntry | null;
  sidePanelOpen: boolean;
  visibleColumns: string[];
  activeFilter: FileKind | 'all';
  searchQuery: string;
  showHidden: boolean;
  scanProgress: number;

  // Actions
  setCurrentPath: (path: string) => void;
  setScanRoot: (path: string) => void;
  setEntries: (entries: FileEntry[]) => void;
  setIsScanning: (v: boolean) => void;
  setDiskInfo: (info: DiskInfo | null) => void;
  setBreadcrumbs: (crumbs: string[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelected: (id: string) => void;
  clearSelection: () => void;
  setSidePanelItem: (item: FileEntry | null) => void;
  setSidePanelOpen: (open: boolean) => void;
  setVisibleColumns: (cols: string[]) => void;
  setActiveFilter: (f: FileKind | 'all') => void;
  setSearchQuery: (q: string) => void;
  setShowHidden: (v: boolean) => void;
  setScanProgress: (n: number) => void;
}

export const useStore = create<AppState>((set) => ({
  currentPath: '',
  scanRoot: '',
  entries: [],
  isScanning: false,
  diskInfo: null,
  breadcrumbs: [],
  selectedIds: new Set(),
  sidePanelItem: null,
  sidePanelOpen: false,
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  activeFilter: 'all',
  searchQuery: '',
  showHidden: false,
  scanProgress: 0,

  setCurrentPath: (path) => set({ currentPath: path }),
  setScanRoot: (path) => set({ scanRoot: path }),
  setEntries: (entries) => set({ entries }),
  setIsScanning: (v) => set({ isScanning: v }),
  setDiskInfo: (info) => set({ diskInfo: info }),
  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),
  setSelectedIds: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { selectedIds: next };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setSidePanelItem: (item) => set({ sidePanelItem: item }),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  setVisibleColumns: (cols) => set({ visibleColumns: cols }),
  setActiveFilter: (f) => set({ activeFilter: f }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setShowHidden: (v) => set({ showHidden: v }),
  setScanProgress: (n) => set({ scanProgress: n }),
}));
