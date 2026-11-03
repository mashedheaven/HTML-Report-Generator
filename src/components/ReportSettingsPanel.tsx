import { useReportStore } from '../store/reportStore';
import { resolveSettings, type Report, type OverallStatus, type ReportSettings } from '../types';
import { normalizeBaseUrl } from '../utils/richText';

const ACCENTS = ['#2563eb', '#0d9488', '#7c3aed', '#db2777', '#ea580c', '#0f172a'];

const OVERALL: { value: OverallStatus; label: string; cls: string }[] = [
  { value: '', label: 'None', cls: 'bg-gray-100 text-gray-600' },
  { value: 'on-track', label: 'On track', cls: 'bg-green-100 text-green-800' },
  { value: 'at-risk', label: 'At risk', cls: 'bg-orange-100 text-orange-800' },
  { value: 'off-track', label: 'Off track', cls: 'bg-red-100 text-red-800' },
  { value: 'complete', label: 'Complete', cls: 'bg-blue-100 text-blue-800' },
];

export function ReportSettingsPanel({ report }: { report: Report }) {
  const updateSettings = useReportStore(s => s.updateSettings);
  const s = resolveSettings(report);
  const set = (patch: Partial<ReportSettings>) => updateSettings(report.id, patch);
  const badUrl = s.issueBaseUrl.trim() !== '' && !normalizeBaseUrl(s.issueBaseUrl);

  const label = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide block mb-1';
  const input = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <label className={label} htmlFor="set-author">Author / team</label>
        <input id="set-author" className={input} value={s.author} onChange={e => set({ author: e.target.value })} placeholder="e.g. QA Team" />
      </div>
      <div>
        <label className={label} htmlFor="set-date">Report date</label>
        <input id="set-date" type="date" className={input} value={s.reportDate} onChange={e => set({ reportDate: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <span className={label}>Overall status</span>
        <div className="flex gap-1.5 flex-wrap">
          {OVERALL.map(o => (
            <button
              key={o.value || 'none'}
              type="button"
              onClick={() => set({ overallStatus: o.value })}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${o.cls} ${s.overallStatus === o.value ? 'border-gray-900 ring-1 ring-gray-900' : 'border-transparent opacity-70 hover:opacity-100'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor="set-issues">Issue tracker link (keys like ABC-123 become links)</label>
        <input
          id="set-issues"
          className={`${input} ${badUrl ? 'border-red-400' : ''}`}
          value={s.issueBaseUrl}
          onChange={e => set({ issueBaseUrl: e.target.value })}
          placeholder="https://jira.example.com/browse/"
        />
        {badUrl && <p className="text-xs text-red-600 mt-1">Must start with http:// or https://</p>}
      </div>
      <div>
        <span className={label}>Accent colour</span>
        <div className="flex items-center gap-1.5">
          {ACCENTS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => set({ accentColor: c })}
              className={`w-6 h-6 rounded-full border-2 ${s.accentColor === c ? 'border-gray-900' : 'border-white shadow'}`}
              style={{ background: c }}
              title={c}
              aria-label={`Accent ${c}`}
            />
          ))}
          <input type="color" value={s.accentColor} onChange={e => set({ accentColor: e.target.value })} className="w-7 h-7 p-0 border-0 bg-transparent cursor-pointer" title="Custom colour" />
        </div>
      </div>
      <div>
        <label className={label} htmlFor="set-theme">Export theme</label>
        <select id="set-theme" className={input} value={s.theme} onChange={e => set({ theme: e.target.value as ReportSettings['theme'] })}>
          <option value="auto">Follow reader's system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>
      <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.showDashboard} onChange={e => set({ showDashboard: e.target.checked })} />
          Summary dashboard (pass rate, counts, issues referenced)
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.showToc} onChange={e => set({ showToc: e.target.checked })} />
          Table of contents (3+ sections)
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={s.compact} onChange={e => set({ compact: e.target.checked })} />
          Compact tables
        </label>
      </div>
    </div>
  );
}
