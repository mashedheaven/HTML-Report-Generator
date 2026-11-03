import { useState, useRef } from 'react';
import { useReportStore } from '../store/reportStore';
import { v4 as uuidv4 } from 'uuid';
import type { ColumnGroup, TableRow, TableCell } from '../types';
import { ClipboardPaste, X, FileJson } from 'lucide-react';
import { getStatusColor } from '../utils/statusColors';

interface Props {
  reportId: string;
  sectionId: string;
  onClose: () => void;
}

function parseHtmlTable(html: string): { groups: ColumnGroup[]; rows: TableRow[] } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return null;

  const tableRows = Array.from(table.querySelectorAll('tr'));
  if (tableRows.length === 0) return null;

  // Detect header rows (rows with <th> elements)
  const headerRows: HTMLTableRowElement[] = [];
  const dataRows: HTMLTableRowElement[] = [];

  for (const tr of tableRows) {
    const ths = tr.querySelectorAll('th');
    if (ths.length > 0 && dataRows.length === 0) {
      headerRows.push(tr);
    } else {
      dataRows.push(tr);
    }
  }

  // If no explicit headers, treat first row as header
  if (headerRows.length === 0 && dataRows.length > 0) {
    headerRows.push(dataRows.shift()!);
  }

  // Build column groups from header rows
  let groups: ColumnGroup[] = [];

  if (headerRows.length === 1) {
    // Single header row - each cell is its own group with one column
    // Use empty group label to avoid duplicating the column name on both layers
    const cells = Array.from(headerRows[0].querySelectorAll('th, td'));
    groups = cells.map(cell => {
      const colId = uuidv4();
      const label = cell.textContent?.trim() || '';
      return {
        id: uuidv4(),
        label: '',
        columns: [{ id: colId, label, type: 'text' as const }],
      };
    });
  } else if (headerRows.length >= 2) {
    // Multi-row header: first row = groups (with colspan), second row = sub-columns
    const groupCells = Array.from(headerRows[0].querySelectorAll('th, td'));
    const subCells = Array.from(headerRows[1].querySelectorAll('th, td'));

    let subIdx = 0;
    groups = groupCells.map(cell => {
      const colspan = parseInt(cell.getAttribute('colspan') || '1', 10);
      const groupLabel = cell.textContent?.trim() || '';
      const columns = [];
      for (let i = 0; i < colspan && subIdx < subCells.length; i++) {
        columns.push({
          id: uuidv4(),
          label: subCells[subIdx]?.textContent?.trim() || '',
          type: 'text' as const,
        });
        subIdx++;
      }
      // If no sub-columns captured (colspan=1, no second row entries), use group label
      if (columns.length === 0) {
        columns.push({ id: uuidv4(), label: groupLabel, type: 'text' as const });
      }
      return { id: uuidv4(), label: groupLabel, columns };
    });
  }

  // Flatten column IDs for mapping data
  const allColIds = groups.flatMap(g => g.columns.map(c => c.id));

  // Build data rows
  const rows: TableRow[] = dataRows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('td, th'));
    const rowCells: Record<string, TableCell> = {};

    cells.forEach((td, idx) => {
      if (idx < allColIds.length) {
        const content = td.innerHTML?.trim() || '';
        const bgStyle = (td as HTMLElement).style?.backgroundColor || '';
        const bgAttr = (td as HTMLElement).getAttribute('bgcolor') || '';
        let bgColor = '';

        // Try to detect background color from inline styles
        if (bgStyle) {
          bgColor = rgbToHex(bgStyle) || bgStyle;
        } else if (bgAttr) {
          bgColor = bgAttr;
        }
        // Detect status-like values and auto-color
        const textContent = td.textContent?.trim() || '';
        if (!bgColor) {
          bgColor = getStatusColor(textContent);
        }

        rowCells[allColIds[idx]] = { content, bgColor, details: '' };
      }
    });

    return {
      id: uuidv4(),
      cells: rowCells,
      details: '',
      detailMode: 'accordion' as const,
    };
  });

  return { groups, rows };
}

function parsePlainTextTable(text: string): { groups: ColumnGroup[]; rows: TableRow[] } | null {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  if (lines.length < 2) return null;

  // Detect delimiter (tab or |)
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes('|') ? '|' : '\t';

  const splitLine = (line: string) =>
    line.split(delimiter).map(s => s.trim()).filter((val, i, arr) => {
      // For pipe-delimited, filter empty first/last from leading/trailing pipes
      if (delimiter === '|') return (i > 0 && i < arr.length - 1) || val.length > 0;
      return true;
    });

  const headerCells = splitLine(lines[0]);
  if (headerCells.length === 0) return null;

  // Skip separator lines (--- | --- | ---)
  let dataStartIdx = 1;
  if (lines[1] && /^[\s\-|+:]+$/.test(lines[1])) {
    dataStartIdx = 2;
  }

  const groups: ColumnGroup[] = headerCells.map(label => {
    const colId = uuidv4();
    return {
      id: uuidv4(),
      label: '',
      columns: [{ id: colId, label, type: 'text' as const }],
    };
  });

  const allColIds = groups.flatMap(g => g.columns.map(c => c.id));

  const rows: TableRow[] = lines.slice(dataStartIdx).map(line => {
    const cells = splitLine(line);
    const rowCells: Record<string, TableCell> = {};
    cells.forEach((cellText, idx) => {
      if (idx < allColIds.length) {
        rowCells[allColIds[idx]] = { content: cellText, bgColor: '', details: '' };
      }
    });
    return {
      id: uuidv4(),
      cells: rowCells,
      details: '',
      detailMode: 'accordion' as const,
    };
  });

  return { groups, rows };
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!match) return '';
  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const JSON_EXAMPLE = `{
  "columnGroups": [
    { "label": "Test", "columns": ["Suite", "Sub-test"] },
    { "label": "Round 1 - Greenfield", "columns": [{"label": "OS", "type": "text"}, {"label": "Status", "type": "status"}] },
    { "label": "Round 1 - Sunspear", "columns": ["OS", {"label": "Status", "type": "status"}] }
  ],
  "rows": [
    ["Contention Duration", "HPx", "Windows", "Pass", "Windows", "Fail by HPXAPPS-56215"],
    ["", "", "iOS", "Pass", "Android", "Pass with Defect DUNE-311046"],
    ["Memory Monitoring", "PrintHPx", "Windows", "Pass", "Windows", "Pass"],
    ["", "Scan", "NA", "", "Windows", "Pass"]
  ]
}`;

interface JsonColumn {
  label: string;
  type?: 'text' | 'status';
}

interface JsonImportData {
  columnGroups: Array<{
    label: string;
    columns: Array<string | JsonColumn>;
  }>;
  rows: Array<Array<string>>;
}

function parseJsonImport(json: string): { groups: ColumnGroup[]; rows: TableRow[] } | null {
  let data: JsonImportData;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }

  if (!data.columnGroups || !Array.isArray(data.columnGroups) || data.columnGroups.length === 0) {
    return null;
  }

  const groups: ColumnGroup[] = data.columnGroups.map(g => {
    const columns = (g.columns || []).map(col => {
      if (typeof col === 'string') {
        return { id: uuidv4(), label: col, type: 'text' as const };
      }
      return { id: uuidv4(), label: col.label, type: (col.type || 'text') as 'text' | 'status' };
    });
    return { id: uuidv4(), label: g.label, columns };
  });

  const allColIds = groups.flatMap(g => g.columns.map(c => c.id));

  const rows: TableRow[] = (data.rows || []).map(rowData => {
    const cells: Record<string, TableCell> = {};
    const rowArr = Array.isArray(rowData) ? rowData : [];
    rowArr.forEach((val, idx) => {
      if (idx < allColIds.length) {
        cells[allColIds[idx]] = { content: String(val || ''), bgColor: '', details: '' };
      }
    });
    return { id: uuidv4(), cells, details: '', detailMode: 'accordion' as const };
  });

  return { groups, rows };
}

export function PasteTableImport({ reportId, sectionId, onClose }: Props) {
  const [mode, setMode] = useState<'paste' | 'json'>('paste');
  const [pasteContent, setPasteContent] = useState('');
  const [jsonContent, setJsonContent] = useState('');
  const [error, setError] = useState('');
  const pasteRef = useRef<HTMLDivElement>(null);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    if (htmlData) {
      setPasteContent(htmlData);
      if (pasteRef.current) {
        pasteRef.current.innerHTML = htmlData;
      }
    } else if (textData) {
      setPasteContent(textData);
      if (pasteRef.current) {
        pasteRef.current.textContent = textData;
      }
    }
    setError('');
  };

  const applyResult = (result: { groups: ColumnGroup[]; rows: TableRow[] }) => {
    const state = useReportStore.getState();
    const reports = state.reports.map(r => {
      if (r.id !== reportId) return r;
      return {
        ...r,
        sections: r.sections.map(s => {
          if (s.id !== sectionId || s.type !== 'table') return s;
          return { ...s, columnGroups: result.groups, rows: result.rows };
        }),
        updatedAt: new Date().toISOString(),
      };
    });
    state.loadReports(reports);
    onClose();
  };

  const handlePasteImport = () => {
    if (!pasteContent.trim()) {
      setError('Paste a table first');
      return;
    }

    let result = parseHtmlTable(pasteContent);
    if (!result) {
      const textContent = pasteRef.current?.textContent || pasteContent;
      result = parsePlainTextTable(textContent);
    }

    if (!result || result.groups.length === 0) {
      setError('Could not detect a table in the pasted content. Try pasting from Excel, Word, or a web page.');
      return;
    }

    applyResult(result);
  };

  const handleJsonImport = () => {
    if (!jsonContent.trim()) {
      setError('Enter JSON data');
      return;
    }

    const result = parseJsonImport(jsonContent);
    if (!result || result.groups.length === 0) {
      setError('Invalid JSON format. Check the example structure above.');
      return;
    }

    applyResult(result);
  };

  return (
    <div className="border border-blue-200 rounded-md bg-blue-50/50 p-3 mt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-blue-700">
          <ClipboardPaste size={14} />
          Import Table
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={14} />
        </button>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-2 border-b border-gray-200">
        <button
          onClick={() => { setMode('paste'); setError(''); }}
          className={`px-3 py-1 text-xs font-medium rounded-t ${mode === 'paste' ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardPaste size={11} className="inline mr-1" />
          Paste
        </button>
        <button
          onClick={() => { setMode('json'); setError(''); }}
          className={`px-3 py-1 text-xs font-medium rounded-t ${mode === 'json' ? 'bg-white border border-b-white border-gray-200 text-blue-700 -mb-px' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <FileJson size={11} className="inline mr-1" />
          JSON
        </button>
      </div>

      {mode === 'paste' && (
        <>
          <p className="text-xs text-gray-600 mb-2">
            Paste a table from Excel, Word, OneNote, or any webpage.
          </p>
          <div
            ref={pasteRef}
            onPaste={handlePaste}
            contentEditable
            className="w-full min-h-[80px] max-h-[200px] overflow-auto bg-white border border-gray-300 rounded p-2 text-xs outline-none focus:ring-2 focus:ring-blue-400 empty:before:content-['Paste_your_table_here_(Ctrl+V)...'] empty:before:text-gray-400"
            suppressContentEditableWarning
          />
        </>
      )}

      {mode === 'json' && (
        <>
          <p className="text-xs text-gray-600 mb-1">
            Define table structure as JSON. Columns can be strings or <code className="bg-gray-100 px-0.5 rounded">{`{"label": "Name", "type": "status"}`}</code>. Rows are arrays of cell values.
          </p>
          <details className="mb-2">
            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">Show example JSON</summary>
            <pre className="text-[10px] bg-gray-100 p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">{JSON_EXAMPLE}</pre>
          </details>
          <textarea
            value={jsonContent}
            onChange={(e) => { setJsonContent(e.target.value); setError(''); }}
            className="w-full min-h-[120px] max-h-[300px] bg-white border border-gray-300 rounded p-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-400 resize-y"
            placeholder="Paste or type your JSON here..."
            spellCheck={false}
          />
        </>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={onClose} className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
        <button
          onClick={mode === 'paste' ? handlePasteImport : handleJsonImport}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Import
        </button>
      </div>
    </div>
  );
}
