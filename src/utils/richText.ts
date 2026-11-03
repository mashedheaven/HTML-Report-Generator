import DOMPurify from 'dompurify';

export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Matches issue keys such as ABC-123 or HPXAPPS-56215. */
const ISSUE_KEY_RE = /\b([A-Z][A-Z0-9]{1,15}-\d+)\b/g;
const NOT_ISSUE_PREFIXES = new Set(['UTF', 'ISO', 'SHA', 'COVID', 'WPA', 'WPA2', 'IEEE', 'RFC', 'ECMA', 'MPEG', 'TLS', 'SSL', 'IPV', 'HTTP', 'MP']);

function isIssueKey(key: string): boolean {
  return !NOT_ISSUE_PREFIXES.has(key.slice(0, key.lastIndexOf('-')));
}

/** Returns a safe http(s) base URL, or '' when the value is not usable. */
export function normalizeBaseUrl(base: string | undefined): string {
  const b = (base || '').trim();
  return /^https?:\/\/\S+$/i.test(b) ? b : '';
}

/** Finds issue keys in plain text. */
export function extractIssueKeys(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(ISSUE_KEY_RE)) {
    if (isIssueKey(m[1])) out.push(m[1]);
  }
  return out;
}

/** Plain text of an HTML fragment. */
export function htmlToText(html: string): string {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const tpl = document.createElement('template');
  tpl.innerHTML = DOMPurify.sanitize(html);
  return tpl.content.textContent || '';
}

/** Linkifies issue keys in already-escaped plain text. */
export function linkifyEscapedText(escaped: string, baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return escaped;
  return escaped.replace(ISSUE_KEY_RE, (key) =>
    isIssueKey(key)
      ? `<a class="issue-link" href="${escapeHtml(base + key)}" target="_blank" rel="noopener noreferrer">${key}</a>`
      : key,
  );
}

/**
 * Sanitizes user-provided rich HTML for the exported report and optionally turns
 * issue keys into links. All links open in a new tab.
 */
export function cleanRichHtml(html: string, issueBaseUrl = ''): string {
  if (!html || !html.trim()) return '';
  const clean = DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'] });
  if (typeof document === 'undefined') return clean;

  const base = normalizeBaseUrl(issueBaseUrl);
  const needsAnchorPass = clean.includes('<a');
  if (!base && !needsAnchorPass) return clean;

  const tpl = document.createElement('template');
  tpl.innerHTML = clean;

  tpl.content.querySelectorAll('a[href]').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });

  if (base) {
    const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n as Text;
      if (t.parentElement?.closest('a')) continue;
      ISSUE_KEY_RE.lastIndex = 0;
      if (ISSUE_KEY_RE.test(t.data)) textNodes.push(t);
    }
    for (const t of textNodes) {
      const span = document.createElement('span');
      span.innerHTML = linkifyEscapedText(escapeHtml(t.data), base);
      t.replaceWith(...Array.from(span.childNodes));
    }
  }
  return tpl.innerHTML;
}
