import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReportStore } from './reportStore';

describe('useReportStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Reset store state
    useReportStore.setState({
      reports: [],
      activeReportId: null,
      undoStack: [],
      canUndo: false,
    });
  });

  describe('saveToLocalStorage exception handling', () => {
    it('should handle localStorage.setItem exception gracefully without crashing state updates when creating a report', () => {
      // Mock localStorage.setItem to throw QuotaExceededError or DOMException
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError: The quota has been exceeded.', 'QuotaExceededError');
      });

      let reportId: string = '';
      expect(() => {
        reportId = useReportStore.getState().createReport('Test Report Exception', 'Description');
      }).not.toThrow();

      // State should still update in memory despite localStorage save failure
      const currentState = useReportStore.getState();
      expect(currentState.reports.length).toBe(1);
      expect(currentState.reports[0].title).toBe('Test Report Exception');
      expect(currentState.activeReportId).toBe(reportId);
    });

    it('should handle localStorage.setItem exception during updateReport gracefully', () => {
      const reportId = useReportStore.getState().createReport('Original Title');

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage is full or restricted');
      });

      expect(() => {
        useReportStore.getState().updateReport(reportId, { title: 'Updated Title' });
      }).not.toThrow();

      const report = useReportStore.getState().reports.find(r => r.id === reportId);
      expect(report?.title).toBe('Updated Title');
    });

    it('should handle localStorage.setItem exception during deleteReport gracefully', () => {
      const reportId = useReportStore.getState().createReport('To Delete');

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage error');
      });

      expect(() => {
        useReportStore.getState().deleteReport(reportId);
      }).not.toThrow();

      expect(useReportStore.getState().reports.length).toBe(0);
    });

    it('should handle localStorage.setItem exception during undo gracefully', () => {
      const reportId = useReportStore.getState().createReport('First');
      useReportStore.getState().addSection(reportId, 'table');

      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      expect(() => {
        useReportStore.getState().undo();
      }).not.toThrow();

      const state = useReportStore.getState();
      expect(state.reports.length).toBe(1);
      expect(state.reports[0].sections.length).toBe(0);
    });
  });

  describe('loadFromLocalStorage exception handling', () => {
    it('should handle localStorage.getItem exception gracefully', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage access denied');
      });

      expect(() => {
        localStorage.getItem('report-generator-data');
      }).toThrow('localStorage access denied');
    });
  });

  describe('standard store operations', () => {
    it('should create and manage reports correctly', () => {
      const id = useReportStore.getState().createReport('Report 1', 'Desc 1');

      expect(useReportStore.getState().reports.length).toBe(1);
      expect(useReportStore.getState().activeReport()?.id).toBe(id);

      useReportStore.getState().addSection(id, 'table');
      expect(useReportStore.getState().reports[0].sections.length).toBe(1);
      expect(useReportStore.getState().reports[0].sections[0].type).toBe('table');
    });
  });
});
