import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Report, Section, TableSection, NoteSection, TableColumn, TableRow, TableCell, ColumnGroup, ColumnType, DetailMode, ReportSettings } from '../types';

const MAX_UNDO_HISTORY = 50;

interface ReportState {
  reports: Report[];
  activeReportId: string | null;
  undoStack: Report[][];
  redoStack: Report[][];
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  activeReport: () => Report | undefined;
  createReport: (title: string, description?: string) => string;
  deleteReport: (id: string) => void;
  updateReport: (id: string, updates: Partial<Pick<Report, 'title' | 'description'>>) => void;
  setActiveReport: (id: string | null) => void;
  addSection: (reportId: string, type: 'table' | 'note') => void;
  deleteSection: (reportId: string, sectionId: string) => void;
  updateSectionTitle: (reportId: string, sectionId: string, title: string) => void;
  // Column group operations
  addColumnGroup: (reportId: string, sectionId: string, label: string) => void;
  deleteColumnGroup: (reportId: string, sectionId: string, groupId: string) => void;
  updateColumnGroupLabel: (reportId: string, sectionId: string, groupId: string, label: string) => void;
  // Sub-column operations
  addColumn: (reportId: string, sectionId: string, groupId: string, label: string, type?: ColumnType) => void;
  deleteColumn: (reportId: string, sectionId: string, groupId: string, columnId: string) => void;
  updateColumnLabel: (reportId: string, sectionId: string, groupId: string, columnId: string, label: string) => void;
  updateColumnType: (reportId: string, sectionId: string, groupId: string, columnId: string, type: ColumnType) => void;
  // Row operations
  addRow: (reportId: string, sectionId: string) => void;
  deleteRow: (reportId: string, sectionId: string, rowId: string) => void;
  updateCell: (reportId: string, sectionId: string, rowId: string, columnId: string, cell: Partial<TableCell>) => void;
  updateRowDetails: (reportId: string, sectionId: string, rowId: string, details: string) => void;
  updateRowDetailMode: (reportId: string, sectionId: string, rowId: string, mode: DetailMode) => void;
  updateNoteContent: (reportId: string, sectionId: string, content: string) => void;
  loadReports: (reports: Report[]) => void;
  // Productivity operations
  duplicateReport: (id: string, title?: string) => string | null;
  updateSettings: (reportId: string, settings: Partial<ReportSettings>) => void;
  moveSection: (reportId: string, sectionId: string, delta: number) => void;
  duplicateSection: (reportId: string, sectionId: string) => void;
  updateTableOptions: (reportId: string, sectionId: string, options: Partial<Pick<TableSection, 'mergeColumns' | 'showSummary' | 'caption'>>) => void;
  replaceTable: (reportId: string, sectionId: string, columnGroups: ColumnGroup[], rows: TableRow[]) => void;
  insertRow: (reportId: string, sectionId: string, afterRowId: string | null) => void;
  duplicateRow: (reportId: string, sectionId: string, rowId: string) => void;
  moveRow: (reportId: string, sectionId: string, rowId: string, delta: number) => void;
  moveColumnGroup: (reportId: string, sectionId: string, groupId: string, delta: number) => void;
  importReport: (report: Report) => void;
}

const STORAGE_KEY = 'report-generator-data';

let pendingReportsToSave: Report[] | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let idleCallbackId: number | null = null;

export function flushSaveToLocalStorage() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (typeof window !== 'undefined' && idleCallbackId !== null && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(idleCallbackId);
    idleCallbackId = null;
  }
  if (pendingReportsToSave !== null) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingReportsToSave));
    } catch {
      // localStorage full or unavailable
    }
    pendingReportsToSave = null;
  }
}

function performSave() {
  saveTimer = null;
  idleCallbackId = null;
  if (pendingReportsToSave !== null) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingReportsToSave));
    } catch {
      // localStorage full or unavailable
    }
    pendingReportsToSave = null;
  }
}

function saveToLocalStorage(reports: Report[]) {
  pendingReportsToSave = reports;
  if (saveTimer === null && idleCallbackId === null) {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(() => performSave(), { timeout: 1000 });
    } else {
      saveTimer = setTimeout(performSave, 300);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSaveToLocalStorage);
}

export function migrateReport(report: Report): Report {
  return {
    ...report,
    sections: report.sections.map(s => {
      if (s.type !== 'table') return s;
      const ts = s as TableSection;
      // Migrate old schema: 'columns' field → 'columnGroups'
      if (!ts.columnGroups && (s as unknown as { columns: unknown[] }).columns) {
        const oldCols = (s as unknown as { columns: { id: string; label: string }[] }).columns;
        ts.columnGroups = [{
          id: 'migrated-group',
          label: 'Data',
          columns: oldCols.map(c => ({ id: c.id, label: c.label, type: 'text' as const })),
        }];
      }
      if (!ts.columnGroups) ts.columnGroups = [];
      // Migrate old row cells (string → TableCell object)
      ts.rows = ts.rows.map(row => {
        const newCells: Record<string, TableCell> = {};
        for (const k in row.cells) {
          const v = row.cells[k];
          if (typeof v === 'string') {
            newCells[k] = { content: v, bgColor: '', details: '' };
          } else {
            const cell = v as { content: string; bgColor: string; details?: string };
            newCells[k] = { content: cell.content, bgColor: cell.bgColor, details: cell.details || '' };
          }
        }
        return { ...row, cells: newCells };
      });
      return ts;
    }),
  };
}

function loadFromLocalStorage(): Report[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const reports: Report[] = JSON.parse(data);
      return reports.map(migrateReport);
    }
  } catch {
    // corrupted data
  }
  return [];
}

/** Snapshot the current reports onto the undo stack (structural edits). */
function snap(state: Pick<ReportState, 'undoStack' | 'reports'>) {
  lastSoftKey = '';
  return {
    undoStack: [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY),
    redoStack: [] as Report[][],
    canUndo: true,
    canRedo: false,
  };
}

/**
 * Coalesced snapshot for typing: consecutive edits to the same field within a short
 * window share one undo step, so Ctrl+Z reverts a burst of typing rather than one key.
 */
let lastSoftKey = '';
let lastSoftTime = 0;
const SOFT_WINDOW_MS = 1200;
function softSnap(state: Pick<ReportState, 'undoStack' | 'reports'>, key: string) {
  const now = Date.now();
  const same = key === lastSoftKey && now - lastSoftTime < SOFT_WINDOW_MS;
  lastSoftTime = now;
  if (same) return {};
  const r = snap(state);
  lastSoftKey = key;
  return r;
}

function updateReportTimestamp(reports: Report[], reportId: string): Report[] {
  return reports.map(r =>
    r.id === reportId ? { ...r, updatedAt: new Date().toISOString() } : r
  );
}

function moveItem<T>(arr: T[], idx: number, delta: number): T[] {
  const to = idx + delta;
  if (idx < 0 || to < 0 || to >= arr.length) return arr;
  const out = [...arr];
  const [item] = out.splice(idx, 1);
  out.splice(to, 0, item);
  return out;
}

function mapTable(reports: Report[], reportId: string, sectionId: string, fn: (s: TableSection) => TableSection): Report[] {
  return reports.map(r =>
    r.id !== reportId
      ? r
      : {
          ...r,
          updatedAt: new Date().toISOString(),
          sections: r.sections.map(s => (s.id === sectionId && s.type === 'table' ? fn(s) : s)),
        }
  );
}

export function cloneSectionWithNewIds(section: Section): Section {
  const copy = structuredClone(section);
  copy.id = uuidv4();
  if (copy.type === 'table') {
    const colMap = new Map<string, string>();
    copy.columnGroups = copy.columnGroups.map(g => ({
      ...g,
      id: uuidv4(),
      columns: g.columns.map(c => {
        const id = uuidv4();
        colMap.set(c.id, id);
        return { ...c, id };
      }),
    }));
    copy.rows = copy.rows.map(row => ({
      ...row,
      id: uuidv4(),
      cells: Object.fromEntries(Object.entries(row.cells).map(([k, v]) => [colMap.get(k) ?? k, v])),
    }));
  }
  return copy;
}

export function cloneReportWithNewIds(report: Report): Report {
  const now = new Date().toISOString();
  return {
    ...structuredClone(report),
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    sections: report.sections.map(cloneSectionWithNewIds),
  };
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: loadFromLocalStorage(),
  activeReportId: null,
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  undo: () => set(state => {
    if (state.undoStack.length === 0) return state;
    const newStack = [...state.undoStack];
    const previousReports = newStack.pop()!;
    const redoStack = [...state.redoStack, state.reports].slice(-MAX_UNDO_HISTORY);
    lastSoftKey = '';
    saveToLocalStorage(previousReports);
    return { reports: previousReports, undoStack: newStack, canUndo: newStack.length > 0, redoStack, canRedo: true };
  }),

  redo: () => set(state => {
    if (state.redoStack.length === 0) return state;
    const redoStack = [...state.redoStack];
    const next = redoStack.pop()!;
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
    lastSoftKey = '';
    saveToLocalStorage(next);
    return { reports: next, undoStack, canUndo: true, redoStack, canRedo: redoStack.length > 0 };
  }),

  activeReport: () => {
    const state = get();
    return state.reports.find(r => r.id === state.activeReportId);
  },

  setActiveReport: (id) => set({ activeReportId: id }),

  createReport: (title, description = '') => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const report: Report = {
      id,
      title,
      description,
      createdAt: now,
      updatedAt: now,
      sections: [],
    };
    set(state => {
            const reports = [...state.reports, report];
      saveToLocalStorage(reports);
      return { reports, activeReportId: id, ...snap(state) };
    });
    return id;
  },

  deleteReport: (id) => set(state => {
    const reports = state.reports.filter(r => r.id !== id);
    saveToLocalStorage(reports);
    return {
      reports,
      activeReportId: state.activeReportId === id ? null : state.activeReportId,
      ...snap(state),
    };
  }),

  updateReport: (id, updates) => set(state => {
    const reports = state.reports.map(r =>
      r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateReport:${id}`) };
  }),

  addSection: (reportId, type) => set(state => {
    const section: Section = type === 'table'
      ? { id: uuidv4(), type: 'table', title: 'New Table', columnGroups: [], rows: [] } as TableSection
      : { id: uuidv4(), type: 'note', title: 'New Note', content: '' } as NoteSection;

    let reports = state.reports.map(r =>
      r.id === reportId ? { ...r, sections: [...r.sections, section] } : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  deleteSection: (reportId, sectionId) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? { ...r, sections: r.sections.filter(s => s.id !== sectionId) }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  updateSectionTitle: (reportId, sectionId, title) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? { ...r, sections: r.sections.map(s => s.id === sectionId ? { ...s, title } : s) }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateSectionTitle:${reportId}:${sectionId}`) };
  }),

  // Column Group operations
  addColumnGroup: (reportId, sectionId, label) => set(state => {
    const group: ColumnGroup = { id: uuidv4(), label, columns: [{ id: uuidv4(), label, type: 'text' }] };
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? { ...s, columnGroups: [...s.columnGroups, group] }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  deleteColumnGroup: (reportId, sectionId, groupId) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s => {
              if (s.id !== sectionId || s.type !== 'table') return s;
              const group = s.columnGroups.find(g => g.id === groupId);
              const colIds = group ? group.columns.map(c => c.id) : [];
              return {
                ...s,
                columnGroups: s.columnGroups.filter(g => g.id !== groupId),
                rows: s.rows.map(row => {
                  const cells = { ...row.cells };
                  colIds.forEach(id => delete cells[id]);
                  return { ...row, cells };
                }),
              };
            }),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  updateColumnGroupLabel: (reportId, sectionId, groupId, label) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? { ...s, columnGroups: s.columnGroups.map(g => g.id === groupId ? { ...g, label } : g) }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateColumnGroupLabel:${reportId}:${sectionId}:${groupId}`) };
  }),

  // Sub-column operations
  addColumn: (reportId, sectionId, groupId, label, type = 'text') => set(state => {
    const col: TableColumn = { id: uuidv4(), label, type };
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? {
                    ...s,
                    columnGroups: s.columnGroups.map(g =>
                      g.id === groupId ? { ...g, columns: [...g.columns, col] } : g
                    ),
                  }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  deleteColumn: (reportId, sectionId, groupId, columnId) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s => {
              if (s.id !== sectionId || s.type !== 'table') return s;
              return {
                ...s,
                columnGroups: s.columnGroups.map(g =>
                  g.id === groupId
                    ? { ...g, columns: g.columns.filter(c => c.id !== columnId) }
                    : g
                ),
                rows: s.rows.map(row => {
                  const cells = { ...row.cells };
                  delete cells[columnId];
                  return { ...row, cells };
                }),
              };
            }),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  updateColumnLabel: (reportId, sectionId, groupId, columnId, label) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? {
                    ...s,
                    columnGroups: s.columnGroups.map(g =>
                      g.id === groupId
                        ? { ...g, columns: g.columns.map(c => c.id === columnId ? { ...c, label } : c) }
                        : g
                    ),
                  }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateColumnLabel:${reportId}:${sectionId}:${groupId}:${columnId}`) };
  }),

  updateColumnType: (reportId, sectionId, groupId, columnId, type) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? {
                    ...s,
                    columnGroups: s.columnGroups.map(g =>
                      g.id === groupId
                        ? { ...g, columns: g.columns.map(c => c.id === columnId ? { ...c, type } : c) }
                        : g
                    ),
                  }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  // Row operations
  addRow: (reportId, sectionId) => set(state => {
    const row: TableRow = {
      id: uuidv4(),
      cells: {},
      details: '',
      detailMode: 'accordion',
    };
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? { ...s, rows: [...s.rows, row] }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  deleteRow: (reportId, sectionId, rowId) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? { ...s, rows: s.rows.filter(row => row.id !== rowId) }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  updateCell: (reportId, sectionId, rowId, columnId, cellUpdate) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? {
                    ...s,
                    rows: s.rows.map(row => {
                      if (row.id !== rowId) return row;
                      const existing = row.cells[columnId] || { content: '', bgColor: '', details: '' };
                      return {
                        ...row,
                        cells: { ...row.cells, [columnId]: { ...existing, ...cellUpdate } },
                      };
                    }),
                  }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateCell:${reportId}:${sectionId}:${rowId}:${columnId}`) };
  }),

  updateRowDetails: (reportId, sectionId, rowId, details) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? {
                    ...s,
                    rows: s.rows.map(row =>
                      row.id === rowId ? { ...row, details } : row
                    ),
                  }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateRowDetails:${reportId}:${sectionId}:${rowId}`) };
  }),

  updateRowDetailMode: (reportId, sectionId, rowId, mode) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'table'
                ? {
                    ...s,
                    rows: s.rows.map(row =>
                      row.id === rowId ? { ...row, detailMode: mode } : row
                    ),
                  }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateRowDetailMode:${reportId}:${sectionId}:${rowId}`) };
  }),

  updateNoteContent: (reportId, sectionId, content) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? {
            ...r,
            sections: r.sections.map(s =>
              s.id === sectionId && s.type === 'note'
                ? { ...s, content }
                : s
            ),
          }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `updateNoteContent:${reportId}:${sectionId}`) };
  }),

  loadReports: (reports) => set(state => {
    reports = reports.map(migrateReport);
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  duplicateReport: (id, title) => {
    const src = get().reports.find(r => r.id === id);
    if (!src) return null;
    const copy = cloneReportWithNewIds(src);
    copy.title = title ?? `${src.title} (copy)`;
    set(state => {
      const reports = [...state.reports, copy];
      saveToLocalStorage(reports);
      return { reports, ...snap(state) };
    });
    return copy.id;
  },

  updateSettings: (reportId, settings) => set(state => {
    const reports = state.reports.map(r =>
      r.id === reportId ? { ...r, settings: { ...(r.settings || {}), ...settings }, updatedAt: new Date().toISOString() } : r
    );
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `settings:${reportId}:${Object.keys(settings).join(',')}`) };
  }),

  moveSection: (reportId, sectionId, delta) => set(state => {
    const reports = state.reports.map(r => {
      if (r.id !== reportId) return r;
      return { ...r, sections: moveItem(r.sections, r.sections.findIndex(s => s.id === sectionId), delta), updatedAt: new Date().toISOString() };
    });
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  duplicateSection: (reportId, sectionId) => set(state => {
    const reports = state.reports.map(r => {
      if (r.id !== reportId) return r;
      const idx = r.sections.findIndex(s => s.id === sectionId);
      if (idx < 0) return r;
      const copy = cloneSectionWithNewIds(r.sections[idx]);
      copy.title = `${copy.title} (copy)`;
      const sections = [...r.sections];
      sections.splice(idx + 1, 0, copy);
      return { ...r, sections, updatedAt: new Date().toISOString() };
    });
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  updateTableOptions: (reportId, sectionId, options) => set(state => {
    const reports = mapTable(state.reports, reportId, sectionId, s => ({ ...s, ...options }));
    saveToLocalStorage(reports);
    return { reports, ...softSnap(state, `tableopts:${sectionId}:${Object.keys(options).join(',')}`) };
  }),

  replaceTable: (reportId, sectionId, columnGroups, rows) => set(state => {
    const reports = mapTable(state.reports, reportId, sectionId, s => ({ ...s, columnGroups, rows }));
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  insertRow: (reportId, sectionId, afterRowId) => set(state => {
    const row: TableRow = { id: uuidv4(), cells: {}, details: '', detailMode: 'accordion' };
    const reports = mapTable(state.reports, reportId, sectionId, s => {
      const rows = [...s.rows];
      const idx = afterRowId === null ? -1 : rows.findIndex(r => r.id === afterRowId);
      rows.splice(idx + 1, 0, row);
      return { ...s, rows };
    });
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  duplicateRow: (reportId, sectionId, rowId) => set(state => {
    const reports = mapTable(state.reports, reportId, sectionId, s => {
      const idx = s.rows.findIndex(r => r.id === rowId);
      if (idx < 0) return s;
      const rows = [...s.rows];
      rows.splice(idx + 1, 0, { ...structuredClone(s.rows[idx]), id: uuidv4() });
      return { ...s, rows };
    });
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  moveRow: (reportId, sectionId, rowId, delta) => set(state => {
    const reports = mapTable(state.reports, reportId, sectionId, s => ({
      ...s, rows: moveItem(s.rows, s.rows.findIndex(r => r.id === rowId), delta),
    }));
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  moveColumnGroup: (reportId, sectionId, groupId, delta) => set(state => {
    const reports = mapTable(state.reports, reportId, sectionId, s => ({
      ...s, columnGroups: moveItem(s.columnGroups, s.columnGroups.findIndex(g => g.id === groupId), delta),
    }));
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),

  importReport: (report) => set(state => {
    const migrated = migrateReport(report);
    const exists = state.reports.some(r => r.id === migrated.id);
    const reports = exists
      ? state.reports.map(r => (r.id === migrated.id ? migrated : r))
      : [...state.reports, migrated];
    saveToLocalStorage(reports);
    return { reports, ...snap(state) };
  }),
}));
