import { useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { RichTextEditor } from './RichTextEditor';
import { PasteTableImport } from './PasteTableImport';
import type { TableSection, ColumnType, DetailMode } from '../types';
import { Plus, Trash2, ChevronDown, ChevronRight, Columns, Palette, ClipboardPaste } from 'lucide-react';

const STATUS_VALUES = ['Pass', 'Fail', 'In Progress', 'Blocked', 'N/A'] as const;

const statusColorCache = new Map<string, string>();
const statusTextColorCache = new Map<string, string>();

function getStatusColor(value: string): string {
  const cached = statusColorCache.get(value);
  if (cached !== undefined) return cached;

  const v = value.toLowerCase().trim();
  let result = '';
  if (v === 'pass' || v === 'passed') result = '#dcfce7';
  else if (v === 'fail' || v === 'failed') result = '#fee2e2';
  else if (v === 'in progress' || v === 'in-progress') result = '#fef9c3';
  else if (v === 'blocked') result = '#fecaca';
  else if (v === 'n/a' || v === 'na') result = '#f3f4f6';
  else if (v === 'warning') result = '#fef9c3';

  if (statusColorCache.size < 500) {
    statusColorCache.set(value, result);
  }
  return result;
}

function getStatusTextColor(value: string): string {
  const cached = statusTextColorCache.get(value);
  if (cached !== undefined) return cached;

  const v = value.toLowerCase().trim();
  let result = '';
  if (v === 'pass' || v === 'passed') result = '#166534';
  else if (v === 'fail' || v === 'failed') result = '#991b1b';
  else if (v === 'in progress' || v === 'in-progress') result = '#854d0e';
  else if (v === 'blocked') result = '#991b1b';
  else if (v === 'n/a' || v === 'na') result = '#4b5563';
  else if (v === 'warning') result = '#854d0e';

  if (statusTextColorCache.size < 500) {
    statusTextColorCache.set(value, result);
  }
  return result;
}

const CELL_COLORS = [
  { label: 'None', value: '' },
  { label: 'Green', value: '#dcfce7' },
  { label: 'Red', value: '#fee2e2' },
  { label: 'Yellow', value: '#fef9c3' },
  { label: 'Blue', value: '#dbeafe' },
  { label: 'Gray', value: '#f3f4f6' },
  { label: 'Orange', value: '#ffedd5' },
  { label: 'Purple', value: '#f3e8ff' },
];

interface Props {
  reportId: string;
  section: TableSection;
}

export function TableEditor({ reportId, section }: Props) {
  const {
    addColumnGroup, deleteColumnGroup, updateColumnGroupLabel,
    addColumn, deleteColumn, updateColumnLabel, updateColumnType,
    addRow, deleteRow, updateCell,
    updateRowDetails, updateRowDetailMode,
  } = useReportStore();

  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [addingSubColTo, setAddingSubColTo] = useState<string | null>(null);
  const [newSubColLabel, setNewSubColLabel] = useState('');
  const [newSubColType, setNewSubColType] = useState<ColumnType>('text');
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [colorPickerCell, setColorPickerCell] = useState<string | null>(null);
  const [detailEditCell, setDetailEditCell] = useState<string | null>(null); // "rowId-colId"
  const [showPasteImport, setShowPasteImport] = useState(false);
  const { confirm, dialogProps } = useConfirmDialog();

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

  // Flatten all columns for rendering the table
  const allColumns = section.columnGroups.flatMap(g => g.columns);
  const totalCols = allColumns.length;
  // Only show sub-column header row if any group has multiple columns or a column with a different name
  const showSubColHeaders = section.columnGroups.some(
    g => g.columns.length > 1 || (g.columns.length === 1 && g.columns[0].label !== g.label)
  );

  return (
    <div>
      {/* Column Groups Management */}
      <div className="mb-4 p-3 bg-gray-50 rounded-md">
        <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2 block">
          Column Groups
        </label>

        {section.columnGroups.length > 0 && (
          <div className="space-y-2 mb-3">
            {section.columnGroups.map(group => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-md p-2">
                <div className="flex items-center gap-2 mb-1">
                  <Columns size={14} className="text-blue-500" />
                  <input
                    type="text"
                    value={group.label}
                    onChange={(e) => updateColumnGroupLabel(reportId, section.id, group.id, e.target.value)}
                    className="text-sm font-semibold border-none outline-none bg-transparent flex-1"
                  />
                  <span className="text-xs text-gray-400">{group.columns.length} col{group.columns.length !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => confirm({
                      title: 'Delete Column Group',
                      message: `Delete "${group.label}" and all its columns? Data in these columns will be removed.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                      onConfirm: () => deleteColumnGroup(reportId, section.id, group.id),
                    })}
                    className="text-gray-400 hover:text-red-500 p-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Sub-columns */}
                <div className="flex flex-wrap gap-1 ml-5">
                  {group.columns.map(col => (
                    <div key={col.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-xs">
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => updateColumnLabel(reportId, section.id, group.id, col.id, e.target.value)}
                        className="border-none outline-none bg-transparent w-16 text-xs"
                      />
                      <select
                        value={col.type}
                        onChange={(e) => updateColumnType(reportId, section.id, group.id, col.id, e.target.value as ColumnType)}
                        className="text-[10px] bg-transparent border-none outline-none text-gray-500 cursor-pointer"
                        title="Column type"
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
                        onKeyDown={(e) => e.key === 'Enter' && handleAddSubCol(group.id)}
                        placeholder="Column name"
                        className="text-xs px-1.5 py-0.5 border border-gray-300 rounded w-20 outline-none focus:ring-1 focus:ring-blue-400"
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

        <div className="flex gap-2">
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
      </div>

      {/* Table Rendering */}
      {totalCols > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="w-full text-sm border-collapse">
            {/* Group header row */}
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="p-2 w-8 border-r border-gray-200"></th>
                {section.columnGroups.map(group => (
                  <th
                    key={group.id}
                    colSpan={group.columns.length}
                    className="p-2 text-center font-semibold text-gray-700 border-r border-gray-200 text-xs uppercase tracking-wide"
                  >
                    {group.label}
                  </th>
                ))}
                <th className="p-2 w-16 border-gray-200"></th>
              </tr>
              {/* Sub-column header row - only if needed */}
              {showSubColHeaders && (
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-1.5 border-r border-gray-200"></th>
                {section.columnGroups.flatMap(group =>
                  group.columns.map((col, idx) => (
                    <th
                      key={col.id}
                      className={`p-1.5 text-center text-xs font-medium text-gray-600 ${idx < group.columns.length - 1 ? 'border-r border-gray-100' : 'border-r border-gray-200'}`}
                    >
                      {col.label}
                      {col.type === 'status' && (
                        <span className="ml-1 text-[9px] text-blue-500 font-normal">(status)</span>
                      )}
                    </th>
                  ))
                )}
                <th className="p-1.5"></th>
              </tr>
              )}
            </thead>
            <tbody>
              {section.rows.map((row) => (
                <>
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    {/* Expand button */}
                    <td className="p-1 text-center border-r border-gray-100">
                      <button
                        onClick={() => setExpandedRowId(expandedRowId === row.id ? null : row.id)}
                        className="text-gray-400 hover:text-blue-600 p-0.5"
                        title="Toggle details"
                      >
                        {expandedRowId === row.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                    {/* Cells */}
                    {allColumns.map((col) => {
                      const cell = row.cells[col.id] || { content: '', bgColor: '', details: '' };
                      const cellKey = `${row.id}-${col.id}`;
                      const isStatus = col.type === 'status';
                      const autoColor = isStatus ? getStatusColor(cell.content) : '';
                      const autoTextColor = isStatus ? getStatusTextColor(cell.content) : '';
                      const bgColor = cell.bgColor || autoColor;
                      const hasDetails = (cell.details || '').trim().length > 0;

                      return (
                        <td
                          key={col.id}
                          className="p-0.5 border-r border-gray-100 relative group"
                          style={{ backgroundColor: bgColor }}
                        >
                          {isStatus ? (
                            <select
                              value={cell.content}
                              onChange={(e) => updateCell(reportId, section.id, row.id, col.id, { content: e.target.value })}
                              className="w-full text-xs font-semibold px-1.5 py-1 rounded border-none outline-none cursor-pointer bg-transparent text-center"
                              style={{ color: autoTextColor }}
                            >
                              <option value="">—</option>
                              {STATUS_VALUES.map(sv => (
                                <option key={sv} value={sv}>{sv}</option>
                              ))}
                            </select>
                          ) : (
                            <RichTextEditor
                              value={cell.content}
                              onChange={(html) => updateCell(reportId, section.id, row.id, col.id, { content: html })}
                              placeholder="—"
                              className="text-xs min-h-[1.5em] px-1 py-0.5"
                              minimal
                            />
                          )}
                          {/* Cell action buttons (top-right corner) */}
                          <div className="absolute top-0 right-0 flex gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setDetailEditCell(detailEditCell === cellKey ? null : cellKey)}
                              className={`p-0.5 text-gray-400 hover:text-blue-500 ${hasDetails ? 'opacity-100 text-blue-400' : ''}`}
                              title="Cell details (expandable info)"
                            >
                              <Plus size={10} />
                            </button>
                            <button
                              onClick={() => setColorPickerCell(colorPickerCell === cellKey ? null : cellKey)}
                              className="p-0.5 text-gray-400 hover:text-blue-500"
                              title="Set cell color"
                            >
                              <Palette size={10} />
                            </button>
                          </div>
                          {/* Has details indicator */}
                          {hasDetails && (
                            <div className="absolute bottom-0 right-0.5 w-1.5 h-1.5 bg-blue-400 rounded-full" title="Has details" />
                          )}
                          {/* Color picker popup */}
                          {colorPickerCell === cellKey && (
                            <div className="absolute top-full right-0 z-20 bg-white border border-gray-200 rounded-md shadow-lg p-1.5 flex gap-1 flex-wrap w-36">
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
                          {/* Cell detail editor popup */}
                          {detailEditCell === cellKey && (
                            <div className="absolute top-full left-0 z-30 bg-white border border-gray-200 rounded-md shadow-xl p-2 w-64">
                              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Cell Details (shown on expand)</label>
                              <RichTextEditor
                                value={cell.details || ''}
                                onChange={(html) => updateCell(reportId, section.id, row.id, col.id, { details: html })}
                                placeholder="Add expandable details for this cell..."
                                className="text-xs"
                              />
                              <button
                                onClick={() => setDetailEditCell(null)}
                                className="mt-1 text-[10px] text-gray-500 hover:text-gray-700"
                              >
                                Close
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    {/* Row actions */}
                    <td className="p-1 text-center">
                      <button
                        onClick={() => deleteRow(reportId, section.id, row.id)}
                        className="text-gray-400 hover:text-red-500 p-0.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {expandedRowId === row.id && (
                    <tr key={`${row.id}-details`} className="bg-blue-50/40">
                      <td colSpan={totalCols + 2} className="p-3">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Expanded Details (shown on expand in report)</label>
                            <RichTextEditor
                              value={row.details}
                              onChange={(html) => updateRowDetails(reportId, section.id, row.id, html)}
                              placeholder="Add details shown when row is expanded..."
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-gray-600 block mb-1">Display Mode</label>
                            <div className="flex gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mode-${row.id}`}
                                  checked={row.detailMode === 'accordion'}
                                  onChange={() => updateRowDetailMode(reportId, section.id, row.id, 'accordion' as DetailMode)}
                                />
                                <span className="text-sm">Accordion</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`mode-${row.id}`}
                                  checked={row.detailMode === 'modal'}
                                  onChange={() => updateRowDetailMode(reportId, section.id, row.id, 'modal' as DetailMode)}
                                />
                                <span className="text-sm">Modal</span>
                              </label>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>

        </div>
      )}

      {/* Action buttons - always visible */}
      <div className="mt-2 flex items-center gap-3">
        {totalCols > 0 && (
          <button
            onClick={() => addRow(reportId, section.id)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Plus size={14} /> Add Row
          </button>
        )}
        <button
          onClick={() => setShowPasteImport(!showPasteImport)}
          className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800 transition-colors"
        >
          <ClipboardPaste size={14} /> Paste Table
        </button>
      </div>

      {showPasteImport && (
        <PasteTableImport
          reportId={reportId}
          sectionId={section.id}
          onClose={() => setShowPasteImport(false)}
        />
      )}

      {totalCols === 0 && !showPasteImport && (
        <p className="text-sm text-gray-500 italic mt-2">Add column groups above or paste a table to get started.</p>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
