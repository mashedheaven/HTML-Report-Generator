import { useEffect } from 'react';
import { useReportStore } from './store/reportStore';
import { ReportList } from './components/ReportList';
import { ReportEditor } from './components/ReportEditor';

function App() {
  const activeReportId = useReportStore(state => state.activeReportId);
  const undo = useReportStore(state => state.undo);
  const canUndo = useReportStore(state => state.canUndo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, canUndo]);

  return (
    <div className="min-h-screen bg-gray-50">
      {activeReportId ? <ReportEditor /> : <ReportList />}
    </div>
  );
}

export default App;
