export type DetailMode = 'accordion' | 'modal';
export type SectionType = 'table' | 'note';
export type ColumnType = 'text' | 'status';

export interface TableCell {
  content: string; // HTML rich text content (or status value for status columns)
  bgColor: string; // manual background color override (hex or empty string)
  details: string; // expandable detail content (HTML rich text) shown on click
}

export interface TableColumn {
  id: string;
  label: string;
  type: ColumnType; // 'text' = normal rich text, 'status' = auto-colored pass/fail/etc.
}

export interface ColumnGroup {
  id: string;
  label: string;
  columns: TableColumn[]; // sub-columns; if 1, renders as single column
}

export interface TableRow {
  id: string;
  cells: Record<string, TableCell>; // keyed by column ID
  details: string; // expandable details (HTML rich text)
  detailMode: DetailMode;
}

export interface TableSection {
  id: string;
  type: 'table';
  title: string;
  columnGroups: ColumnGroup[];
  rows: TableRow[];
  /** Merge blank cells into the non-blank cell above (rowspan) for the first N columns. */
  mergeColumns?: number;
  /** Show a pass/fail summary bar above the table in the export (default true when status cells exist). */
  showSummary?: boolean;
  /** Optional caption shown under the section title. */
  caption?: string;
}

export interface NoteSection {
  id: string;
  type: 'note';
  title: string;
  content: string; // HTML rich text content
}

export type Section = TableSection | NoteSection;

export type OverallStatus = '' | 'on-track' | 'at-risk' | 'off-track' | 'complete';

export interface ReportSettings {
  author: string;
  /** ISO date (yyyy-mm-dd) the report covers. Empty = use the export date. */
  reportDate: string;
  overallStatus: OverallStatus;
  /** Accent colour used for headings and highlights in the export. */
  accentColor: string;
  /**
   * Base URL for issue keys (e.g. https://jira.example.com/browse/).
   * When set, keys like ABC-123 are turned into links in the export.
   */
  issueBaseUrl: string;
  /** Show the auto-computed status dashboard at the top of the export. */
  showDashboard: boolean;
  /** Show a table of contents in the export. */
  showToc: boolean;
  /** Theme the exported file opens in. 'auto' follows the reader's OS setting. */
  theme: 'auto' | 'light' | 'dark';
  /** Compact tables (tighter padding) in the export. */
  compact: boolean;
}

export const DEFAULT_SETTINGS: ReportSettings = {
  author: '',
  reportDate: '',
  overallStatus: '',
  accentColor: '#2563eb',
  issueBaseUrl: '',
  showDashboard: true,
  showToc: true,
  theme: 'auto',
  compact: false,
};

export interface Report {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
  settings?: Partial<ReportSettings>;
}

export function resolveSettings(report: Pick<Report, 'settings'>): ReportSettings {
  return { ...DEFAULT_SETTINGS, ...(report.settings || {}) };
}
