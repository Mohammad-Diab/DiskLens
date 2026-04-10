import { create } from 'zustand';
import { DiskInfo, FileEntry, FileKind } from '../types';

const DEFAULT_VISIBLE_COLUMNS = [
  'name',
  'sizeBytes',
  'pctParent',
  'items',
  'kind',
  'modified',
];

// Returns the parent path of a Windows or POSIX path string.
// "C:\Users\John" → "C:\Users", "C:\Users" → "C:\", "C:\" → ""
function getParentPath(p: string): string {
  const norm = p.replace(/\\/g, '/').replace(/\/$/, '');
  const lastSlash = norm.lastIndexOf('/');
  if (lastSlash < 0) return '';
  const parent = norm.slice(0, lastSlash);
  if (parent.length === 2 && parent[1] === ':') return parent + '\\';
  return parent.replace(/\//g, '\\');
}

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
  scanStatus: string;
  isPaused: boolean;
  knownTotals: Record<string, number>; // lowercase path → total bytes
  knownFileCounts: Record<string, number>;   // lowercase path → recursive file count
  knownFolderCounts: Record<string, number>; // lowercase path → recursive folder count

  // The entries currently visible in the table (for filter-chip counts)
  viewEntries: FileEntry[];

  // Actions
  setViewEntries: (entries: FileEntry[]) => void;
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
  setScanStatus: (s: string) => void;
  setIsPaused: (v: boolean) => void;
  setKnownTotal: (path: string, total: number) => void;
  mergeKnownTotals: (totals: Record<string, number>) => void;
  mergeKnownCounts: (fileCounts: Record<string, number>, folderCounts: Record<string, number>) => void;
  removeEntries: (items: FileEntry[]) => void;
  resetScan: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  currentPath: '',
  scanRoot: '',
  entries: [],
  viewEntries: [],
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
  showHidden: true,
  scanProgress: 0,
  scanStatus: '',
  isPaused: false,
  knownTotals: {},
  knownFileCounts: {},
  knownFolderCounts: {},

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
  setViewEntries: (viewEntries) => set({ viewEntries }),
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
  setScanStatus: (s) => set({ scanStatus: s }),
  setIsPaused: (v) => set({ isPaused: v }),
  setKnownTotal: (path, total) => set((state) => ({
    knownTotals: { ...state.knownTotals, [path.toLowerCase()]: total },
  })),
  mergeKnownTotals: (totals) => set((state) => {
    const merged: Record<string, number> = { ...state.knownTotals };
    for (const [path, size] of Object.entries(totals)) {
      merged[path.toLowerCase()] = size;
    }
    return { knownTotals: merged };
  }),
  mergeKnownCounts: (fileCounts, folderCounts) => set((state) => {
    const mf: Record<string, number> = { ...state.knownFileCounts };
    const mfo: Record<string, number> = { ...state.knownFolderCounts };
    for (const [path, count] of Object.entries(fileCounts))   mf[path.toLowerCase()]  = count;
    for (const [path, count] of Object.entries(folderCounts)) mfo[path.toLowerCase()] = count;
    return { knownFileCounts: mf, knownFolderCounts: mfo };
  }),

  removeEntries: (items) => set((state) => {
    if (items.length === 0) return {};

    const deletedIds = new Set(items.map((e) => e.id));

    // Propagate each deleted item's size up through all ancestors
    const reductions = new Map<string, number>();
    const propagate = (path: string, size: number) => {
      if (!path || size <= 0) return;
      const lc = path.toLowerCase();
      reductions.set(lc, (reductions.get(lc) ?? 0) + size);
      const parent = getParentPath(path);
      if (parent && parent.toLowerCase() !== lc) propagate(parent, size);
    };
    for (const item of items) propagate(item.parent, item.sizeBytes);

    // Update knownTotals — subtract reductions from every ancestor
    const newKnownTotals = { ...state.knownTotals };
    for (const [lc, reduction] of reductions) {
      if (newKnownTotals[lc] !== undefined)
        newKnownTotals[lc] = Math.max(0, newKnownTotals[lc] - reduction);
    }

    // Remove deleted entries; shrink folder sizeBytes for all ancestors
    const remaining = state.entries
      .filter((e) => !deletedIds.has(e.id))
      .map((e) => {
        if (e.kind !== 'folder') return e;
        const reduction = reductions.get(e.path.toLowerCase()) ?? 0;
        return reduction > 0 ? { ...e, sizeBytes: Math.max(0, e.sizeBytes - reduction) } : e;
      });

    // Build a size lookup for folders (updated entries first, then knownTotals)
    const folderSizeMap = new Map<string, number>();
    for (const e of remaining)
      if (e.kind === 'folder') folderSizeMap.set(e.path.toLowerCase(), e.sizeBytes);
    const getFolderSize = (path: string) => {
      const lc = path.toLowerCase();
      return folderSizeMap.get(lc) ?? newKnownTotals[lc] ?? 0;
    };

    // Recalculate pctParent for every entry whose parent's size changed
    const affectedParents = new Set(reductions.keys());
    const final = remaining.map((e) => {
      const parentLc = e.parent.toLowerCase();
      if (!affectedParents.has(parentLc)) return e;
      const parentSize = getFolderSize(e.parent);
      const pctParent = parentSize > 0 ? (Math.max(0, e.sizeBytes) / parentSize) * 100 : 0;
      return { ...e, pctParent };
    });

    return { entries: final, knownTotals: newKnownTotals, selectedIds: new Set() };
  }),

  resetScan: () => set({
    entries: [],
    viewEntries: [],
    currentPath: '',
    scanRoot: '',
    breadcrumbs: [],
    diskInfo: null,
    selectedIds: new Set(),
    searchQuery: '',
    activeFilter: 'all',
    scanProgress: 0,
    scanStatus: '',
    isPaused: false,
    knownTotals: {},
    knownFileCounts: {},
    knownFolderCounts: {},
    sidePanelOpen: false,
    sidePanelItem: null,
    history: [],
    historyIndex: -1,
  }),
}));
