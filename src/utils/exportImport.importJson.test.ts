import { describe, it, expect } from 'vitest';
import { importJson } from './exportImport';

describe('importJson', () => {
  it('successfully parses valid report JSON file', async () => {
    const validReport = {
      id: '123',
      title: 'Test Report',
      sections: [],
      createdAt: '2023-01-01',
      updatedAt: '2023-01-01',
    };
    const file = new File([JSON.stringify(validReport)], 'report.json', { type: 'application/json' });
    const result = await importJson(file);
    expect(result).toEqual(validReport);
  });

  it('rejects when JSON structure is missing id', async () => {
    const invalidReport = { title: 'Test', sections: [] };
    const file = new File([JSON.stringify(invalidReport)], 'report.json', { type: 'application/json' });
    await expect(importJson(file)).rejects.toThrow('Invalid report format');
  });

  it('rejects when JSON structure is missing title', async () => {
    const invalidReport = { id: '123', sections: [] };
    const file = new File([JSON.stringify(invalidReport)], 'report.json', { type: 'application/json' });
    await expect(importJson(file)).rejects.toThrow('Invalid report format');
  });

  it('rejects when JSON structure is missing sections', async () => {
    const invalidReport = { id: '123', title: 'Test' };
    const file = new File([JSON.stringify(invalidReport)], 'report.json', { type: 'application/json' });
    await expect(importJson(file)).rejects.toThrow('Invalid report format');
  });

  it('rejects when sections is not an array', async () => {
    const invalidReport = { id: '123', title: 'Test', sections: 'not-an-array' };
    const file = new File([JSON.stringify(invalidReport)], 'report.json', { type: 'application/json' });
    await expect(importJson(file)).rejects.toThrow('Invalid report format');
  });

  it('rejects when file contains invalid JSON', async () => {
    const file = new File(['{ invalid json: '], 'report.json', { type: 'application/json' });
    await expect(importJson(file)).rejects.toThrow('Failed to parse JSON file');
  });

  it('rejects when FileReader triggers an error', async () => {
    const file = new File(['test'], 'report.json', { type: 'application/json' });

    const OriginalFileReader = globalThis.FileReader;
    class MockFileReader {
      onload: ((e: any) => void) | null = null;
      onerror: ((e: any) => void) | null = null;
      readAsText() {
        setTimeout(() => {
          if (this.onerror) {
            this.onerror(new ProgressEvent('error'));
          }
        }, 0);
      }
    }

    globalThis.FileReader = MockFileReader as any;

    try {
      await expect(importJson(file)).rejects.toThrow('Failed to read file');
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });
});
