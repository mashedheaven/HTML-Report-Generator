import { useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { TableEditor } from './TableEditor';
import { NoteEditor } from './NoteEditor';
import { HtmlPreview } from './HtmlPreview';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { downloadHtml, downloadJson } from '../utils/exportImport';
import { generateHtmlReport } from '../utils/htmlGenerator';
import type { TableSection, NoteSection } from '../types';
import { ArrowLeft, Plus, Trash2, FileDown, Table, StickyNote, Eye, Pencil, Undo2 } from 'lucide-react';

export function ReportEditor() {
  const { reports, activeReportId, setActiveReport, updateReport, addSection, deleteSection, updateSectionTitle, undo, canUndo } = useReportStore();
  const report = reports.find(r => r.id === activeReportId);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const { confirm, dialogProps } = useConfirmDialog();

  if (!report) return null;

  const handleExportHtml = () => {
    const html = generateHtmlReport(report);
    downloadHtml(html, `${report.title.replace(/[^a-z0-9]/gi, '_')}.html`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveReport(null)}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <input
              type="text"
              value={report.title}
              onChange={(e) => updateReport(report.id, { title: e.target.value })}
              className="text-2xl font-bold text-gray-900 border-none outline-none bg-transparent w-full"
            />
            <input
              type="text"
              value={report.description}
              onChange={(e) => updateReport(report.id, { description: e.target.value })}
              placeholder="Add a description..."
              className="text-sm text-gray-500 border-none outline-none bg-transparent w-full mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Undo last action (Ctrl+Z)"
          >
            <Undo2 size={16} /> Undo
          </button>
          <button
            onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors"
          >
            {view === 'edit' ? <Eye size={16} /> : <Pencil size={16} />}
            {view === 'edit' ? 'Preview' : 'Edit'}
          </button>
          <button
            onClick={handleExportHtml}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors"
          >
            <FileDown size={16} /> Export HTML
          </button>
          <button
            onClick={() => downloadJson(report)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm transition-colors"
          >
            <FileDown size={16} /> JSON
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'preview' ? (
        <HtmlPreview report={report} />
      ) : (
        <div>
          {/* Sections */}
          <div className="space-y-4 mb-6">
            {report.sections.map(section => (
              <div key={section.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {section.type === 'table' ? (
                      <Table size={16} className="text-blue-500" />
                    ) : (
                      <StickyNote size={16} className="text-amber-500" />
                    )}
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSectionTitle(report.id, section.id, e.target.value)}
                      className="font-semibold text-gray-800 border-none outline-none bg-transparent"
                    />
                  </div>
                  <button
                    onClick={() => confirm({
                      title: 'Delete Section',
                      message: `Are you sure you want to delete "${section.title}"? This action can be undone.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                      onConfirm: () => deleteSection(report.id, section.id),
                    })}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {section.type === 'table' ? (
                  <TableEditor reportId={report.id} section={section as TableSection} />
                ) : (
                  <NoteEditor reportId={report.id} section={section as NoteSection} />
                )}
              </div>
            ))}
          </div>

          {/* Add section buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => addSection(report.id, 'table')}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
            >
              <Plus size={16} /> <Table size={16} /> Add Table Section
            </button>
            <button
              onClick={() => addSection(report.id, 'note')}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-amber-400 hover:text-amber-600 transition-colors"
            >
              <Plus size={16} /> <StickyNote size={16} /> Add Note Section
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
