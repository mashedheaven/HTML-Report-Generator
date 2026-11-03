import { v4 as uuidv4 } from 'uuid';
import type { Report, TableSection, NoteSection, TableRow, ColumnGroup, TableCell } from '../types';

type CellInput = string | { c: string; d?: string; bg?: string };

function table(
  title: string,
  groups: { label: string; columns: (string | { label: string; status: true })[] }[],
  rows: { cells: CellInput[]; details?: string; mode?: 'accordion' | 'modal' }[],
  opts: Partial<TableSection> = {},
): TableSection {
  const columnGroups: ColumnGroup[] = groups.map(g => ({
    id: uuidv4(),
    label: g.label,
    columns: g.columns.map(c =>
      typeof c === 'string'
        ? { id: uuidv4(), label: c, type: 'text' as const }
        : { id: uuidv4(), label: c.label, type: 'status' as const },
    ),
  }));
  const cols = columnGroups.flatMap(g => g.columns);
  const tableRows: TableRow[] = rows.map(r => {
    const cells: Record<string, TableCell> = {};
    r.cells.forEach((v, i) => {
      if (!cols[i]) return;
      cells[cols[i].id] = typeof v === 'string'
        ? { content: v, bgColor: '', details: '' }
        : { content: v.c, bgColor: v.bg || '', details: v.d || '' };
    });
    return { id: uuidv4(), cells, details: r.details || '', detailMode: r.mode || 'accordion' };
  });
  return { id: uuidv4(), type: 'table', title, columnGroups, rows: tableRows, ...opts };
}

function note(title: string, content: string): NoteSection {
  return { id: uuidv4(), type: 'note', title, content };
}

const S = { label: 'Status', status: true as const };

/** A realistic weekly QA status report that shows off every feature. */
export function createSampleReport(): Report {
  const now = new Date();
  const iso = now.toISOString();
  return {
    id: uuidv4(),
    title: 'Weekly Validation Report — Sample',
    description: 'Status of release-candidate validation across product lines. Click + on a row (or any cell with a blue dot) for details.',
    createdAt: iso,
    updatedAt: iso,
    settings: {
      author: 'QA Team',
      reportDate: iso.slice(0, 10),
      overallStatus: 'at-risk',
      accentColor: '#2563eb',
      issueBaseUrl: 'https://issues.example.com/browse/',
      showDashboard: true,
      showToc: true,
      theme: 'auto',
      compact: false,
    },
    sections: [
      table(
        'Executive Summary',
        [
          { label: 'Validation', columns: ['Validation'] },
          { label: 'Highlights', columns: ['Highlights'] },
          { label: 'Status', columns: [S] },
          { label: 'Risks', columns: ['Risks'] },
        ],
        [
          {
            cells: ['Atlas RC2', '<ul><li>RC2 validation 100% complete</li><li>All rounds complete; triage ongoing</li></ul>', 'Pass with defect CORE-3110', 'Root cause for CORE-3110 still unknown; customer impact low.'],
            details: '<p>Firmware team has <b>deferred CORE-3110</b> to the next maintenance release. Monitoring closely.</p>',
          },
          {
            cells: ['Nova E2E', '<ul><li>3 rounds completed</li><li>Duration test blocked by APP-5602</li></ul>', 'Blocked', 'If APP-5602 is not fixed it will impact RC sign-off.'],
          },
          { cells: ['Orion 1.1', 'Received new FW build; scheduled 1× duration run this week.', 'In Progress', '—'] },
          {
            cells: ['Vega 1.12', '3 of 3 duration runs completed — all failed.', 'Fail by FW-22801', 'RC date at risk if defect is not fixed.'],
            details: '<p>UI hang during the 2nd hour of the contention test. Logs attached to FW-22801.</p>',
            mode: 'modal',
          },
        ],
        { caption: 'One line per validation stream. Status drives the summary dashboard.' },
      ),
      table(
        'Atlas — Test Matrix',
        [
          { label: 'Test', columns: ['Suite', 'Sub-test'] },
          { label: 'Round 1', columns: ['OS', S] },
          { label: 'Round 2', columns: ['OS ', { label: 'Status ', status: true }] },
        ],
        [
          { cells: ['Contention Duration', 'App', 'Windows', 'Pass', 'Android', 'Pass'] },
          { cells: ['', '', 'iOS', { c: 'Pass with defect CORE-3110', d: 'Hang in 5th hour, only on one unit.' }, 'Android', 'Pass'] },
          { cells: ['', '', 'macOS', 'Pass', 'Android', 'Fail by CORE-3110'] },
          { cells: ['Memory Monitoring', 'Print', 'Windows', 'Pass', 'Windows', 'Pass'] },
          { cells: ['', 'Scan', 'NA', 'N/A', 'Windows', 'Pass'] },
          { cells: ['', 'Web UI', 'Windows', 'Pass', 'Windows', 'Pass'] },
          { cells: ['', 'Copy', 'NA', 'N/A', 'Windows', { c: 'Fail by CORE-3119', d: 'Assert on copy after 5h; closed as duplicate of CORE-3110.' }] },
          { cells: ['', 'Sleep/Wake', 'iOS', 'Pass', 'NA', 'N/A'] },
        ],
        { mergeColumns: 2 },
      ),
      table(
        'Orion — Extra Runs',
        [
          { label: 'Date', columns: ['Date'] },
          { label: 'Title', columns: ['Title'] },
          { label: 'Status', columns: [S] },
          { label: 'Firmware', columns: ['Firmware'] },
        ],
        [
          { cells: ['13 May', 'Unit A — run 1', 'Pass', '6.28.1.103'] },
          { cells: ['13 May', 'Unit B — run 1', 'Pass', '6.28.1.103'] },
          { cells: ['14 May', 'Unit A — run 2', 'Pass', '6.28.1.103'] },
          { cells: ['18 May', 'Unit C — run 1', 'In Progress', '6.28.3.19'] },
          { cells: ['18 May', 'Unit D — run 1', 'In Progress', '6.28.3.19'] },
        ],
      ),
      note(
        'Defects',
        '<p><b>Active</b></p><ol><li>CORE-3110 — Device hang during contention test. Team liaising with FW engineer to capture logs.</li><li>FW-22801 — UI hang during 2nd hour of contention test.</li></ol><p><b>Closed</b></p><ol><li>CORE-3119 — Assert on 5th hour (duplicate of CORE-3110).</li><li><s>APP-5598</s> — Onboarding error on all access points (fixed).</li></ol>',
      ),
    ],
  };
}
