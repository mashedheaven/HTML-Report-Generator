import { useMemo, useState } from 'react';
import { useReportStore } from '../store/reportStore';
import { TableEditor } from './TableEditor';
import { NoteEditor } from './NoteEditor';
import { HtmlPreview } from './HtmlPreview';
import { ReportSettingsPanel } from './ReportSettingsPanel';
import { ConfirmDialog, useConfirmDialog } from './ConfirmDialog';
import { downloadHtml, downloadJson, reportFileName, openHtmlInNewTab } from '../utils/exportImport';
import { generateHtmlReport } from '../utils/htmlGenerator';
import { computeSectionCounts, computeReportCounts } from '../utils/reportStats';
import { STATUS_ORDER, STATUS_STYLES, totalCount, passRate } from '../utils/statusColors';
import type { TableSection, NoteSection } from '../types';
import {
  ArrowLeft, Plus, Trash2, FileDown, Table, StickyNote, Eye, Pencil, Undo2, Redo2, Settings2,
  ChevronUp, ChevronDown, Copy, Columns2, ExternalLink, FileJson, ChevronRight,
} from 'lucide-react';

type View = 'edit' | 'split' | 'preview';

function SectionStatus({ counts }: { counts: ReturnType<typeof computeSectionCounts> }) {
  const total = totalCount(counts);
  if (total === 0) return null;
  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-gray-500 tabular-nums">
      {STATUS_ORDER.filter(k => counts[k] > 0).map(k => (
        <span key={k} className="inline-flex items-center gap-1" title={STATUS_STYLES[k].label}>
          <span className="w-2 h-2 rounded-full" style={{ background: STATUS_STYLES[k].solid }} />
          {counts[k]}
        </span>
      ))}
    </span>
  );
}

export function ReportEditor() {
  const {
    reports, activeReportId, setActiveReport, updateReport, addSection, deleteSection, updateSectionTitle,
    moveSection, duplicateSection, undo, redo, canUndo, canRedo,
  } = useReportStore();
  const report = reports.find(r => r.id === activeReportId);
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.innerWidth >= 1400 ? 'split' : 'edit'));
  const [showSettings, setShowSettings] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const { confirm, dialogProps } = useConfirmDialog();
  const counts = useMemo(() => (report ? computeReportCounts(report) : null), [report]);

  if (!report) return null;

  const handleExportHtml = () => downloadHtml(generateHtmlReport(report), reportFileName(report, 'html'));
  const rate = counts ? passRate(counts) : null;

  const btn = 'flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white rounded-md hover:bg-gray-50 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const segBtn = (v: View) => `flex items-center gap-1.5 px-2.5 py-1.5 text-sm transition-colors ${view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`;

  const editor = (
    <div>
      {showSettings && <ReportSettingsPanel report={report} />}

      <div className="space-y-4 mb-6">
        {report.sections.map((section, idx) => {
          const isCollapsed = !!collapsed[section.id];
          return (
            <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <button
                    onClick={() => setCollapsed(c => ({ ...c, [section.id]: !isCollapsed }))}
                    className="text-gray-400 hover:text-gray-700 p-0.5"
                    title={isCollapsed ? 'Expand section' : 'Collapse section'}
                  >
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {section.type === 'table' ? (
                    <Table size={16} className="text-blue-500 shrink-0" />
                  ) : (
                    <StickyNote size={16} className="text-amber-500 shrink-0" />
                  )}
                  <input
                    type="text"
                    value={section.title}
                    onChange={(e) => updateSectionTitle(report.id, section.id, e.target.value)}
                    className="font-semibold text-gray-800 border-none outline-none bg-transparent flex-1 min-w-0 focus:bg-gray-50 rounded px-1"
                    aria-label="Section title"
                  />
                  <SectionStatus counts={computeSectionCounts(section)} />
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => moveSection(report.id, section.id, -1)} disabled={idx === 0} className="text-gray-400 hover:text-gray-700 p-1 disabled:opacity-30" title="Move up">
                    <ChevronUp size={16} />
                  </button>
                  <button onClick={() => moveSection(report.id, section.id, 1)} disabled={idx === report.sections.length - 1} className="text-gray-400 hover:text-gray-700 p-1 disabled:opacity-30" title="Move down">
                    <ChevronDown size={16} />
                  </button>
                  <button onClick={() => duplicateSection(report.id, section.id)} className="text-gray-400 hover:text-violet-600 p-1" title="Duplicate section">
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={() => confirm({
                      title: 'Delete Section',
                      message: `Are you sure you want to delete "${section.title}"? This action can be undone.`,
                      confirmLabel: 'Delete',
                      variant: 'danger',
                      onConfirm: () => deleteSection(report.id, section.id),
                    })}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                    title="Delete section"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              {!isCollapsed && (section.type === 'table' ? (
                <TableEditor reportId={report.id} section={section as TableSection} />
              ) : (
                <NoteEditor reportId={report.id} section={section as NoteSection} />
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 flex-wrap">
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
  );

  return (
    <div className={`${view === 'split' ? 'max-w-none' : 'max-w-6xl'} mx-auto px-4 sm:px-6 py-5`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-start gap-3 min-w-[min(100%,420px)] flex-1">
          <button onClick={() => setActiveReport(null)} className="p-2 mt-0.5 hover:bg-gray-200/60 rounded-md transition-colors" title="All reports">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={report.title}
              onChange={(e) => updateReport(report.id, { title: e.target.value })}
              className="text-2xl font-bold tracking-tight text-gray-900 border-none outline-none bg-transparent w-full focus:bg-white rounded px-1"
              aria-label="Report title"
            />
            <input
              type="text"
              value={report.description}
              onChange={(e) => updateReport(report.id, { description: e.target.value })}
              placeholder="Add a description..."
              className="text-sm text-gray-500 border-none outline-none bg-transparent w-full mt-0.5 focus:bg-white rounded px-1"
              aria-label="Report description"
            />
            {counts && totalCount(counts) > 0 && (
              <p className="text-xs text-gray-500 px-1 mt-1 tabular-nums">
                {totalCount(counts)} status checks{rate !== null && ` · ${Math.round(rate * 100)}% pass`}
                {counts.fail + counts.blocked > 0 && <span className="text-red-600"> · {counts.fail + counts.blocked} fail/blocked</span>}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={undo} disabled={!canUndo} className={btn} title="Undo (Ctrl+Z)"><Undo2 size={15} /></button>
          <button onClick={redo} disabled={!canRedo} className={btn} title="Redo (Ctrl+Y)"><Redo2 size={15} /></button>
          <button onClick={() => setShowSettings(s => !s)} className={`${btn} ${showSettings ? 'bg-gray-100 border-gray-400' : ''}`} title="Report settings">
            <Settings2 size={15} /> Settings
          </button>
          <div className="flex rounded-md border border-gray-300 overflow-hidden divide-x divide-gray-300">
            <button onClick={() => setView('edit')} className={segBtn('edit')} title="Editor only"><Pencil size={14} /> Edit</button>
            <button onClick={() => setView('split')} className={`${segBtn('split')} hidden lg:flex`} title="Editor and live preview side by side"><Columns2 size={14} /> Split</button>
            <button onClick={() => setView('preview')} className={segBtn('preview')} title="Preview only"><Eye size={14} /> Preview</button>
          </div>
          <button onClick={() => openHtmlInNewTab(generateHtmlReport(report))} className={btn} title="Open the exported report in a new tab">
            <ExternalLink size={15} />
          </button>
          <button onClick={handleExportHtml} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors">
            <FileDown size={15} /> Export HTML
          </button>
          <button onClick={() => downloadJson(report)} className={btn} title="Download JSON backup (re-importable)">
            <FileJson size={15} /> JSON
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'preview' ? (
        <HtmlPreview report={report} className="h-[calc(100vh-140px)]" />
      ) : view === 'split' ? (
        <div className="grid grid-cols-2 gap-5 items-start">
          <div className="min-w-0">{editor}</div>
          <div className="sticky top-4">
            <HtmlPreview report={report} className="h-[calc(100vh-32px)]" />
          </div>
        </div>
      ) : (
        editor
      )}

      <ConfirmDialog {...dialogProps} />
    </div>
  );
}
