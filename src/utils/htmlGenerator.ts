import type { Report, TableSection, NoteSection, TableCell, TableColumn, ReportSettings, OverallStatus } from '../types';
import { resolveSettings } from '../types';
import {
  classifyStatus, STATUS_STYLES, STATUS_ORDER, totalCount, passRate,
  type StatusCounts, type StatusKind,
} from './statusColors';
import { computeSectionCounts, computeReportCounts } from './reportStats';
import { escapeHtml, cleanRichHtml, linkifyEscapedText, extractIssueKeys, htmlToText, normalizeBaseUrl } from './richText';

export { getStatusBgColor, getStatusTextColor } from './statusColors';

interface Ctx {
  settings: ReportSettings;
  issueBase: string;
  /** Collected modal markup, appended at the end of <body>. */
  modals: string[];
}

const EMPTY_CELL: TableCell = { content: '', bgColor: '', details: '' };

const OVERALL_STATUS: Record<Exclude<OverallStatus, ''>, { label: string; color: string; bg: string }> = {
  'on-track': { label: 'On track', color: '#166534', bg: '#dcfce7' },
  'at-risk': { label: 'At risk', color: '#9a3412', bg: '#ffedd5' },
  'off-track': { label: 'Off track', color: '#991b1b', bg: '#fee2e2' },
  complete: { label: 'Complete', color: '#1e40af', bg: '#dbeafe' },
};

function safeColor(c: string | undefined, fallback = ''): string {
  const v = (c || '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^rgba?\(\s*[\d.\s,%]+\)$/i.test(v)) return v;
  if (/^[a-z]{3,20}$/i.test(v)) return v;
  return fallback;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function isBlankCell(cell: TableCell | undefined): boolean {
  if (!cell) return true;
  if (cell.bgColor || (cell.details && cell.details.trim())) return false;
  return htmlToText(cell.content || '').trim() === '' && !/<img/i.test(cell.content || '');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function generateStyles(s: ReportSettings): string {
  const accent = safeColor(s.accentColor, '#2563eb');
  return `
    <style>
      :root { --accent: ${accent}; --bg: #f6f7f9; --surface: #ffffff; --surface-2: #f8fafc; --text: #111827; --text-2: #374151; --muted: #6b7280; --border: #e5e7eb; --border-strong: #d1d5db; --head: #f1f5f9; --head-2: #f8fafc; --shadow: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.08); color-scheme: light; }
      html[data-theme="dark"] { --bg: #0b0f17; --surface: #121826; --surface-2: #172033; --text: #e5e7eb; --text-2: #cbd5e1; --muted: #94a3b8; --border: #263044; --border-strong: #334155; --head: #1a2335; --head-2: #162032; --shadow: 0 1px 2px rgba(0,0,0,.4); color-scheme: dark; }
      @media (prefers-color-scheme: dark) { html[data-theme="auto"] { --bg: #0b0f17; --surface: #121826; --surface-2: #172033; --text: #e5e7eb; --text-2: #cbd5e1; --muted: #94a3b8; --border: #263044; --border-strong: #334155; --head: #1a2335; --head-2: #162032; --shadow: 0 1px 2px rgba(0,0,0,.4); color-scheme: dark; } }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; -webkit-font-smoothing: antialiased; }
      a { color: var(--accent); }
      .page { max-width: 1280px; margin: 0 auto; padding: 28px 32px 48px; }
      /* Toolbar */
      .topbar { position: sticky; top: 0; z-index: 50; background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: saturate(1.4) blur(8px); -webkit-backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--border); }
      .topbar-inner { max-width: 1280px; margin: 0 auto; padding: 8px 32px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .topbar-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; min-width: 0; }
      .tb-actions { display: flex; gap: 6px; align-items: center; }
      .tb-btn svg { display: block; }
      .topbar-spacer { flex: 1; }
      .search { position: relative; }
      .search input { font: inherit; font-size: 13px; padding: 6px 10px 6px 28px; width: 190px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); outline: none; }
      .search input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
      .search svg { position: absolute; left: 9px; top: 50%; transform: translateY(-50%); color: var(--muted); }
      .chips { display: flex; gap: 4px; flex-wrap: nowrap; overflow-x: auto; min-width: 0; flex: 0 1 auto; scrollbar-width: none; }
      .chips::-webkit-scrollbar { display: none; }
      .chip { white-space: nowrap; flex-shrink: 0; }
      @media (min-width: 900px) { .topbar-inner { flex-wrap: nowrap; } .tb-btn { white-space: nowrap; } }
      .chip, .tb-btn { font: inherit; font-size: 12px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--text-2); border-radius: 999px; padding: 4px 10px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; line-height: 1.3; }
      .tb-btn { border-radius: 8px; }
      .chip:hover, .tb-btn:hover { border-color: var(--accent); color: var(--text); }
      .chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
      .chip .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .match-count { font-size: 12px; color: var(--muted); white-space: nowrap; }
      /* Header */
      .report-header { margin-bottom: 24px; }
      .eyebrow { font-size: 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; display: flex; gap: 8px; flex-wrap: wrap; }
      .report-header h1 { font-size: 30px; line-height: 1.2; font-weight: 750; letter-spacing: -0.02em; margin-bottom: 8px; }
      .report-description { color: var(--text-2); font-size: 15px; max-width: 80ch; white-space: pre-line; }
      .report-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; font-size: 13px; color: var(--muted); }
      .pill { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
      .pill::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
      /* Cards */
      .card, .section { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow); }
      .section { margin-bottom: 20px; padding: 20px 22px; scroll-margin-top: 64px; }
      .section h2 { font-size: 18px; font-weight: 650; letter-spacing: -0.01em; margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
      .section h2::before { content: ''; width: 4px; height: 18px; border-radius: 2px; background: var(--accent); display: inline-block; }
      .section-caption { color: var(--muted); font-size: 13px; margin-bottom: 12px; }
      .section-body { margin-top: 12px; }
      /* Dashboard */
      .dashboard { padding: 18px 22px; margin-bottom: 20px; }
      .dash-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
      .dash-head h2 { font-size: 15px; font-weight: 650; }
      .dash-head span { font-size: 12px; color: var(--muted); }
      .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 16px; }
      .kpi { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; background: var(--surface-2); }
      .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); display: flex; align-items: center; gap: 6px; }
      .kpi-value { font-size: 24px; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
      .kpi-value small { display: block; font-size: 11px; font-weight: 500; color: var(--muted); letter-spacing: 0; margin-top: -2px; }
      .sbar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: var(--border); gap: 2px; }
      .sbar > span { display: block; height: 100%; min-width: 3px; }
      .sbar.lg { height: 14px; }
      .legend { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: 12px; color: var(--text-2); }
      .legend span { display: inline-flex; align-items: center; gap: 6px; font-variant-numeric: tabular-nums; }
      .legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
      .breakdown { margin-top: 16px; display: grid; gap: 8px; }
      .breakdown-row { display: grid; grid-template-columns: minmax(120px, 220px) 1fr auto; align-items: center; gap: 12px; font-size: 13px; }
      .breakdown-row a { color: var(--text); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .breakdown-row a:hover { color: var(--accent); }
      .breakdown-row .num { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .issues { margin-top: 16px; padding-top: 14px; border-top: 1px dashed var(--border); }
      .issues h3 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 8px; }
      .issue-chips { display: flex; flex-wrap: wrap; gap: 6px; }
      .issue-chip { font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; border: 1px solid var(--border-strong); border-radius: 6px; padding: 2px 8px; color: var(--text-2); text-decoration: none; background: var(--surface-2); }
      a.issue-chip:hover { border-color: var(--accent); color: var(--accent); }
      .issue-chip b { font-weight: 600; color: var(--muted); margin-left: 4px; }
      /* TOC */
      .toc { padding: 14px 22px; margin-bottom: 20px; }
      .toc h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 6px; }
      .toc ol { list-style: none; columns: 2 260px; column-gap: 24px; }
      .toc li { break-inside: avoid; padding: 3px 0; font-size: 14px; display: flex; align-items: center; gap: 8px; }
      .toc li .n { color: var(--muted); font-variant-numeric: tabular-nums; min-width: 1.4em; }
      .toc a { color: var(--text); text-decoration: none; }
      .toc a:hover { color: var(--accent); text-decoration: underline; }
      .toc .badge { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 0 7px; }
      /* Notes & rich text */
      .note-content, .detail-content, .cell-detail-item { color: var(--text-2); font-size: 14px; line-height: 1.7; }
      .note-content p + p { margin-top: .6em; }
      .note-content ul, .note-content ol, .detail-content ul, .detail-content ol, td ul, td ol { padding-left: 1.4em; margin: .3em 0; }
      .note-content b, .note-content strong { font-weight: 600; color: var(--text); }
      .note-content i, .note-content em { font-style: italic; }
      .note-content u { text-decoration: underline; }
      .note-content s, .note-content strike { text-decoration: line-through; }
      .note-content h1, .note-content h2, .note-content h3 { color: var(--text); margin: .8em 0 .3em; line-height: 1.3; }
      .note-content blockquote { border-left: 3px solid var(--border-strong); padding-left: 12px; color: var(--muted); margin: .5em 0; }
      .note-content table { margin: .6em 0; }
      .note-content img, td img { max-width: 100%; height: auto; }
      /* Tables */
      .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .table-wrap > table { border: none; }
      th { padding: 8px 10px; text-align: center; font-weight: 600; border: 1px solid var(--border); color: var(--text); }
      .table-wrap > table > thead > tr:first-child > th { border-top: none; }
      .table-wrap > table tr > :first-child { border-left: none; }
      .table-wrap > table tr > :last-child { border-right: none; }
      .table-wrap > table > tbody > tr:last-child > td { border-bottom: none; }
      th.group-header { background: var(--head); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; }
      th.col-header { background: var(--head-2); font-size: 12px; }
      th.btn-col { width: 34px; }
      td { padding: 7px 10px; border: 1px solid var(--border); vertical-align: middle; text-align: center; position: relative; }
      td ul, td ol { display: inline-block; text-align: left; }
      td.span-cell { background: var(--surface-2); font-weight: 600; text-align: left; vertical-align: top; }
      td.has-bg { color: #111827; }
      td.has-bg a { color: #1d4ed8; }
      tbody tr.data-row:hover > td:not(.span-cell):not(.status-cell):not(.has-bg) { background: color-mix(in srgb, var(--accent) 5%, transparent); }
      .status-cell { font-weight: 600; font-size: 12px; white-space: nowrap; }
      .status-cell .issue-link { color: inherit; text-decoration: underline; text-decoration-style: dotted; text-underline-offset: 2px; }
      td[data-toggle], td[data-modal] { cursor: pointer; }
      .expand-btn { background: var(--surface); border: 1px solid var(--border-strong); border-radius: 6px; width: 22px; height: 22px; cursor: pointer; font-size: 14px; font-weight: 700; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; transition: transform .15s ease, color .15s ease, border-color .15s ease; line-height: 1; }
      .expand-btn:hover { color: var(--accent); border-color: var(--accent); }
      .expand-btn:focus-visible, .chip:focus-visible, .tb-btn:focus-visible, .modal-close:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
      .expand-btn.open { transform: rotate(45deg); color: var(--accent); border-color: var(--accent); }
      /* visibility:collapse (not display:none) keeps hidden detail rows in the table grid,
         so rowspans of merged cells stay aligned whether details are open or closed. */
      .detail-row { visibility: collapse; }
      .detail-row > td { border-top: none; border-bottom: none; }
      .detail-row.visible { visibility: visible; }
      .detail-row.visible > td { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
      .detail-row > td { padding: 0; text-align: left; background: var(--surface-2); }
      .detail-cell { padding: 12px 16px; border-left: 3px solid var(--accent); }
      .detail-content { font-size: 13px; }
      .cell-detail-dot { position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; background: var(--accent); border-radius: 50%; }
      .cell-details-grid { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .detail-content + .cell-details-grid { padding-top: 8px; border-top: 1px dashed var(--border); }
      .cell-detail-item { font-size: 13px; line-height: 1.5; }
      .cell-detail-item strong { color: var(--text); }
      tr.hide { display: none !important; }
      tr.dim > td:not(.span-cell) { opacity: .28; }
      tr.print-only { visibility: collapse; }
      .empty { color: var(--muted); font-style: italic; }
      body.compact td { padding: 3px 8px; }
      body.compact th { padding: 5px 8px; }
      /* Modal */
      .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.55); z-index: 1000; align-items: center; justify-content: center; padding: 16px; }
      .modal-overlay.visible { display: flex; }
      .modal-box { background: var(--surface); color: var(--text); border-radius: 14px; padding: 22px 24px; max-width: 640px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.3); }
      .modal-box h3 { font-size: 16px; font-weight: 650; margin-bottom: 12px; }
      .modal-box .detail-content { margin-bottom: 16px; }
      .modal-actions { display: flex; justify-content: flex-end; margin-top: 16px; }
      .modal-close { font: inherit; background: var(--surface-2); color: var(--text); border: 1px solid var(--border-strong); border-radius: 8px; padding: 6px 16px; cursor: pointer; font-size: 14px; }
      .modal-close:hover { border-color: var(--accent); }
      footer.report-footer { max-width: 1280px; margin: 0 auto; padding: 0 32px 32px; font-size: 12px; color: var(--muted); display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      @media (max-width: 720px) { .page { padding: 18px 14px 32px; } .topbar-inner { padding: 8px 14px; } .search input { width: 100%; } .search { flex: 1 1 100%; } .report-header h1 { font-size: 24px; } .section { padding: 16px 14px; } .breakdown-row { grid-template-columns: 1fr; gap: 4px; } footer.report-footer { padding: 0 14px 24px; } }
      @media print {
        html, body { background: #fff !important; color: #111 !important; }
        :root, html[data-theme] { --bg: #fff; --surface: #fff; --surface-2: #f8fafc; --text: #111; --text-2: #333; --muted: #555; --border: #d1d5db; --border-strong: #9ca3af; --head: #eef1f5; --head-2: #f6f7f9; --shadow: none; }
        .topbar, .expand-btn, .btn-col, .modal-overlay { display: none !important; }
        .detail-row, .print-only { visibility: visible !important; }
        .detail-row > td { border-top: 1px solid var(--border) !important; }
        tr.hide { display: table-row !important; }
        tr.dim > td { opacity: 1 !important; }
        .page { padding: 0; max-width: none; }
        .section, .card { box-shadow: none; break-inside: auto; }
        .section h2, .dash-head { break-after: avoid; }
        tr { break-inside: avoid; }
        thead { display: table-header-group; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        a { color: inherit; }
      }
    </style>`;
}

// ---------------------------------------------------------------------------
// Script (vanilla JS, no dependencies)
// ---------------------------------------------------------------------------

function generateScript(): string {
  return `
    <script>
    (function () {
      var d = document, root = d.documentElement;
      function all(sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); }
      function setRow(id, open) {
        var r = d.getElementById(id); if (!r) return;
        r.classList.toggle('visible', open);
        all('[data-toggle="' + id + '"]').forEach(function (b) {
          if (b.classList.contains('expand-btn')) { b.classList.toggle('open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false'); }
        });
      }
      function toggleRow(id) { var r = d.getElementById(id); if (r) setRow(id, !r.classList.contains('visible')); }
      var lastFocus = null;
      function openModal(id) {
        var m = d.getElementById(id); if (!m) return;
        lastFocus = d.activeElement; m.classList.add('visible');
        var c = m.querySelector('.modal-close'); if (c) c.focus();
      }
      function closeModals() {
        all('.modal-overlay.visible').forEach(function (m) { m.classList.remove('visible'); });
        if (lastFocus && lastFocus.focus) lastFocus.focus(); lastFocus = null;
      }
      function effectiveDark() {
        var t = root.getAttribute('data-theme');
        return t === 'dark' || (t === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
      try { var saved = localStorage.getItem('report-theme'); if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved); } catch (e) {}

      var activeKind = '';
      var search = d.getElementById('report-search');
      var countEl = d.getElementById('match-count');
      function applyFilter() {
        var q = search ? search.value.trim().toLowerCase() : '';
        var filtering = !!(q || activeKind), shown = 0, total = 0;
        all('table.report-table').forEach(function (t) {
          var merged = t.getAttribute('data-merged') === '1';
          all('tr.data-row', t).forEach(function (row) {
            total++;
            var det = row.getAttribute('data-detail');
            var detRow = det ? d.getElementById(det) : null;
            var text = (row.textContent + ' ' + (detRow ? detRow.textContent : '')).toLowerCase();
            var kinds = ' ' + (row.getAttribute('data-status') || '') + ' ';
            var ok = (!q || text.indexOf(q) !== -1) && (!activeKind || kinds.indexOf(' ' + activeKind + ' ') !== -1);
            if (ok) shown++;
            row.classList.toggle('hide', !ok && !merged);
            row.classList.toggle('dim', !ok && merged);
            if (detRow) {
              detRow.classList.toggle(merged ? 'dim' : 'hide', !ok);
              if (ok && q && row.textContent.toLowerCase().indexOf(q) === -1 && detRow.textContent.toLowerCase().indexOf(q) !== -1 && detRow.classList.contains('detail-row') && !detRow.classList.contains('print-only')) setRow(det, true);
            }
          });
        });
        if (countEl) countEl.textContent = filtering ? (shown + ' of ' + total + ' rows') : '';
      }
      if (search) {
        search.addEventListener('input', applyFilter);
        search.addEventListener('keydown', function (e) { if (e.key === 'Escape') { search.value = ''; applyFilter(); search.blur(); } });
      }

      d.addEventListener('click', function (e) {
        var t = e.target; if (!t || !t.closest) return;
        if (t.closest('a')) return;
        var el = t.closest('[data-toggle]');
        if (el) { toggleRow(el.getAttribute('data-toggle')); return; }
        el = t.closest('[data-modal]');
        if (el) { openModal(el.getAttribute('data-modal')); return; }
        if (t.closest('.modal-close') || t.classList.contains('modal-overlay')) { closeModals(); return; }
        el = t.closest('[data-filter]');
        if (el) {
          var k = el.getAttribute('data-filter');
          activeKind = activeKind === k ? '' : k;
          all('[data-filter]').forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-filter') === activeKind ? 'true' : 'false'); });
          applyFilter(); return;
        }
        el = t.closest('[data-action]');
        if (!el) return;
        var a = el.getAttribute('data-action');
        if (a === 'expand-all' || a === 'collapse-all') all('tr.detail-row:not(.print-only)').forEach(function (r) { if (!r.classList.contains('hide')) setRow(r.id, a === 'expand-all'); });
        else if (a === 'theme') { var next = effectiveDark() ? 'light' : 'dark'; root.setAttribute('data-theme', next); try { localStorage.setItem('report-theme', next); } catch (e2) {} }
        else if (a === 'print') window.print();
      });
      d.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeModals(); return; }
        var tag = (e.target && e.target.tagName) || '';
        if (e.key === '/' && search && tag !== 'INPUT' && tag !== 'TEXTAREA' && !e.target.isContentEditable) { e.preventDefault(); search.focus(); }
        if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.matches && e.target.matches('td[data-toggle], td[data-modal]')) { e.preventDefault(); e.target.click(); }
      });
      // Legacy global API (kept for compatibility with earlier exports / custom snippets)
      window.toggleAccordion = function (id) { toggleRow('detail-' + id); };
      window.openModal = function (id) { openModal('modal-' + id); };
      window.closeModal = function () { closeModals(); };
    })();
    </script>`;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function statusBar(counts: StatusCounts, large = false): string {
  const total = totalCount(counts);
  if (total === 0) return '';
  const label = STATUS_ORDER.filter(k => counts[k] > 0).map(k => `${counts[k]} ${STATUS_STYLES[k].label}`).join(', ');
  const segs = STATUS_ORDER.filter(k => counts[k] > 0)
    .map(k => `<span style="width:${((counts[k] / total) * 100).toFixed(2)}%;background:${STATUS_STYLES[k].solid}" title="${escapeHtml(`${STATUS_STYLES[k].label}: ${counts[k]}`)}"></span>`)
    .join('');
  return `<div class="sbar${large ? ' lg' : ''}" role="img" aria-label="${escapeHtml(label)}">${segs}</div>`;
}

function legend(counts: StatusCounts): string {
  return `<div class="legend">${STATUS_ORDER.filter(k => counts[k] > 0)
    .map(k => `<span><i style="background:${STATUS_STYLES[k].solid}"></i>${STATUS_STYLES[k].label} <b>${counts[k]}</b></span>`)
    .join('')}</div>`;
}

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`;
}

function collectIssueKeys(report: Report): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (text: string) => extractIssueKeys(text).forEach(k => counts.set(k, (counts.get(k) || 0) + 1));
  for (const s of report.sections) {
    if (s.type === 'note') add(htmlToText(s.content));
    else {
      for (const row of s.rows || []) {
        add(htmlToText(row.details));
        for (const cell of Object.values(row.cells || {})) {
          add(htmlToText(cell?.content || ''));
          add(htmlToText(cell?.details || ''));
        }
      }
    }
  }
  return counts;
}

function generateDashboard(report: Report, ctx: Ctx): string {
  const counts = computeReportCounts(report);
  const total = totalCount(counts);
  const issues = collectIssueKeys(report);
  if (total === 0 && issues.size === 0) return '';

  let html = '<section class="card dashboard" aria-label="Summary">';
  html += `<div class="dash-head"><h2>Summary</h2><span>Computed from ${total} status cell${total === 1 ? '' : 's'}</span></div>`;

  if (total > 0) {
    const kpi = (label: string, value: string, color?: string, sub?: string) =>
      `<div class="kpi"><div class="kpi-label">${color ? `<i class="dot" style="width:8px;height:8px;border-radius:50%;display:inline-block;background:${color}"></i>` : ''}${label}</div><div class="kpi-value">${value}${sub ? ` <small>${sub}</small>` : ''}</div></div>`;
    html += '<div class="kpis">';
    html += kpi('Pass rate', pct(passRate(counts)), undefined, 'of executed');
    html += kpi('Checks', String(total));
    for (const k of STATUS_ORDER) {
      if (counts[k] > 0 || k === 'pass' || k === 'fail') html += kpi(STATUS_STYLES[k].label, String(counts[k]), STATUS_STYLES[k].solid);
    }
    html += '</div>';
    html += statusBar(counts, true) + legend(counts);

    const rows = report.sections
      .map((s, i) => ({ s, i, c: computeSectionCounts(s) }))
      .filter(x => totalCount(x.c) > 0);
    if (rows.length > 1) {
      html += '<div class="breakdown">';
      for (const { s, i, c } of rows) {
        const bad = c.fail + c.blocked;
        html += `<div class="breakdown-row"><a href="#sec-${i + 1}">${escapeHtml(s.title || 'Untitled')}</a>${statusBar(c)}<span class="num">${pct(passRate(c))} pass${bad ? ` · ${bad} fail/blocked` : ''}</span></div>`;
      }
      html += '</div>';
    }
  }

  if (issues.size > 0) {
    const sorted = Array.from(issues.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 40);
    html += '<div class="issues"><h3>Issues referenced</h3><div class="issue-chips">';
    for (const [key, n] of sorted) {
      const inner = `${escapeHtml(key)}${n > 1 ? `<b>×${n}</b>` : ''}`;
      html += ctx.issueBase
        ? `<a class="issue-chip" href="${escapeHtml(ctx.issueBase + key)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<span class="issue-chip">${inner}</span>`;
    }
    html += '</div></div>';
  }

  html += '</section>';
  return html;
}

function generateToc(report: Report): string {
  if (report.sections.length < 3) return '';
  let html = '<nav class="card toc" aria-label="Contents"><h2>Contents</h2><ol>';
  report.sections.forEach((s, i) => {
    const c = computeSectionCounts(s);
    const bad = c.fail + c.blocked;
    const badge = bad > 0
      ? `<span class="badge" style="background:${STATUS_STYLES.fail.bg};color:${STATUS_STYLES.fail.text}">${bad} fail</span>`
      : totalCount(c) > 0 && c.inProgress === 0
        ? `<span class="badge" style="background:${STATUS_STYLES.pass.bg};color:${STATUS_STYLES.pass.text}">all pass</span>`
        : '';
    html += `<li><span class="n">${i + 1}.</span><a href="#sec-${i + 1}">${escapeHtml(s.title || 'Untitled')}</a>${badge}</li>`;
  });
  html += '</ol></nav>';
  return html;
}

function cellDetailsHtml(columns: TableColumn[], row: TableSection['rows'][number], ctx: Ctx): string {
  let out = '';
  const rowDetails = cleanRichHtml(row.details || '', ctx.issueBase);
  if (rowDetails) out += `<div class="detail-content">${rowDetails}</div>`;
  const items = columns
    .map(col => ({ col, d: cleanRichHtml(row.cells?.[col.id]?.details || '', ctx.issueBase) }))
    .filter(x => x.d);
  if (items.length) {
    out += '<div class="cell-details-grid">';
    for (const { col, d } of items) out += `<div class="cell-detail-item"><strong>${escapeHtml(col.label)}:</strong> ${d}</div>`;
    out += '</div>';
  }
  return out;
}

/**
 * Computes rowspans for the first `mergeCount` columns: a blank cell merges into the
 * cell above, and a column only keeps merging while the column to its left does
 * (so sub-groups never cross a parent-group boundary).
 *
 * Detail rows inside a merged region are counted in the rowspan; `covered[r]` is the
 * number of leading data columns still spanned at the detail row that follows row r.
 */
function computeSpans(section: TableSection, columns: TableColumn[], mergeCount: number, hasDetails: boolean[]) {
  const rows = section.rows || [];
  const span: number[][] = rows.map(() => columns.map(() => 1));
  const skip: boolean[][] = rows.map(() => columns.map(() => false));
  const n = Math.min(mergeCount, columns.length);
  for (let c = 0; c < n; c++) {
    let anchor = -1;
    for (let r = 0; r < rows.length; r++) {
      const blank = isBlankCell(rows[r].cells?.[columns[c].id]);
      const parentContinues = c === 0 || skip[r][c - 1];
      if (r > 0 && anchor >= 0 && blank && parentContinues) {
        span[anchor][c]++;
        skip[r][c] = true;
      } else {
        anchor = r;
      }
    }
  }
  const covered = rows.map((_, r) => {
    let k = 0;
    while (k < n && r + 1 < rows.length && skip[r + 1][k]) k++;
    return k;
  });
  // Add the detail rows that sit inside each merged region to its rowspan.
  for (let c = 0; c < n; c++) {
    for (let r = 0; r < rows.length; r++) {
      if (skip[r][c] || span[r][c] < 2) continue;
      for (let q = r; q < r + span[r][c] - 1; q++) if (hasDetails[q]) span[r][c]++;
    }
  }
  return { span, skip, covered };
}

function generateTableSection(section: TableSection, sIdx: number, ctx: Ctx): string {
  const columnGroups = section.columnGroups || [];
  const rows = section.rows || [];
  const allColumns = columnGroups.flatMap(g => g.columns);
  if (allColumns.length === 0) return '<p class="empty">No columns defined.</p>';
  if (rows.length === 0 && allColumns.length === 0) return '<p class="empty">No rows.</p>';

  const rowHasDetails = rows.map(row =>
    (row.details || '').trim().length > 0 ||
    allColumns.some(col => (row.cells?.[col.id]?.details || '').trim().length > 0),
  );
  const anyDetails = rowHasDetails.some(Boolean);
  const { span, skip, covered } = computeSpans(section, allColumns, section.mergeColumns || 0, rowHasDetails);
  const merged = skip.some(r => r.some(Boolean));

  let html = '';
  const counts = computeSectionCounts(section);
  if (section.showSummary !== false && totalCount(counts) > 0) {
    html += `<div style="margin-bottom:12px">${statusBar(counts)}${legend(counts)}</div>`;
  }

  html += `<div class="table-wrap"><table class="report-table" data-merged="${merged ? 1 : 0}">`;

  // Header
  const hasSubCols = columnGroups.some(g => g.columns.length > 1 || (g.columns.length === 1 && g.columns[0].label !== g.label && g.label !== ''));
  html += '<thead><tr>';
  if (anyDetails) html += `<th class="group-header btn-col"${hasSubCols ? ' rowspan="2"' : ''}></th>`;
  columnGroups.forEach(group => {
    if (group.columns.length === 0) return;
    const single = group.columns.length === 1 && (group.label === '' || group.label === group.columns[0].label);
    if (hasSubCols && single) {
      html += `<th class="group-header" rowspan="2">${escapeHtml(group.label || group.columns[0].label)}</th>`;
    } else {
      html += `<th class="group-header" colspan="${group.columns.length}">${escapeHtml(hasSubCols ? group.label : (group.label || group.columns[0]?.label || ''))}</th>`;
    }
  });
  html += '</tr>';
  if (hasSubCols) {
    html += '<tr>';
    columnGroups.forEach(group => {
      const single = group.columns.length === 1 && (group.label === '' || group.label === group.columns[0].label);
      if (single) return;
      group.columns.forEach(col => { html += `<th class="col-header">${escapeHtml(col.label)}</th>`; });
    });
    html += '</tr>';
  }
  html += '</thead><tbody>';

  const totalCols = allColumns.length + (anyDetails ? 1 : 0);

  rows.forEach((row, rIdx) => {
    const uid = `s${sIdx + 1}-r${rIdx + 1}`;
    const detailId = `detail-${uid}`;
    const modalId = `modal-${uid}`;
    const hasDetails = rowHasDetails[rIdx];
    const isModal = row.detailMode === 'modal';
    const kinds = new Set<StatusKind>();
    allColumns.forEach(col => {
      if (col.type !== 'status') return;
      const k = classifyStatus(row.cells?.[col.id]?.content);
      if (k) kinds.add(k);
    });

    const toggleAttr = hasDetails ? (isModal ? `data-modal="${modalId}"` : `data-toggle="${detailId}"`) : '';
    html += `<tr class="data-row" data-status="${Array.from(kinds).join(' ')}"${hasDetails ? ` data-detail="${detailId}"` : ''}>`;

    if (anyDetails) {
      html += hasDetails
        ? `<td class="btn-col"><button type="button" class="expand-btn" ${toggleAttr}${isModal ? ' aria-haspopup="dialog"' : ` aria-expanded="false" aria-controls="${detailId}"`} aria-label="Show details">+</button></td>`
        : '<td class="btn-col"></td>';
    }

    allColumns.forEach((col, cIdx) => {
      if (skip[rIdx][cIdx]) return;
      const cell = row.cells?.[col.id] || EMPTY_CELL;
      const isStatus = col.type === 'status';
      const kind = isStatus ? classifyStatus(cell.content) : null;
      const manualBg = safeColor(cell.bgColor);
      const bgColor = manualBg || (kind ? STATUS_STYLES[kind].bg : '');
      const textColor = kind ? STATUS_STYLES[kind].text : '';
      const cellHasDetail = (cell.details || '').trim().length > 0;
      const rs = span[rIdx][cIdx];

      const classes: string[] = [];
      if (isStatus) classes.push('status-cell');
      if (rs > 1) classes.push('span-cell');
      if (manualBg && !isStatus) classes.push('has-bg');
      const style = [bgColor ? `background:${bgColor}` : '', textColor ? `color:${textColor}` : ''].filter(Boolean).join(';');
      const attrs = [
        classes.length ? `class="${classes.join(' ')}"` : '',
        rs > 1 ? `rowspan="${rs}"` : '',
        kind ? `data-status="${kind}"` : '',
        style ? `style="${style}"` : '',
        cellHasDetail && hasDetails ? `${toggleAttr} tabindex="0" title="Click for details"` : '',
      ].filter(Boolean).join(' ');

      const body = isStatus
        ? linkifyEscapedText(escapeHtml(htmlToText(cell.content || '')), ctx.issueBase)
        : cleanRichHtml(cell.content || '', ctx.issueBase);
      html += `<td${attrs ? ' ' + attrs : ''}>${body}${cellHasDetail ? '<span class="cell-detail-dot"></span>' : ''}</td>`;
    });
    html += '</tr>';

    if (hasDetails) {
      const content = cellDetailsHtml(allColumns, row, ctx);
      const cls = isModal ? 'detail-row print-only' : 'detail-row';
      const k = covered[rIdx];
      html += k > 0
        ? `<tr class="${cls}" id="${detailId}"><td class="btn-col"></td><td colspan="${allColumns.length - k}"><div class="detail-cell">${content}</div></td></tr>`
        : `<tr class="${cls}" id="${detailId}"><td colspan="${totalCols}"><div class="detail-cell">${content}</div></td></tr>`;
      if (isModal) {
        const firstText = allColumns.map(c => htmlToText(row.cells?.[c.id]?.content || '').trim()).find(Boolean) || 'Details';
        ctx.modals.push(
          `<div class="modal-overlay" id="${modalId}" role="dialog" aria-modal="true" aria-labelledby="${modalId}-title"><div class="modal-box"><h3 id="${modalId}-title">${escapeHtml(firstText)}</h3>${content}<div class="modal-actions"><button type="button" class="modal-close">Close</button></div></div></div>`,
        );
      }
    }
  });

  html += '</tbody></table></div>';
  return html;
}

function generateNoteSection(section: NoteSection, ctx: Ctx): string {
  const content = cleanRichHtml(section.content || '', ctx.issueBase);
  return content ? `<div class="note-content">${content}</div>` : '<p class="empty">No content.</p>';
}

function generateToolbar(report: Report, hasTables: boolean, hasDetails: boolean, counts: StatusCounts): string {
  const chips = STATUS_ORDER.filter(k => counts[k] > 0)
    .map(k => `<button type="button" class="chip" data-filter="${k}" aria-pressed="false"><span class="dot" style="background:${STATUS_STYLES[k].solid}"></span>${STATUS_STYLES[k].label}</button>`)
    .join('');
  return `<header class="topbar"><div class="topbar-inner">
    <div class="topbar-title" title="${escapeHtml(report.title)}">${escapeHtml(report.title)}</div>
    <div class="topbar-spacer"></div>
    ${hasTables ? `<label class="search"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="report-search" type="search" placeholder="Filter rows…  ( / )" aria-label="Filter table rows"></label>` : ''}
    ${chips ? `<div class="chips" role="group" aria-label="Filter by status">${chips}</div>` : ''}
    <span class="match-count" id="match-count" aria-live="polite"></span>
    ${hasDetails ? '<button type="button" class="tb-btn" data-action="expand-all">Expand all</button><button type="button" class="tb-btn" data-action="collapse-all">Collapse all</button>' : ''}
    <div class="tb-actions">
    <button type="button" class="tb-btn" data-action="theme" aria-label="Toggle dark mode" title="Toggle dark mode"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg></button>
    <button type="button" class="tb-btn" data-action="print" title="Print or save as PDF" aria-label="Print"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg></button>
    </div>
  </div></header>`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function generateHtmlReport(report: Report): string {
  const settings = resolveSettings(report);
  const ctx: Ctx = { settings, issueBase: normalizeBaseUrl(settings.issueBaseUrl), modals: [] };
  const generatedAt = new Date().toLocaleString();
  const sections = report.sections || [];

  let sectionsHtml = '';
  sections.forEach((section, i) => {
    sectionsHtml += `<section class="section" id="sec-${i + 1}">`;
    sectionsHtml += `<h2>${escapeHtml(section.title)}</h2>`;
    if (section.type === 'table' && section.caption) sectionsHtml += `<p class="section-caption">${escapeHtml(section.caption)}</p>`;
    sectionsHtml += '<div class="section-body">';
    sectionsHtml += section.type === 'table' ? generateTableSection(section, i, ctx) : generateNoteSection(section, ctx);
    sectionsHtml += '</div></section>';
  });

  const counts = computeReportCounts(report);
  const hasTables = sections.some(s => s.type === 'table' && (s.rows || []).length > 0);
  const hasDetails = sectionsHtml.includes('class="detail-row"');

  const eyebrow = [settings.reportDate ? formatDate(settings.reportDate) : '', settings.author ? `By ${settings.author}` : '']
    .filter(Boolean).map(t => `<span>${escapeHtml(t)}</span>`).join('<span aria-hidden="true">·</span>');
  const overall = settings.overallStatus ? OVERALL_STATUS[settings.overallStatus] : null;

  return `<!DOCTYPE html>
<html lang="en" data-theme="${settings.theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="generator" content="HTML Report Generator">
  <title>${escapeHtml(report.title)}</title>
  ${generateStyles(settings)}
</head>
<body${settings.compact ? ' class="compact"' : ''}>
  <noscript><style>.detail-row{visibility:visible!important;}.expand-btn,.topbar .search,.topbar .chips,.topbar [data-action]{display:none!important;}</style></noscript>
  ${generateToolbar(report, hasTables, hasDetails, counts)}
  <main class="page">
  <div class="report-header">
    ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
    <h1>${escapeHtml(report.title)}</h1>
    ${report.description ? `<p class="report-description">${escapeHtml(report.description)}</p>` : ''}
    <div class="report-meta">
      ${overall ? `<span class="pill" style="background:${overall.bg};color:${overall.color}">Overall: ${overall.label}</span>` : ''}
      <span>Generated: ${escapeHtml(generatedAt)}</span>
    </div>
  </div>
  ${settings.showDashboard ? generateDashboard(report, ctx) : ''}
  ${settings.showToc ? generateToc(report) : ''}
  ${sectionsHtml}
  </main>
  <footer class="report-footer"><span>${escapeHtml(report.title)}</span><span>Self-contained report · works offline</span></footer>
  ${ctx.modals.join('\n')}
  ${generateScript()}
</body>
</html>`;
}
