import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Report, Section, TableSection, NoteSection, TableColumn, TableRow, TableCell, ColumnGroup, ColumnType, DetailMode } from '../types';

const MAX_UNDO_HISTORY = 50;

interface ReportState {
  reports: Report[];
  activeReportId: string | null;
  undoStack: Report[][];
  canUndo: boolean;
  undo: () => void;
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
}

const STORAGE_KEY = 'report-generator-data';

function saveToLocalStorage(reports: Report[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch {
    // localStorage full or unavailable
  }
}

function migrateReport(report: Report): Report {
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
      ts.rows = ts.rows.map(row => ({
        ...row,
        cells: Object.fromEntries(
          Object.entries(row.cells).map(([k, v]) => {
            if (typeof v === 'string') return [k, { content: v, bgColor: '', details: '' }];
            const cell = v as { content: string; bgColor: string; details?: string };
            return [k, { content: cell.content, bgColor: cell.bgColor, details: cell.details || '' }];
          })
        ),
      }));
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

function updateReportTimestamp(reports: Report[], reportId: string): Report[] {
  return reports.map(r =>
    r.id === reportId ? { ...r, updatedAt: new Date().toISOString() } : r
  );
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: loadFromLocalStorage(),
  activeReportId: null,
  undoStack: [],
  canUndo: false,

  undo: () => set(state => {
    if (state.undoStack.length === 0) return state;
    const newStack = [...state.undoStack];
    const previousReports = newStack.pop()!;
    saveToLocalStorage(previousReports);
    return { reports: previousReports, undoStack: newStack, canUndo: newStack.length > 0 };
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
      const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
      const reports = [...state.reports, report];
      saveToLocalStorage(reports);
      return { reports, activeReportId: id, undoStack, canUndo: true };
    });
    return id;
  },

  deleteReport: (id) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
    const reports = state.reports.filter(r => r.id !== id);
    saveToLocalStorage(reports);
    return {
      reports,
      activeReportId: state.activeReportId === id ? null : state.activeReportId,
      undoStack,
      canUndo: true,
    };
  }),

  updateReport: (id, updates) => set(state => {
    const reports = state.reports.map(r =>
      r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
    );
    saveToLocalStorage(reports);
    return { reports };
  }),

  addSection: (reportId, type) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
    const section: Section = type === 'table'
      ? { id: uuidv4(), type: 'table', title: 'New Table', columnGroups: [], rows: [] } as TableSection
      : { id: uuidv4(), type: 'note', title: 'New Note', content: '' } as NoteSection;

    let reports = state.reports.map(r =>
      r.id === reportId ? { ...r, sections: [...r.sections, section] } : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, undoStack, canUndo: true };
  }),

  deleteSection: (reportId, sectionId) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
    let reports = state.reports.map(r =>
      r.id === reportId
        ? { ...r, sections: r.sections.filter(s => s.id !== sectionId) }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports, undoStack, canUndo: true };
  }),

  updateSectionTitle: (reportId, sectionId, title) => set(state => {
    let reports = state.reports.map(r =>
      r.id === reportId
        ? { ...r, sections: r.sections.map(s => s.id === sectionId ? { ...s, title } : s) }
        : r
    );
    reports = updateReportTimestamp(reports, reportId);
    saveToLocalStorage(reports);
    return { reports };
  }),

  // Column Group operations
  addColumnGroup: (reportId, sectionId, label) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
  }),

  deleteColumnGroup: (reportId, sectionId, groupId) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
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
    return { reports };
  }),

  // Sub-column operations
  addColumn: (reportId, sectionId, groupId, label, type = 'text') => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
  }),

  deleteColumn: (reportId, sectionId, groupId, columnId) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
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
    return { reports };
  }),

  updateColumnType: (reportId, sectionId, groupId, columnId, type) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
  }),

  // Row operations
  addRow: (reportId, sectionId) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
  }),

  deleteRow: (reportId, sectionId, rowId) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
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
    return { reports, undoStack, canUndo: true };
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
    return { reports };
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
    return { reports };
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
    return { reports };
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
    return { reports };
  }),

  loadReports: (reports) => set(state => {
    const undoStack = [...state.undoStack, state.reports].slice(-MAX_UNDO_HISTORY);
    saveToLocalStorage(reports);
    return { reports, undoStack, canUndo: true };
  }),
}));
