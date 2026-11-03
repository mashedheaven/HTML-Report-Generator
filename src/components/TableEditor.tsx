import { Fragment, useEffect, useId, useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { RichTextEditor } from './RichTextEditor';
import { PasteTableImport } from './PasteTableImport';
import type { TableSection, ColumnType, DetailMode } from '../types';
import {
  Plus, Trash2, ChevronDown, ChevronRight, Columns, Palette, ClipboardPaste, ArrowUp, ArrowDown,
  Copy, ChevronLeft, MessageSquarePlus, Settings2,
} from 'lucide-react';
import { classifyStatus, STATUS_STYLES, STATUS_SUGGESTIONS } from '../utils/statusColors';

const CELL_COLORS = [
  { label: 'None', value: '' },
  { label: 'Green', value: '#dcfce7' },
  { label: 'Lime', value: '#ecfccb' },
  { label: 'Red', value: '#fee2e2' },
  { label: 'Yellow', value: '#fef9c3' },
  { label: 'Orange', value: '#ffedd5' },
  { label: 'Blue', value: '#dbeafe' },
  { label: 'Purple', value: '#f3e8ff' },
  { label: 'Gray', value: '#f3f4f6' },
];

interface Props {
  reportId: string;
  section: TableSection;
}

export function TableEditor({ reportId, section }: Props) {
  const {
    addColumnGroup, deleteColumnGroup, updateColumnGroupLabel, moveColumnGroup,
    addColumn, deleteColumn, updateColumnLabel, updateColumnType,
    addRow, deleteRow, updateCell, insertRow, duplicateRow, moveRow,
    updateRowDetails, updateRowDetailMode, updateTableOptions,
  } = useReportStore();

  const listId = useId();
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [addingSubColTo, setAddingSubColTo] = useState<string | null>(null);
  const [newSubColLabel, setNewSubColLabel] = useState('');
  const [newSubColType, setNewSubColType] = useState<ColumnType>('text');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [colorPickerCell, setColorPickerCell] = useState<string | null>(null);
  const [detailEditCell, setDetailEditCell] = useState<string | null>(null); // "rowId-colId"
  const [showPasteImport, setShowPasteImport] = useState(false);
  const [showStructure, setShowStructure] = useState(section.columnGroups.length === 0);
  const { confirm, dialogProps } = useConfirmDialog();

  // Close popovers with Escape.
  useEffect(() => {
    if (!colorPickerCell && !detailEditCell) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setColorPickerCell(null); setDetailEditCell(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [colorPickerCell, detailEditCell]);

  const handleAddGroup = () => {
    if (!newGroupLabel.trim()) return;
    addColumnGroup(reportId, section.id, newGroupLabel.trim());
    setNewGroupLabel('');
  };

  const handleAddSubCol = (groupId: string) => {
    if (!newSubColLabel.trim()) return;
    addColumn(reportId, section.id, groupId, newSubColLabel.trim(), newSubColType);
    setNewSubColLabel('');
    setNewSubColType('text');
    setAddingSubColTo(null);
  };

  const allColumns = section.columnGroups.flatMap(g => g.columns);
  const totalCols = allColumns.length;
  const showSubColHeaders = section.columnGroups.some(
    g => g.columns.length > 1 || (g.columns.length === 1 && g.columns[0].label !== g.label && g.label !== '')
  );
  const rowCount = section.rows.length;

  return (
    <div>
      {/* Structure & options toggle */}
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <button
          onClick={() => setShowStructure(s => !s)}
          className="flex items-center gap-1 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:text-gray-900"
        >
          {showStructure ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <Settings2 size={13} /> Columns &amp; options
        </button>
        <span className="text-xs text-gray-400">
          {section.columnGroups.length} group{section.columnGroups.length === 1 ? '' : 's'} · {totalCols} column{totalCols === 1 ? '' : 's'} · {rowCount} row{rowCount === 1 ? '' : 's'}
        </span>
      </div>

      {showStructure && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
          {section.columnGroups.length > 0 && (
            <div className="space-y-2 mb-3">
              {section.columnGroups.map((group, gIdx) => (
                <div key={group.id} className="bg-white border border-gray-200 rounded-md p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Columns size={14} className="text-blue-500" />
                    <input
                      type="text"
                      value={group.label}
                      onChange={(e) => updateColumnGroupLabel(reportId, section.id, group.id, e.target.value)}
                      placeholder="(no group header)"
                      className="text-sm font-semibold border-none outline-none bg-transparent flex-1"
                    />
                    <span className="text-xs text-gray-400">{group.columns.length} col{group.columns.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => moveColumnGroup(reportId, section.id, group.id, -1)} disabled={gIdx === 0} className="text-gray-400 hover:text-gray-700 p-0.5 disabled:opacity-30" title="Move left">
                      <ChevronLeft size={13} />
                    </button>
                    <button onClick={() => moveColumnGroup(reportId, section.id, group.id, 1)} disabled={gIdx === section.columnGroups.length - 1} className="text-gray-400 hover:text-gray-700 p-0.5 disabled:opacity-30" title="Move right">
                      <ChevronRight size={13} />
                    </button>
                    <button
                      onClick={() => confirm({
                        title: 'Delete Column Group',
                        message: `Delete "${group.label}" and all its columns? Data in these columns will be removed.`,
                        confirmLabel: 'Delete',
                        variant: 'danger',
                        onConfirm: () => deleteColumnGroup(reportId, section.id, group.id),
                      })}
                      className="text-gray-400 hover:text-red-500 p-0.5"
                      title="Delete group"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1 ml-5">
                    {group.columns.map(col => (
                      <div key={col.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs">
                        <input
                          type="text"
                          value={col.label}
                          onChange={(e) => updateColumnLabel(reportId, section.id, group.id, col.id, e.target.value)}
                          className="border-none outline-none bg-transparent w-20 text-xs"
                        />
                        <select
                          value={col.type}
                          onChange={(e) => updateColumnType(reportId, section.id, group.id, col.id, e.target.value as ColumnType)}
                          className={`text-[10px] bg-transparent border-none outline-none cursor-pointer ${col.type === 'status' ? 'text-blue-600 font-semibold' : 'text-gray-500'}`}
                          title="Column type — Status cells are auto-coloured and counted in the summary"
                        >
                          <option value="text">Text</option>
                          <option value="status">Status</option>
                        </select>
                        <button
                          onClick={() => confirm({
                            title: 'Delete Column',
                            message: `Delete column "${col.label}"?`,
                            confirmLabel: 'Delete',
                            variant: 'danger',
                            onConfirm: () => deleteColumn(reportId, section.id, group.id, col.id),
                          })}
                          className="text-gray-400 hover:text-red-500"
                          title="Delete column"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}

                    {addingSubColTo === group.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newSubColLabel}
                          onChange={(e) => setNewSubColLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubCol(group.id); if (e.key === 'Escape') setAddingSubColTo(null); }}
                          placeholder="Column name"
                          className="text-xs px-1.5 py-0.5 border border-gray-300 rounded w-24 outline-none focus:ring-1 focus:ring-blue-400"
                          autoFocus
                        />
                        <select
                          value={newSubColType}
                          onChange={(e) => setNewSubColType(e.target.value as ColumnType)}
                          className="text-xs px-1 py-0.5 border border-gray-300 rounded"
                        >
                          <option value="text">Text</option>
                          <option value="status">Status</option>
                        </select>
                        <button onClick={() => handleAddSubCol(group.id)} className="text-xs text-blue-600 hover:text-blue-800">Add</button>
                        <button onClick={() => setAddingSubColTo(null)} className="text-xs text-gray-500">×</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingSubColTo(group.id); setNewSubColLabel(''); }}
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5 px-1"
                      >
                        <Plus size={10} /> column
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              value={newGroupLabel}
              onChange={(e) => setNewGroupLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              placeholder="New column group name..."
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAddGroup}
              disabled={!newGroupLabel.trim()}
              className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 transition-colors"
            >
              Add Group
            </button>
          </div>

          {/* Export options */}
          {totalCols > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-200 grid gap-3 sm:grid-cols-3 text-xs text-gray-700">
              <label className="flex items-center gap-2">
                <span className="whitespace-nowrap">Merge blank cells in first</span>
                <select
                  value={section.mergeColumns || 0}
                  onChange={(e) => updateTableOptions(reportId, section.id, { mergeColumns: Number(e.target.value) })}
                  className="border border-gray-300 rounded px-1 py-0.5 bg-white"
                  title="Blank cells merge into the cell above (rowspan) — ideal for grouped test suites"
                >
                  {Array.from({ length: Math.min(totalCols, 5) + 1 }, (_, n) => (
                    <option key={n} value={n}>{n === 0 ? 'off' : `${n} col${n > 1 ? 's' : ''}`}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={section.showSummary !== false}
                  onChange={(e) => updateTableOptions(reportId, section.id, { showSummary: e.target.checked })}
                />
                Status summary bar above table
              </label>
              <input
                type="text"
                value={section.caption || ''}
                onChange={(e) => updateTableOptions(reportId, section.id, { caption: e.target.value })}
                placeholder="Optional caption under the title…"
                className="px-2 py-1 border border-gray-300 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {totalCols > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <datalist id={listId}>
            {STATUS_SUGGESTIONS.map(s => <option key={s} value={s} />)}
          </datalist>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="p-2 w-8 border-r border-gray-200" rowSpan={showSubColHeaders ? 2 : 1}></th>
                {section.columnGroups.map(group => {
                  const single = group.columns.length === 1 && (group.label === '' || group.label === group.columns[0].label);
                  if (group.columns.length === 0) return null;
                  return (
                    <th
                      key={group.id}
                      colSpan={group.columns.length}
                      rowSpan={showSubColHeaders && single ? 2 : 1}
                      className="p-2 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs uppercase tracking-wide"
                    >
                      {group.label || (single ? group.columns[0].label : '')}
                      {single && group.columns[0].type === 'status' && <span className="ml-1 text-[9px] text-blue-500 font-normal normal-case">(status)</span>}
                    </th>
                  );
                })}
                <th className="p-2 w-24" rowSpan={showSubColHeaders ? 2 : 1}></th>
              </tr>
              {showSubColHeaders && (
                <tr className="bg-gray-50 border-b border-gray-200">
                  {section.columnGroups.flatMap(group => {
                    const single = group.columns.length === 1 && (group.label === '' || group.label === group.columns[0].label);
                    if (single) return [];
                    return group.columns.map((col, idx) => (
                      <th
                        key={col.id}
                        className={`p-1.5 text-center text-xs font-medium text-gray-600 ${idx < group.columns.length - 1 ? 'border-r border-gray-100' : 'border-r border-gray-200'}`}
                      >
                        {col.label}
                        {col.type === 'status' && <span className="ml-1 text-[9px] text-blue-500 font-normal">(status)</span>}
                      </th>
                    ));
                  })}
                </tr>
              )}
            </thead>
            <tbody>
              {section.rows.map((row, rIdx) => {
                const rowHasDetails = row.details.trim().length > 0 || allColumns.some(c => (row.cells[c.id]?.details || '').trim());
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50/50 group/row">
                      <td className="p-1 text-center border-r border-gray-100">
                        <button
                          onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                          className={`p-0.5 ${rowHasDetails ? 'text-blue-500' : 'text-gray-400'} hover:text-blue-600`}
                          title={rowHasDetails ? 'Row has details — click to edit' : 'Add expandable row details'}
                        >
                          {expandedRowId === row.id ? <ChevronDown size={14} /> : rowHasDetails ? <MessageSquarePlus size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      {allColumns.map((col) => {
                        const cell = row.cells[col.id] || { content: '', bgColor: '', details: '' };
                        const cellKey = `${row.id}-${col.id}`;
                        const isStatus = col.type === 'status';
                        const kind = isStatus ? classifyStatus(cell.content) : null;
                        const bgColor = cell.bgColor || (kind ? STATUS_STYLES[kind].bg : '');
                        const hasDetails = (cell.details || '').trim().length > 0;

                        return (
                          <td
                            key={col.id}
                            className="p-0.5 border-r border-gray-100 relative group align-middle"
                            style={{ backgroundColor: bgColor }}
                          >
                            {isStatus ? (
                              <input
                                list={listId}
                                value={cell.content.replace(/<[^>]*>/g, '')}
                                onChange={(e) => updateCell(reportId, section.id, row.id, col.id, { content: e.target.value })}
                                placeholder="—"
                                className="w-full min-w-[90px] text-xs font-semibold px-1.5 py-1 rounded border-none outline-none bg-transparent text-center focus:ring-1 focus:ring-blue-400"
                                style={{ color: kind ? STATUS_STYLES[kind].text : undefined }}
                                title="Type any status — values starting with Pass, Fail, Blocked, In progress, N/A… are auto-coloured"
                              />
                            ) : (
                              <RichTextEditor
                                value={cell.content}
                                onChange={(html) => updateCell(reportId, section.id, row.id, col.id, { content: html })}
                                placeholder="—"
                                className="text-xs min-h-[1.5em] px-1 py-0.5"
                                minimal
                              />
                            )}
                            <div className="absolute top-0 right-0 flex gap-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-white/70 rounded-bl">
                              <button
                                onClick={() => setDetailEditCell(detailEditCell === cellKey ? null : cellKey)}
                                className={`p-0.5 hover:text-blue-500 ${hasDetails ? 'text-blue-500' : 'text-gray-400'}`}
                                title="Cell details (shown when the row is expanded)"
                              >
                                <MessageSquarePlus size={11} />
                              </button>
                              <button
                                onClick={() => setColorPickerCell(colorPickerCell === cellKey ? null : cellKey)}
                                className="p-0.5 text-gray-400 hover:text-blue-500"
                                title="Set cell colour"
                              >
                                <Palette size={11} />
                              </button>
                            </div>
                            {hasDetails && (
                              <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-blue-500 rounded-full" title="Has details" />
                            )}
                            {colorPickerCell === cellKey && (
                              <div className="absolute top-full right-0 z-20 bg-white border border-gray-200 rounded-md shadow-lg p-1.5 flex gap-1 flex-wrap w-40">
                                {CELL_COLORS.map(c => (
                                  <button
                                    key={c.value}
                                    onClick={() => {
                                      updateCell(reportId, section.id, row.id, col.id, { bgColor: c.value });
                                      setColorPickerCell(null);
                                    }}
                                    className={`w-5 h-5 rounded border ${cell.bgColor === c.value ? 'ring-2 ring-blue-500' : 'border-gray-300'}`}
                                    style={{ backgroundColor: c.value || '#fff' }}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            )}
                            {detailEditCell === cellKey && (
                              <div className="absolute top-full left-0 z-30 bg-white border border-gray-200 rounded-md shadow-xl p-2 w-72">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">{col.label} — details (shown on expand)</label>
                                <RichTextEditor
                                  value={cell.details || ''}
                                  onChange={(html) => updateCell(reportId, section.id, row.id, col.id, { details: html })}
                                  placeholder="Defect IDs, logs, why it failed…"
                                  className="text-xs"
                                />
                                <button onClick={() => setDetailEditCell(null)} className="mt-1 text-[11px] text-gray-500 hover:text-gray-800">
                                  Done (Esc)
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-1 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-0 opacity-40 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
                          <button onClick={() => moveRow(reportId, section.id, row.id, -1)} disabled={rIdx === 0} className="text-gray-500 hover:text-gray-900 p-0.5 disabled:opacity-30" title="Move row up">
                            <ArrowUp size={13} />
                          </button>
                          <button onClick={() => moveRow(reportId, section.id, row.id, 1)} disabled={rIdx === rowCount - 1} className="text-gray-500 hover:text-gray-900 p-0.5 disabled:opacity-30" title="Move row down">
                            <ArrowDown size={13} />
                          </button>
                          <button onClick={() => insertRow(reportId, section.id, row.id)} className="text-gray-500 hover:text-blue-600 p-0.5" title="Insert row below">
                            <Plus size={13} />
                          </button>
                          <button onClick={() => duplicateRow(reportId, section.id, row.id)} className="text-gray-500 hover:text-violet-600 p-0.5" title="Duplicate row">
                            <Copy size={12} />
                          </button>
                          <button onClick={() => deleteRow(reportId, section.id, row.id)} className="text-gray-500 hover:text-red-500 p-0.5" title="Delete row (undo with Ctrl+Z)">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRowId === row.id && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={totalCols + 2} className="p-3">
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs font-semibold text-gray-600 block mb-1">Row details (shown when the row is expanded in the report)</label>
                              <RichTextEditor
                                value={row.details}
                                onChange={(html) => updateRowDetails(reportId, section.id, row.id, html)}
                                placeholder="Add details shown when row is expanded..."
                                className="text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-xs font-semibold text-gray-600">Display as</span>
                              {(['accordion', 'modal'] as DetailMode[]).map(mode => (
                                <label key={mode} className="flex items-center gap-1.5 cursor-pointer text-sm">
                                  <input
                                    type="radio"
                                    name={`mode-${row.id}`}
                                    checked={row.detailMode === mode}
                                    onChange={() => updateRowDetailMode(reportId, section.id, row.id, mode)}
                                  />
                                  {mode === 'accordion' ? 'Inline (accordion)' : 'Pop-up (modal)'}
                                </label>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-2 flex items-center gap-4">
        {totalCols > 0 && (
          <button onClick={() => addRow(reportId, section.id)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors">
            <Plus size={14} /> Add Row
          </button>
        )}
        <button onClick={() => setShowPasteImport(!showPasteImport)} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 transition-colors">
          <ClipboardPaste size={14} /> {totalCols > 0 ? 'Replace from paste / JSON' : 'Paste Table'}
        </button>
      </div>

      {showPasteImport && (
        <PasteTableImport reportId={reportId} sectionId={section.id} onClose={() => setShowPasteImport(false)} />
      )}

      {totalCols === 0 && !showPasteImport && (
        <p className="text-sm text-gray-500 italic mt-2">Add column groups above or paste a table from Excel, Word, OneNote or a web page to get started.</p>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
