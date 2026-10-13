import { describe, it, expect } from 'vitest';
import {
  parseHtmlTable,
  parsePlainTextTable,
  parseJsonImport,
  rgbToHex,
} from '../PasteTableImport';

describe('rgbToHex', () => {
  it('converts rgb string to hex format', () => {
    expect(rgbToHex('rgb(255, 255, 255)')).toBe('#ffffff');
    expect(rgbToHex('rgb(220, 252, 231)')).toBe('#dcfce7');
    expect(rgbToHex('rgb(0, 0, 0)')).toBe('#000000');
  });

  it('returns empty string for invalid format', () => {
    expect(rgbToHex('#ffffff')).toBe('');
    expect(rgbToHex('invalid')).toBe('');
  });
});

describe('parseHtmlTable', () => {
  it('returns null if HTML has no table element', () => {
    const result = parseHtmlTable('<div>No table here</div>');
    expect(result).toBeNull();
  });

  it('returns null if table has no tr elements', () => {
    const result = parseHtmlTable('<table></table>');
    expect(result).toBeNull();
  });

  it('parses a simple HTML table with single header row', () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Task 1</td>
            <td>Passed</td>
          </tr>
        </tbody>
      </table>
    `;

    const result = parseHtmlTable(html);
    expect(result).not.toBeNull();
    expect(result!.groups.length).toBe(2);
    expect(result!.groups[0].columns[0].label).toBe('Name');
    expect(result!.groups[1].columns[0].label).toBe('Status');

    expect(result!.rows.length).toBe(1);
    const col0Id = result!.groups[0].columns[0].id;
    const col1Id = result!.groups[1].columns[0].id;

    expect(result!.rows[0].cells[col0Id].content).toBe('Task 1');
    expect(result!.rows[0].cells[col1Id].content).toBe('Passed');
    expect(result!.rows[0].cells[col1Id].bgColor).toBe('#dcfce7'); // auto-detected passed
  });

  it('parses table without explicit <th> using first <tr> as header', () => {
    const html = `
      <table>
        <tr>
          <td>Feature</td>
          <td>Result</td>
        </tr>
        <tr>
          <td>Auth</td>
          <td>Fail</td>
        </tr>
      </table>
    `;

    const result = parseHtmlTable(html);
    expect(result).not.toBeNull();
    expect(result!.groups.length).toBe(2);
    expect(result!.groups[0].columns[0].label).toBe('Feature');
    expect(result!.groups[1].columns[0].label).toBe('Result');

    expect(result!.rows.length).toBe(1);
    const col1Id = result!.groups[1].columns[0].id;
    expect(result!.rows[0].cells[col1Id].content).toBe('Fail');
    expect(result!.rows[0].cells[col1Id].bgColor).toBe('#fee2e2'); // auto-detected fail
  });

  it('parses multi-row header table with colspan', () => {
    const html = `
      <table>
        <tr>
          <th>Suite</th>
          <th colspan="2">Round 1</th>
        </tr>
        <tr>
          <th>Name</th>
          <th>OS</th>
          <th>Status</th>
        </tr>
        <tr>
          <td>Suite A</td>
          <td>Windows</td>
          <td>In Progress</td>
        </tr>
      </table>
    `;

    const result = parseHtmlTable(html);
    expect(result).not.toBeNull();
    expect(result!.groups.length).toBe(2);
    expect(result!.groups[0].label).toBe('Suite');
    expect(result!.groups[0].columns.length).toBe(1);
    expect(result!.groups[0].columns[0].label).toBe('Name');

    expect(result!.groups[1].label).toBe('Round 1');
    expect(result!.groups[1].columns.length).toBe(2);
    expect(result!.groups[1].columns[0].label).toBe('OS');
    expect(result!.groups[1].columns[1].label).toBe('Status');

    expect(result!.rows.length).toBe(1);
    const round1StatusColId = result!.groups[1].columns[1].id;
    expect(result!.rows[0].cells[round1StatusColId].content).toBe('In Progress');
    expect(result!.rows[0].cells[round1StatusColId].bgColor).toBe('#fef9c3'); // auto-detected in progress
  });

  it('detects background color from inline style or bgcolor attribute', () => {
    const html = `
      <table>
        <tr><th>Col1</th><th>Col2</th></tr>
        <tr>
          <td style="background-color: rgb(220, 252, 231)">Custom Style</td>
          <td bgcolor="#ff0000">Custom Attr</td>
        </tr>
      </table>
    `;

    const result = parseHtmlTable(html);
    expect(result).not.toBeNull();
    const col0Id = result!.groups[0].columns[0].id;
    const col1Id = result!.groups[1].columns[0].id;

    expect(result!.rows[0].cells[col0Id].bgColor).toBe('#dcfce7');
    expect(result!.rows[0].cells[col1Id].bgColor).toBe('#ff0000');
  });
});

describe('parsePlainTextTable', () => {
  it('returns null for empty or single line text', () => {
    expect(parsePlainTextTable('')).toBeNull();
    expect(parsePlainTextTable('Single Line')).toBeNull();
  });

  it('parses tab-delimited text', () => {
    const text = 'Header1\tHeader2\nVal1\tVal2\nVal3\tVal4';
    const result = parsePlainTextTable(text);

    expect(result).not.toBeNull();
    expect(result!.groups.length).toBe(2);
    expect(result!.groups[0].columns[0].label).toBe('Header1');
    expect(result!.groups[1].columns[0].label).toBe('Header2');
    expect(result!.rows.length).toBe(2);
  });

  it('parses markdown pipe-delimited text with separator line', () => {
    const text = `
      | Header 1 | Header 2 |
      | --- | --- |
      | Val 1 | Val 2 |
    `;
    const result = parsePlainTextTable(text);

    expect(result).not.toBeNull();
    expect(result!.groups.length).toBe(2);
    expect(result!.groups[0].columns[0].label).toBe('Header 1');
    expect(result!.groups[1].columns[0].label).toBe('Header 2');
    expect(result!.rows.length).toBe(1);

    const col0Id = result!.groups[0].columns[0].id;
    expect(result!.rows[0].cells[col0Id].content).toBe('Val 1');
  });
});

describe('parseJsonImport', () => {
  it('returns null for invalid JSON string or missing columnGroups', () => {
    expect(parseJsonImport('invalid json')).toBeNull();
    expect(parseJsonImport('{}')).toBeNull();
    expect(parseJsonImport('{"columnGroups": []}')).toBeNull();
  });

  it('parses valid JSON with mixed column definition types', () => {
    const json = JSON.stringify({
      columnGroups: [
        {
          label: 'Group 1',
          columns: ['Col A', { label: 'Col B', type: 'status' }],
        },
      ],
      rows: [['Val A', 'Pass']],
    });

    const result = parseJsonImport(json);

    expect(result).not.toBeNull();
    expect(result!.groups.length).toBe(1);
    expect(result!.groups[0].label).toBe('Group 1');
    expect(result!.groups[0].columns.length).toBe(2);
    expect(result!.groups[0].columns[0].type).toBe('text');
    expect(result!.groups[0].columns[1].type).toBe('status');

    expect(result!.rows.length).toBe(1);
    const col0Id = result!.groups[0].columns[0].id;
    const col1Id = result!.groups[0].columns[1].id;
    expect(result!.rows[0].cells[col0Id].content).toBe('Val A');
    expect(result!.rows[0].cells[col1Id].content).toBe('Pass');
  });
});
