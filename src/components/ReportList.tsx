import { useState, useRef } from 'react';
import { useReportStore } from '../store/reportStore';
import { downloadJson, downloadHtml, importJson } from '../utils/exportImport';
import { generateHtmlReport } from '../utils/htmlGenerator';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { Plus, FileDown, FileUp, Trash2, FileText, Undo2 } from 'lucide-react';

export function ReportList() {
  const { reports, createReport, deleteReport, setActiveReport, loadReports, undo, canUndo } = useReportStore();
  const [newTitle, setNewTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createReport(newTitle.trim());
    setNewTitle('');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const report = await importJson(file);
      const existing = reports.find(r => r.id === report.id);
      if (existing) {
        loadReports(reports.map(r => r.id === report.id ? report : r));
      } else {
        loadReports([...reports, report]);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Import failed');
    }
    e.target.value = '';
  };

  const handleExportHtml = (report: typeof reports[0]) => {
    const html = generateHtmlReport(report);
    downloadHtml(html, `${report.title.replace(/[^a-z0-9]/gi, '_')}.html`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Report Generator</h1>
        <p className="text-gray-600">Create interactive HTML reports with configurable tables and expandable details.</p>
      </div>

      {/* Create new report */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Enter report title..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} /> New Report
          </button>
        </div>
      </div>

      {/* Import button + Undo */}
      <div className="mb-6 flex gap-3">
        <input
          type="file"
          ref={fileInputRef}
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          <FileUp size={16} /> Import Report (JSON)
        </button>
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          title="Undo last action"
        >
          <Undo2 size={16} /> Undo
        </button>
      </div>

      {/* Report list */}
      {reports.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 opacity-40" />
          <p>No reports yet. Create your first report above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div
              key={report.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setActiveReport(report.id)}
                >
                  <h3 className="font-semibold text-gray-900">{report.title}</h3>
                  <p className="text-sm text-gray-500">
                    {report.sections.length} section{report.sections.length !== 1 ? 's' : ''} · Updated {new Date(report.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportHtml(report)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    title="Export HTML"
                  >
                    <FileDown size={16} />
                  </button>
                  <button
                    onClick={() => downloadJson(report)}
                    className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    title="Export JSON"
                  >
                    <FileDown size={16} />
                  </button>
                  <button
                    onClick={() => confirm({
                      title: 'Delete Report',
                      message: `Are you sure you want to delete "${report.title}"? This action can be undone with the Undo button.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                      onConfirm: () => deleteReport(report.id),
                    })}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
