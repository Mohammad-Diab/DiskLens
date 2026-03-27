import { create } from 'zustand';
import { DiskInfo, FileEntry, FileKind } from '../types';

const DEFAULT_VISIBLE_COLUMNS = [
  'name',
  'sizeBytes',
  'sizeOnDisk',
  'kind',
  'modified',
];

export function buildBreadcrumbs(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.map((_, i) => {
    const raw = parts.slice(0, i + 1).join('\\');
    return i === 0 && raw.includes(':') ? raw + '\\' : raw;
  });
}

interface AppState {
  // Scan state
  currentPath: string;
  scanRoot: string;
  entries: FileEntry[];
  isScanning: boolean;
  diskInfo: DiskInfo | null;

  // Navigation
  breadcrumbs: string[];
  history: string[];
  historyIndex: number;

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
  isPaused: boolean;
  knownTotals: Record<string, number>; // lowercase path → total bytes

  // Actions
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  setScanRoot: (path: string) => void;
  setEntries: (entries: FileEntry[]) => void;
  setIsScanning: (v: boolean) => void;
  setDiskInfo: (info: DiskInfo | null) => void;
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
  setIsPaused: (v: boolean) => void;
  setKnownTotal: (path: string, total: number) => void;
  resetScan: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentPath: '',
  scanRoot: '',
  entries: [],
  isScanning: false,
  diskInfo: null,
  breadcrumbs: [],
  history: [],
  historyIndex: -1,
  selectedIds: new Set(),
  sidePanelItem: null,
  sidePanelOpen: false,
  visibleColumns: DEFAULT_VISIBLE_COLUMNS,
  activeFilter: 'all',
  searchQuery: '',
  showHidden: false,
  scanProgress: 0,
  isPaused: false,
  knownTotals: {},

  navigate: (path) => set((state) => {
    const crumbs = buildBreadcrumbs(path);
    // Truncate forward history, then push
    const newHistory = [...state.history.slice(0, state.historyIndex + 1), path];
    return {
      currentPath: path,
      breadcrumbs: crumbs,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedIds: new Set(),
    };
  }),

  goBack: () => set((state) => {
    if (state.historyIndex <= 0) return {};
    const newIndex = state.historyIndex - 1;
    const path = state.history[newIndex];
    return {
      historyIndex: newIndex,
      currentPath: path,
      breadcrumbs: buildBreadcrumbs(path),
      selectedIds: new Set(),
    };
  }),

  goForward: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return {};
    const newIndex = state.historyIndex + 1;
    const path = state.history[newIndex];
    return {
      historyIndex: newIndex,
      currentPath: path,
      breadcrumbs: buildBreadcrumbs(path),
      selectedIds: new Set(),
    };
  }),

  canGoBack: () => get().historyIndex > 0,
  canGoForward: () => get().historyIndex < get().history.length - 1,

  setScanRoot: (path) => set({ scanRoot: path }),
  setEntries: (entries) => set({ entries }),
  setIsScanning: (v) => set({ isScanning: v }),
  setDiskInfo: (info) => set({ diskInfo: info }),
  setSelectedIds: (ids) => set({ selectedIds: new Set(ids) }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
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
  setIsPaused: (v) => set({ isPaused: v }),
  setKnownTotal: (path, total) => set((state) => ({
    knownTotals: { ...state.knownTotals, [path.toLowerCase()]: total },
  })),

  resetScan: () => set({
    entries: [],
    currentPath: '',
    scanRoot: '',
    breadcrumbs: [],
    diskInfo: null,
    selectedIds: new Set(),
    searchQuery: '',
    activeFilter: 'all',
    scanProgress: 0,
    isPaused: false,
    knownTotals: {},
    sidePanelOpen: false,
    sidePanelItem: null,
    history: [],
    historyIndex: -1,
  }),
}));
