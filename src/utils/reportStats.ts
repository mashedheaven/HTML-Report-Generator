import type { Report, Section, TableSection } from '../types';
import { classifyStatus, emptyCounts, addCounts, type StatusCounts } from './statusColors';

/** Counts the status cells (columns of type 'status') in a table section. */
export function computeSectionCounts(section: Section): StatusCounts {
  const counts = emptyCounts();
  if (section.type !== 'table') return counts;
  const statusCols = (section.columnGroups || []).flatMap(g => g.columns).filter(c => c.type === 'status');
  if (statusCols.length === 0) return counts;
  for (const row of section.rows || []) {
    for (const col of statusCols) {
      const kind = classifyStatus(row.cells[col.id]?.content);
      if (kind) counts[kind]++;
    }
  }
  return counts;
}

export function computeReportCounts(report: Report): StatusCounts {
  return report.sections.reduce((acc, s) => addCounts(acc, computeSectionCounts(s)), emptyCounts());
}

export function hasStatusColumns(section: TableSection): boolean {
  return (section.columnGroups || []).some(g => g.columns.some(c => c.type === 'status'));
}
