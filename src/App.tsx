import { useEffect } from 'react';
import { useReportStore } from './store/reportStore';
import { ReportList } from './components/ReportList';
import { ReportEditor } from './components/ReportEditor';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function App() {
  const activeReportId = useReportStore(state => state.activeReportId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      // Let text fields keep their native undo while the user is typing.
      if (isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      const { undo, redo, canUndo, canRedo } = useReportStore.getState();
      if (key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undo();
      } else if ((key === 'y' || (key === 'z' && e.shiftKey)) && canRedo) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      {activeReportId ? <ReportEditor /> : <ReportList />}
    </div>
  );
}

export default App;
