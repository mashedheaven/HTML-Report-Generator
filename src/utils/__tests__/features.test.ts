import { describe, it, expect, beforeEach } from 'vitest';
import { generateHtmlReport } from '../htmlGenerator';
import { cleanRichHtml, extractIssueKeys } from '../richText';
import { computeReportCounts } from '../reportStats';
import { passRate } from '../statusColors';
import { useReportStore } from '../../store/reportStore';
import { parseHtmlTable, parseJsonImport } from '../../components/PasteTableImport';
import { createSampleReport } from '../../data/sampleReport';
import type { Report, TableSection } from '../../types';

function tableReport(section: Partial<TableSection>, settings: Report['settings'] = {}): Report {
  return {
    id: 'r1', title: 'T', description: '', createdAt: '2025-01-01', updatedAt: '2025-01-01', settings,
    sections: [{ id: 's1', type: 'table', title: 'Tbl', columnGroups: [], rows: [], ...section } as TableSection],
  };
}

const cols = {
  columnGroups: [
    { id: 'g1', label: 'Test', columns: [{ id: 'suite', label: 'Suite', type: 'text' as const }, { id: 'sub', label: 'Sub', type: 'text' as const }] },
    { id: 'g2', label: 'Result', columns: [{ id: 'st', label: 'Status', type: 'status' as const }] },
  ],
};
const cell = (content: string, details = '') => ({ content, bgColor: '', details });

describe('export security', () => {
  it('strips scripts and event handlers from rich content in the exported file', () => {
    const html = generateHtmlReport(tableReport({
      ...cols,
      rows: [{ id: 'x"onmouseover="alert(1)', detailMode: 'accordion', details: '<img src=x onerror="alert(1)">', cells: { suite: cell('<script>alert(1)</script>ok'), st: cell('<b>Pass</b>') } }],
    }));
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('onerror');
    // Row ids from imported JSON never reach the DOM.
    expect(html).not.toContain('onmouseover');
  });

  it('rejects unsafe colours and issue base URLs', () => {
    const html = generateHtmlReport(tableReport(
      { ...cols, rows: [{ id: 'r', detailMode: 'accordion', details: '', cells: { suite: { content: 'a', bgColor: 'red;background:url(javascript:alert(1))', details: '' } } }] },
      { issueBaseUrl: 'javascript:alert(1)//', accentColor: '"><script>' },
    ));
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('"><script>');
  });
});

describe('issue keys', () => {
  it('finds keys and ignores common non-issue tokens', () => {
    expect(extractIssueKeys('Fail by HPXAPPS-56215 and DUNE-311046, UTF-8, ISO-9001')).toEqual(['HPXAPPS-56215', 'DUNE-311046']);
  });

  it('linkifies keys in rich text but not inside existing links', () => {
    const out = cleanRichHtml('<p>See ABC-12 and <a href="https://x.test">ABC-13</a></p>', 'https://jira.test/browse/');
    expect(out).toContain('href="https://jira.test/browse/ABC-12"');
    expect(out).not.toContain('browse/ABC-13');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('linkifies keys in status cells and lists them in the dashboard', () => {
    const html = generateHtmlReport(tableReport(
      { ...cols, rows: [{ id: 'r', detailMode: 'accordion', details: '', cells: { st: cell('Fail by DUNE-311046') } }] },
      { issueBaseUrl: 'https://jira.test/browse/' },
    ));
    expect(html).toContain('<a class="issue-link" href="https://jira.test/browse/DUNE-311046"');
    expect(html).toContain('Issues referenced');
    expect(html).toContain('class="issue-chip" href="https://jira.test/browse/DUNE-311046"');
  });
});

describe('merged cells', () => {
  it('merges blank leading cells into rowspans, respecting the parent column', () => {
    const html = generateHtmlReport(tableReport({
      ...cols,
      mergeColumns: 2,
      rows: [
        { id: 'a', detailMode: 'accordion', details: '', cells: { suite: cell('Memory'), sub: cell('Print'), st: cell('Pass') } },
        { id: 'b', detailMode: 'accordion', details: '', cells: { suite: cell(''), sub: cell(''), st: cell('Fail') } },
        { id: 'c', detailMode: 'accordion', details: '', cells: { suite: cell(''), sub: cell('Scan'), st: cell('Pass') } },
        { id: 'd', detailMode: 'accordion', details: '', cells: { suite: cell('CD'), sub: cell(''), st: cell('Pass') } },
      ],
    }));
    expect(html).toContain('<td class="span-cell" rowspan="3">Memory</td>');
    expect(html).toContain('<td class="span-cell" rowspan="2">Print</td>');
    // "CD" starts a new suite, so the blank sub-test below "Scan" must not merge across it.
    expect(html).toMatch(/<td>CD<\/td><td><\/td>/);
    expect(html).toContain('data-merged="1"');
  });
});

describe('dashboard', () => {
  it('computes counts and pass rate over executed checks', () => {
    const report = tableReport({
      ...cols,
      rows: ['Pass', 'Pass with defect X-1', 'Fail', 'N/A', 'In progress'].map((s, i) => ({ id: `r${i}`, detailMode: 'accordion' as const, details: '', cells: { st: cell(s) } })),
    });
    const counts = computeReportCounts(report);
    expect(counts.pass).toBe(1);
    expect(counts.passWithIssues).toBe(1);
    expect(counts.fail).toBe(1);
    expect(counts.na).toBe(1);
    expect(counts.inProgress).toBe(1);
    expect(passRate(counts)).toBeCloseTo(2 / 3);
    const html = generateHtmlReport(report);
    expect(html).toContain('Pass rate');
    expect(html).toContain('67%');
    expect(html).toContain('data-filter="fail"');
  });

  it('can be switched off', () => {
    const html = generateHtmlReport(tableReport({ ...cols, rows: [{ id: 'r', detailMode: 'accordion', details: '', cells: { st: cell('Pass') } }] }, { showDashboard: false }));
    expect(html).not.toContain('aria-label="Summary"');
  });

  it('renders the full sample report', () => {
    const html = generateHtmlReport(createSampleReport());
    expect(html).toContain('aria-label="Contents"');
    expect(html).toContain('Overall: At risk');
    expect(html).toContain('rowspan=');
  });
});

describe('paste import', () => {
  it('keeps columns aligned when the pasted table has rowspans', () => {
    const result = parseHtmlTable(`<table>
      <tr><th>Suite</th><th>Sub</th><th>Status</th></tr>
      <tr><td rowspan="2">Memory</td><td>Print</td><td>Pass</td></tr>
      <tr><td>Scan</td><td>Fail by ABC-1</td></tr>
    </table>`)!;
    const [suite, sub, status] = result.groups.flatMap(g => g.columns);
    expect(result.rows[1].cells[suite.id]).toBeUndefined();
    expect(result.rows[1].cells[sub.id].content).toBe('Scan');
    expect(result.rows[1].cells[status.id].content).toBe('Fail by ABC-1');
    expect(status.type).toBe('status');
    expect(result.mergeColumns).toBe(1);
  });

  it('accepts object rows with details and mergeColumns in JSON', () => {
    const r = parseJsonImport(JSON.stringify({
      columnGroups: [{ label: 'G', columns: ['A', { label: 'S', type: 'status' }] }],
      rows: [{ cells: ['x', { content: 'Fail', details: 'why' }], details: '<p>row</p>', mode: 'modal' }],
      mergeColumns: 1,
    }))!;
    const [, s] = r.groups[0].columns;
    expect(r.rows[0].details).toBe('<p>row</p>');
    expect(r.rows[0].detailMode).toBe('modal');
    expect(r.rows[0].cells[s.id].details).toBe('why');
    expect(r.mergeColumns).toBe(1);
  });
});

describe('store productivity actions', () => {
  beforeEach(() => {
    localStorage.clear();
    useReportStore.setState({ reports: [], activeReportId: null, undoStack: [], redoStack: [], canUndo: false, canRedo: false });
  });

  it('duplicates a report with fresh ids and remapped cells', () => {
    const s = useReportStore.getState();
    const sample = createSampleReport();
    s.importReport(sample);
    const copyId = useReportStore.getState().duplicateReport(sample.id)!;
    const copy = useReportStore.getState().reports.find(r => r.id === copyId)!;
    expect(copy.title).toBe(`${sample.title} (copy)`);
    expect(copy.sections[0].id).not.toBe(sample.sections[0].id);
    const strip = (h: string) => h.replace(/Generated: [^<]+/, '');
    expect(strip(generateHtmlReport({ ...copy, title: sample.title }))).toBe(strip(generateHtmlReport(sample)));
  });

  it('moves rows and supports undo/redo', () => {
    const s = useReportStore.getState();
    const id = s.createReport('R');
    s.addSection(id, 'table');
    const secId = useReportStore.getState().reports[0].sections[0].id;
    s.addRow(id, secId);
    s.addRow(id, secId);
    const [a, b] = (useReportStore.getState().reports[0].sections[0] as TableSection).rows.map(r => r.id);
    s.moveRow(id, secId, a, 1);
    expect((useReportStore.getState().reports[0].sections[0] as TableSection).rows.map(r => r.id)).toEqual([b, a]);
    useReportStore.getState().undo();
    expect((useReportStore.getState().reports[0].sections[0] as TableSection).rows.map(r => r.id)).toEqual([a, b]);
    expect(useReportStore.getState().canRedo).toBe(true);
    useReportStore.getState().redo();
    expect((useReportStore.getState().reports[0].sections[0] as TableSection).rows.map(r => r.id)).toEqual([b, a]);
  });

  it('coalesces rapid typing into a single undo step', () => {
    const s = useReportStore.getState();
    const id = s.createReport('R');
    const before = useReportStore.getState().undoStack.length;
    s.updateReport(id, { title: 'R1' });
    s.updateReport(id, { title: 'R12' });
    s.updateReport(id, { title: 'R123' });
    expect(useReportStore.getState().undoStack.length).toBe(before + 1);
    useReportStore.getState().undo();
    expect(useReportStore.getState().reports[0].title).toBe('R');
  });
});
