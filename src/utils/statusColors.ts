/**
 * Status classification shared by the editor, the paste importer and the HTML exporter.
 *
 * Real-world QA reports rarely contain a bare "Pass"/"Fail" — they say things like
 * "Fail by HPXAPPS-56215" or "Pass with Defect DUNE-311046". Classification therefore
 * matches on the leading words of the value rather than requiring an exact match.
 */

export type StatusKind = 'pass' | 'passWithIssues' | 'fail' | 'blocked' | 'inProgress' | 'warning' | 'na';

export interface StatusStyle {
  label: string;
  bg: string;
  text: string;
  /** Solid colour used for summary bars and dots. */
  solid: string;
}

export const STATUS_STYLES: Record<StatusKind, StatusStyle> = {
  pass: { label: 'Pass', bg: '#dcfce7', text: '#166534', solid: '#16a34a' },
  passWithIssues: { label: 'Pass w/ issues', bg: '#ecfccb', text: '#3f6212', solid: '#84cc16' },
  fail: { label: 'Fail', bg: '#fee2e2', text: '#991b1b', solid: '#dc2626' },
  blocked: { label: 'Blocked', bg: '#fecaca', text: '#991b1b', solid: '#9f1239' },
  inProgress: { label: 'In progress', bg: '#fef9c3', text: '#854d0e', solid: '#eab308' },
  warning: { label: 'At risk', bg: '#ffedd5', text: '#9a3412', solid: '#f97316' },
  na: { label: 'N/A', bg: '#f3f4f6', text: '#4b5563', solid: '#9ca3af' },
};

/** Order used for legends and summaries. */
export const STATUS_ORDER: StatusKind[] = ['pass', 'passWithIssues', 'fail', 'blocked', 'inProgress', 'warning', 'na'];

/** Suggested values offered in the status cell picker. */
export const STATUS_SUGGESTIONS = [
  'Pass',
  'Pass with defect',
  'Fail',
  'Fail by ',
  'Blocked',
  'In Progress',
  'At Risk',
  'Not Run',
  'N/A',
];

const classifyCache = new Map<string, StatusKind | null>();

export function classifyStatus(value: string | null | undefined): StatusKind | null {
  if (!value) return null;
  const cached = classifyCache.get(value);
  if (cached !== undefined) return cached;

  const v = value.toLowerCase().replace(/\s+/g, ' ').trim();
  let kind: StatusKind | null = null;

  if (!v) kind = null;
  else if (/^pass(ed)? ?(with|w\/|but)\b/.test(v) || /^conditional(ly)? pass/.test(v)) kind = 'passWithIssues';
  else if (/^(pass|passed|ok|done|complete|completed|success|successful|green)\b/.test(v)) kind = 'pass';
  else if (/^(fail|failed|failure|error|broken|red)\b/.test(v)) kind = 'fail';
  else if (/^(blocked|blocker)\b/.test(v)) kind = 'blocked';
  else if (/^(in[ -]?progress|running|ongoing|scheduled|pending|wip|started)\b/.test(v)) kind = 'inProgress';
  else if (/^(warning|warn|at risk|risk|amber|yellow|flaky|unstable)\b/.test(v)) kind = 'warning';
  else if (/^(n\/?a|not applicable|skip|skipped|not run|not tested|deferred|-|—)$/.test(v) || /^(skipped|not run|deferred)\b/.test(v)) kind = 'na';

  if (classifyCache.size > 5000) classifyCache.clear();
  classifyCache.set(value, kind);
  return kind;
}

export function getStatusColor(value: string): string {
  const kind = classifyStatus(value);
  return kind ? STATUS_STYLES[kind].bg : '';
}

export const getStatusBgColor = getStatusColor;

export function getStatusTextColor(value: string): string {
  const kind = classifyStatus(value);
  return kind ? STATUS_STYLES[kind].text : '';
}

export type StatusCounts = Record<StatusKind, number>;

export function emptyCounts(): StatusCounts {
  return { pass: 0, passWithIssues: 0, fail: 0, blocked: 0, inProgress: 0, warning: 0, na: 0 };
}

export function addCounts(a: StatusCounts, b: StatusCounts): StatusCounts {
  const out = emptyCounts();
  for (const k of STATUS_ORDER) out[k] = a[k] + b[k];
  return out;
}

export function totalCount(c: StatusCounts): number {
  return STATUS_ORDER.reduce((sum, k) => sum + c[k], 0);
}

/** Pass rate over executed checks (excludes N/A and in-progress). Returns null when nothing was executed. */
export function passRate(c: StatusCounts): number | null {
  const executed = c.pass + c.passWithIssues + c.fail + c.blocked + c.warning;
  if (executed === 0) return null;
  return (c.pass + c.passWithIssues) / executed;
}
