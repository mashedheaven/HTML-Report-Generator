import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadHtml, downloadJson, importJson } from './exportImport';
import type { Report } from '../types';

describe('exportImport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'createObjectURL');
    }

    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(URL, 'revokeObjectURL');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadHtml', () => {
    it('creates a blob, triggers download via DOM anchor, and cleans up object URL', () => {
      const mockUrl = 'blob:http://localhost/mock-uuid-1';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const htmlContent = '<html><body><h1>Test Report</h1></body></html>';
      const filename = 'test-report.html';

      downloadHtml(htmlContent, filename);

      // Verify Blob creation & createObjectURL
      expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
      const createdBlob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
      expect(createdBlob).toBeInstanceOf(Blob);
      expect(createdBlob.type).toBe('text/html;charset=utf-8');

      // Verify DOM interactions
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
      const appendedElement = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(appendedElement.tagName).toBe('A');
      expect(appendedElement.href).toBe(mockUrl);
      expect(appendedElement.download).toBe(filename);

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalledWith(appendedElement);

      // Verify URL revocation
      expect(revokeSpy).toHaveBeenCalledWith(mockUrl);
    });

    it('handles empty HTML content string correctly', () => {
      const mockUrl = 'blob:http://localhost/mock-uuid-2';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

      downloadHtml('', 'empty.html');

      const createdBlob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
      expect(createdBlob.size).toBe(0);
      expect(createdBlob.type).toBe('text/html;charset=utf-8');
    });

    it('handles filenames with special characters and complex HTML string', () => {
      const mockUrl = 'blob:http://localhost/mock-uuid-3';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      const complexHtml = '<!DOCTYPE html><html><head><title>Report & Test</title></head><body><div class="test">🚀 Content & Special Chars: <>&"\'</div></body></html>';
      const specialFilename = 'Report #1 (Final) & Updated!.html';

      downloadHtml(complexHtml, specialFilename);

      const appendedElement = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(appendedElement.download).toBe(specialFilename);
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('downloadJson', () => {
    it('formats report to JSON, sanitizes filename, and initiates download', () => {
      const mockUrl = 'blob:http://localhost/mock-uuid-json';
      vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      const mockReport: Report = {
        id: 'rep-1',
        title: 'Weekly Report #1 (May 2025)',
        description: 'Test report description',
        createdAt: '2025-05-18T00:00:00Z',
        updatedAt: '2025-05-18T00:00:00Z',
        sections: [],
      };

      downloadJson(mockReport);

      const createdBlob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
      expect(createdBlob.type).toBe('application/json');

      const appendedElement = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(appendedElement.download).toBe('Weekly_Report__1__May_2025_.json');
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeSpy).toHaveBeenCalledWith(mockUrl);
    });
  });

  describe('importJson', () => {
    it('successfully parses a valid report JSON file', async () => {
      const mockReport: Report = {
        id: 'rep-100',
        title: 'Imported Report',
        description: 'Imported description',
        createdAt: '2025-05-18',
        updatedAt: '2025-05-18',
        sections: [],
      };

      const file = new File([JSON.stringify(mockReport)], 'report.json', {
        type: 'application/json',
      });

      const result = await importJson(file);
      expect(result).toEqual(mockReport);
    });

    it('rejects when JSON format is missing required fields', async () => {
      const invalidData = {
        id: 'rep-101',
        // missing title and sections
      };

      const file = new File([JSON.stringify(invalidData)], 'invalid.json', {
        type: 'application/json',
      });

      await expect(importJson(file)).rejects.toThrow('Invalid report format');
    });

    it('rejects when file content is not valid JSON', async () => {
      const file = new File(['this is not json'], 'bad.json', {
        type: 'application/json',
      });

      await expect(importJson(file)).rejects.toThrow('Failed to parse JSON file');
    });

    it('rejects when FileReader encounters an error', async () => {
      const file = new File(['{}'], 'error.json', { type: 'application/json' });

      const readAsTextSpy = vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
        if (this.onerror) {
          this.onerror(new ProgressEvent('error') as any);
        }
      });

      await expect(importJson(file)).rejects.toThrow('Failed to read file');
      readAsTextSpy.mockRestore();
    });
  });
});
