import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { generateHtmlReport } from '../utils/htmlGenerator';
import { openHtmlInNewTab } from '../utils/exportImport';
import type { Report } from '../types';
import { ExternalLink, Monitor, Smartphone } from 'lucide-react';

interface Props {
  report: Report;
  className?: string;
}

/**
 * Live iframe preview. Generation is deferred so typing stays responsive, and the
 * scroll position survives re-renders (the iframe posts its scroll offset back to us).
 */
export function HtmlPreview({ report, className = '' }: Props) {
  const deferred = useDeferredValue(report);
  const scrollY = useRef(0);
  const [width, setWidth] = useState<'full' | 'mobile'>('full');

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && typeof e.data === 'object' && typeof e.data.__rgScroll === 'number') scrollY.current = e.data.__rgScroll;
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const html = useMemo(() => {
    const base = generateHtmlReport(deferred);
    const y = Math.max(0, Math.round(scrollY.current));
    const bridge = `<script>(function(){window.scrollTo(0,${y});var t;window.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(function(){parent.postMessage({__rgScroll:window.scrollY},'*')},60)});})();</script>`;
    return base.replace('</body>', `${bridge}</body>`);
  }, [deferred]);

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden bg-white flex flex-col ${className}`}>
      <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Live Preview</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setWidth('full')} className={`p-1 rounded ${width === 'full' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`} title="Desktop width">
            <Monitor size={14} />
          </button>
          <button onClick={() => setWidth('mobile')} className={`p-1 rounded ${width === 'mobile' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'}`} title="Phone width">
            <Smartphone size={14} />
          </button>
          <span className="w-px h-4 bg-gray-300 mx-1" />
          <button onClick={() => openHtmlInNewTab(generateHtmlReport(report))} className="p-1 rounded text-gray-500 hover:text-gray-900" title="Open in new tab">
            <ExternalLink size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 bg-gray-100 flex justify-center min-h-0">
        <iframe
          srcDoc={html}
          className="bg-white h-full min-h-[480px] transition-[width] duration-200"
          style={{ width: width === 'mobile' ? 390 : '100%' }}
          sandbox="allow-scripts allow-popups allow-modals"
          title="Report Preview"
        />
      </div>
    </div>
  );
}
