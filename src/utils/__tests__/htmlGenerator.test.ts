import { describe, it, expect } from 'vitest';
import { generateHtmlReport } from '../htmlGenerator';
import type { Report } from '../../types';

describe('generateHtmlReport', () => {
  it('should generate valid HTML document with correct title and timestamp', () => {
    const report: Report = {
      id: 'report-1',
      title: 'Monthly Test Report',
      description: 'Comprehensive test summary',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Monthly Test Report</title>');
    expect(html).toContain('<h1>Monthly Test Report</h1>');
    expect(html).toContain('<p class="report-description">Comprehensive test summary</p>');
    expect(html).toContain('Generated: ');
  });

  it('should escape special HTML characters in report metadata', () => {
    const report: Report = {
      id: 'report-2',
      title: 'Report <1> & "Special" \'Chars\'',
      description: 'Desc <script>alert("xss")</script> & More',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<title>Report &lt;1&gt; &amp; &quot;Special&quot; &#039;Chars&#039;</title>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should omit description tag when description is empty', () => {
    const report: Report = {
      id: 'report-3',
      title: 'No Description Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [],
    };

    const html = generateHtmlReport(report);

    expect(html).not.toContain('<p class="report-description">');
  });

  it('should render note section correctly', () => {
    const report: Report = {
      id: 'report-4',
      title: 'Note Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-note-1',
          type: 'note',
          title: 'Executive <Summary>',
          content: '<p>All systems <b>operational</b>.</p>',
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<h2>Executive &lt;Summary&gt;</h2>');
    expect(html).toContain('<div class="note-content"><p>All systems <b>operational</b>.</p></div>');
  });

  it('should handle table section with no columns defined', () => {
    const report: Report = {
      id: 'report-5',
      title: 'Empty Table Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-1',
          type: 'table',
          title: 'Empty Section',
          columnGroups: [],
          rows: [],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<h2>Empty Section</h2>');
    expect(html).toContain('No columns defined.');
  });

  it('should render table with status columns and apply status color styles', () => {
    const report: Report = {
      id: 'report-6',
      title: 'Status Test Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-2',
          type: 'table',
          title: 'Status Matrix',
          columnGroups: [
            {
              id: 'group-1',
              label: 'Group A',
              columns: [
                { id: 'col-pass', label: 'Pass Col', type: 'status' },
                { id: 'col-fail', label: 'Fail Col', type: 'status' },
                { id: 'col-progress', label: 'Progress Col', type: 'status' },
                { id: 'col-blocked', label: 'Blocked Col', type: 'status' },
                { id: 'col-na', label: 'NA Col', type: 'status' },
                { id: 'col-warning', label: 'Warning Col', type: 'status' },
                { id: 'col-unknown', label: 'Unknown Col', type: 'status' },
              ],
            },
          ],
          rows: [
            {
              id: 'row-1',
              detailMode: 'accordion',
              details: '',
              cells: {
                'col-pass': { content: 'Pass', bgColor: '', details: '' },
                'col-fail': { content: 'Failed', bgColor: '', details: '' },
                'col-progress': { content: 'In Progress', bgColor: '', details: '' },
                'col-blocked': { content: 'Blocked', bgColor: '', details: '' },
                'col-na': { content: 'N/A', bgColor: '', details: '' },
                'col-warning': { content: 'Warning', bgColor: '', details: '' },
                'col-unknown': { content: 'Custom Status', bgColor: '', details: '' },
              },
            },
          ],
        },
      ],
    };

    const html = generateHtmlReport(report);

    // Pass: #dcfce7 / #166534
    expect(html).toContain('background:#dcfce7;color:#166534');
    // Fail: #fee2e2 / #991b1b
    expect(html).toContain('background:#fee2e2;color:#991b1b');
    // In Progress: #fef9c3 / #854d0e
    expect(html).toContain('background:#fef9c3;color:#854d0e');
    // Blocked: #fecaca / #991b1b
    expect(html).toContain('background:#fecaca;color:#991b1b');
    // N/A: #f3f4f6 / #4b5563
    expect(html).toContain('background:#f3f4f6;color:#4b5563');
    // Custom status has font-weight:600 and position:relative
    expect(html).toContain('Custom Status');
  });

  it('should render custom background colors for text columns', () => {
    const report: Report = {
      id: 'report-7',
      title: 'Custom Color Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-3',
          type: 'table',
          title: 'Custom Colors',
          columnGroups: [
            {
              id: 'group-1',
              label: 'Group 1',
              columns: [{ id: 'col-1', label: 'Feature', type: 'text' }],
            },
          ],
          rows: [
            {
              id: 'row-1',
              detailMode: 'accordion',
              details: '',
              cells: {
                'col-1': { content: '<b>Auth Module</b>', bgColor: '#ff0000', details: '' },
              },
            },
          ],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('background:#ff0000;position:relative');
    expect(html).toContain('<b>Auth Module</b>');
  });

  it('should render sub-column headers when groups have multiple columns or label differs', () => {
    const report: Report = {
      id: 'report-8',
      title: 'Multi Column Header Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-4',
          type: 'table',
          title: 'Multi Col Section',
          columnGroups: [
            {
              id: 'group-1',
              label: 'Suite A',
              columns: [
                { id: 'c1', label: 'Sub-test 1', type: 'text' },
                { id: 'c2', label: 'Sub-test 2', type: 'text' },
              ],
            },
          ],
          rows: [],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<th class="group-header" colspan="2">Suite A</th>');
    expect(html).toContain('<th class="col-header">Sub-test 1</th>');
    expect(html).toContain('<th class="col-header">Sub-test 2</th>');
  });

  it('should render accordion detail mode correctly with both row and cell details', () => {
    const report: Report = {
      id: 'report-9',
      title: 'Accordion Details Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-5',
          type: 'table',
          title: 'Accordion Section',
          columnGroups: [
            {
              id: 'g1',
              label: 'General',
              columns: [{ id: 'c1', label: 'Component', type: 'text' }],
            },
          ],
          rows: [
            {
              id: 'row-acc-1',
              detailMode: 'accordion',
              details: '<p>Row wide details text</p>',
              cells: {
                c1: { content: 'UI Engine', bgColor: '', details: 'Cell specific notes' },
              },
            },
          ],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('onclick="toggleAccordion(\'row-acc-1\')"');
    expect(html).toContain('id="detail-row-acc-1"');
    expect(html).toContain('<p>Row wide details text</p>');
    expect(html).toContain('<strong>Component:</strong> Cell specific notes');
    expect(html).toContain('<span class="cell-detail-dot"></span>');
  });

  it('should render modal detail mode correctly', () => {
    const report: Report = {
      id: 'report-10',
      title: 'Modal Details Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-6',
          type: 'table',
          title: 'Modal Section',
          columnGroups: [
            {
              id: 'g1',
              label: 'General',
              columns: [{ id: 'c1', label: 'Component', type: 'text' }],
            },
          ],
          rows: [
            {
              id: 'row-mod-1',
              detailMode: 'modal',
              details: '<p>Modal row note</p>',
              cells: {
                c1: { content: 'Backend API', bgColor: '', details: 'Modal cell note' },
              },
            },
          ],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('onclick="openModal(\'row-mod-1\')"');
    expect(html).toContain('id="modal-row-mod-1"');
    expect(html).toContain('class="modal-overlay"');
    expect(html).toContain('onclick="closeModal(\'row-mod-1\')"');
    expect(html).toContain('<p>Modal row note</p>');
    expect(html).toContain('<strong>Component:</strong> Modal cell note');
  });

  it('should render rows without details with empty button column', () => {
    const report: Report = {
      id: 'report-11',
      title: 'No Details Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-7',
          type: 'table',
          title: 'Simple Table',
          columnGroups: [
            {
              id: 'g1',
              label: 'Group',
              columns: [{ id: 'c1', label: 'Col 1', type: 'text' }],
            },
          ],
          rows: [
            {
              id: 'row-no-detail',
              detailMode: 'accordion',
              details: '   ',
              cells: {
                c1: { content: 'Value', bgColor: '', details: '' },
              },
            },
          ],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<td></td>');
    expect(html).not.toContain('id="detail-row-no-detail"');
    expect(html).not.toContain('id="modal-row-no-detail"');
    expect(html).not.toContain('<span class="cell-detail-dot"></span>');
  });

  it('should handle missing cell entries gracefully', () => {
    const report: Report = {
      id: 'report-12',
      title: 'Missing Cell Report',
      description: '',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
      sections: [
        {
          id: 'sec-table-8',
          type: 'table',
          title: 'Sparse Table',
          columnGroups: [
            {
              id: 'g1',
              label: 'Group',
              columns: [{ id: 'c1', label: 'Col 1', type: 'text' }],
            },
          ],
          rows: [
            {
              id: 'row-sparse',
              detailMode: 'accordion',
              details: '',
              cells: {},
            },
          ],
        },
      ],
    };

    const html = generateHtmlReport(report);

    expect(html).toContain('<td style="position:relative"></td>');
  });
});
