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
}

export interface NoteSection {
  id: string;
  type: 'note';
  title: string;
  content: string; // HTML rich text content
}

export type Section = TableSection | NoteSection;

export interface Report {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  sections: Section[];
}
