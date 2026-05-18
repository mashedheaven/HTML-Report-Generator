import { useMemo } from 'react';
import { generateHtmlReport } from '../utils/htmlGenerator';
import type { Report } from '../types';

interface Props {
  report: Report;
}

export function HtmlPreview({ report }: Props) {
  const html = useMemo(() => generateHtmlReport(report), [report]);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white h-full">
      <div className="bg-gray-100 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Live Preview</span>
      </div>
      <iframe
        srcDoc={html}
        className="w-full h-[calc(100%-36px)] min-h-[400px]"
        sandbox="allow-scripts"
        title="Report Preview"
      />
    </div>
  );
}
