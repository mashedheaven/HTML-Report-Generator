import { useState, useRef, useMemo } from 'react';
import { useReportStore } from '../store/reportStore';
import { downloadJson, downloadHtml, importJson, reportFileName } from '../utils/exportImport';
import { generateHtmlReport } from '../utils/htmlGenerator';
import { computeReportCounts } from '../utils/reportStats';
import { STATUS_ORDER, STATUS_STYLES, totalCount, passRate } from '../utils/statusColors';
import { createSampleReport } from '../data/sampleReport';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { Plus, FileDown, FileUp, Trash2, FileText, Undo2, Redo2, Copy, Search, Sparkles, FileJson } from 'lucide-react';
import type { Report } from '../types';

function MiniStatus({ report }: { report: Report }) {
  const counts = useMemo(() => computeReportCounts(report), [report]);
  const total = totalCount(counts);
  if (total === 0) return null;
  const rate = passRate(counts);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex h-1.5 w-40 rounded-full overflow-hidden bg-gray-100 gap-px" aria-hidden>
        {STATUS_ORDER.filter(k => counts[k] > 0).map(k => (
          <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: STATUS_STYLES[k].solid }} />
        ))}
      </div>
      <span className="text-xs text-gray-500 tabular-nums">
        {rate === null ? '' : `${Math.round(rate * 100)}% pass · `}{total} checks
        {counts.fail + counts.blocked > 0 && <span className="text-red-600"> · {counts.fail + counts.blocked} fail/blocked</span>}
      </span>
    </div>
  );
}

export function ReportList() {
  const { reports, createReport, deleteReport, duplicateReport, setActiveReport, importReport, undo, redo, canUndo, canRedo } = useReportStore();
  const [newTitle, setNewTitle] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'updated' | 'title' | 'created'>('updated');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = reports.filter(r => !q || r.title.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    return [...list].sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
        : sort === 'created' ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt));
  }, [reports, query, sort]);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createReport(newTitle.trim());
    setNewTitle('');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError('');
    for (const file of files) {
      try {
        importReport(await importJson(file));
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : 'Import failed'}`);
      }
    }
    e.target.value = '';
  };

  const loadSample = () => {
    const sample = createSampleReport();
    importReport(sample);
    setActiveReport(sample.id);
  };

  const iconBtn = 'p-2 text-gray-500 rounded-md transition-colors';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-1">Report Generator</h1>
          <p className="text-gray-600">Build interactive, self-contained HTML reports — clean tables on the surface, details one click away.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={undo} disabled={!canUndo} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white rounded-md hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
            <Undo2 size={15} /> Undo
          </button>
          <button onClick={redo} disabled={!canRedo} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 bg-white rounded-md hover:bg-gray-50 text-sm disabled:opacity-40 disabled:cursor-not-allowed" title="Redo (Ctrl+Y)">
            <Redo2 size={15} /> Redo
          </button>
        </div>
      </div>

      {/* Create new report */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New report title, e.g. “Weekly QA Report — 18 May”"
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={16} /> New Report
          </button>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap text-sm">
          <input type="file" ref={fileInputRef} accept=".json,application/json" multiple onChange={handleImport} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <FileUp size={15} /> Import JSON
          </button>
          <button onClick={loadSample} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
            <Sparkles size={15} className="text-amber-500" /> Open sample report
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {reports.length > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${reports.length} report${reports.length === 1 ? '' : 's'}…`}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="text-sm border border-gray-300 rounded-md px-2 py-2 bg-white">
            <option value="updated">Last updated</option>
            <option value="created">Newest</option>
            <option value="title">Title A–Z</option>
          </select>
        </div>
      )}

      {/* Report list */}
      {reports.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
          <FileText size={44} className="mx-auto mb-4 opacity-40" />
          <p className="mb-4">No reports yet. Create one above, or start from the sample.</p>
          <button onClick={loadSample} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 text-sm">
            <Sparkles size={15} /> Open sample report
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-center text-gray-500 py-10">No reports match “{query}”.</p>
      ) : (
        <div className="space-y-2.5">
          {visible.map(report => (
            <div key={report.id} className="group bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:shadow transition-all">
              <div className="flex items-center justify-between gap-3">
                <button className="flex-1 text-left min-w-0" onClick={() => setActiveReport(report.id)}>
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-700">{report.title}</h3>
                  <p className="text-sm text-gray-500 truncate">
                    {report.sections.length} section{report.sections.length !== 1 ? 's' : ''} · Updated {new Date(report.updatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    {report.description ? ` · ${report.description}` : ''}
                  </p>
                  <MiniStatus report={report} />
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => downloadHtml(generateHtmlReport(report), reportFileName(report, 'html'))} className={`${iconBtn} hover:text-blue-600 hover:bg-blue-50`} title="Export HTML">
                    <FileDown size={16} />
                  </button>
                  <button onClick={() => downloadJson(report)} className={`${iconBtn} hover:text-emerald-600 hover:bg-emerald-50`} title="Export JSON (backup)">
                    <FileJson size={16} />
                  </button>
                  <button
                    onClick={() => {
                      const id = duplicateReport(report.id);
                      if (id) setActiveReport(id);
                    }}
                    className={`${iconBtn} hover:text-violet-600 hover:bg-violet-50`}
                    title="Duplicate (great for next week's report)"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => confirm({
                      title: 'Delete Report',
                      message: `Are you sure you want to delete "${report.title}"? This action can be undone with the Undo button.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                      onConfirm: () => deleteReport(report.id),
                    })}
                    className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}
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
