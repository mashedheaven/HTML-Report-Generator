import { useReportStore } from '../store/reportStore';
import { RichTextEditor } from './RichTextEditor';
import type { NoteSection } from '../types';

interface Props {
  reportId: string;
  section: NoteSection;
}

export function NoteEditor({ reportId, section }: Props) {
  const { updateNoteContent } = useReportStore();

  return (
    <div>
      <RichTextEditor
        value={section.content}
        onChange={(html) => updateNoteContent(reportId, section.id, html)}
        placeholder="Write your notes here... Use the toolbar or keyboard shortcuts (Ctrl+B bold, Ctrl+I italic, Ctrl+U underline)."
      />
    </div>
  );
}
