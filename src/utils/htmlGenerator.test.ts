import { describe, it, expect } from 'vitest';
import { getStatusBgColor } from './statusColors';

describe('getStatusBgColor', () => {
  it('returns correct background color for pass statuses', () => {
    expect(getStatusBgColor('pass')).toBe('#dcfce7');
    expect(getStatusBgColor('passed')).toBe('#dcfce7');
  });

  it('returns correct background color for fail statuses', () => {
    expect(getStatusBgColor('fail')).toBe('#fee2e2');
    expect(getStatusBgColor('failed')).toBe('#fee2e2');
  });

  it('returns correct background color for in progress statuses', () => {
    expect(getStatusBgColor('in progress')).toBe('#fef9c3');
    expect(getStatusBgColor('in-progress')).toBe('#fef9c3');
  });

  it('returns correct background color for blocked status', () => {
    expect(getStatusBgColor('blocked')).toBe('#fecaca');
  });

  it('returns correct background color for N/A statuses', () => {
    expect(getStatusBgColor('n/a')).toBe('#f3f4f6');
    expect(getStatusBgColor('na')).toBe('#f3f4f6');
  });

  it('returns correct background color for warning status', () => {
    expect(getStatusBgColor('warning')).toBe('#ffedd5');
    expect(getStatusBgColor('At risk')).toBe('#ffedd5');
  });

  it('handles case-insensitivity and whitespace trimming', () => {
    expect(getStatusBgColor('  PASS  ')).toBe('#dcfce7');
    expect(getStatusBgColor('  Failed  ')).toBe('#fee2e2');
    expect(getStatusBgColor('IN-PROGRESS')).toBe('#fef9c3');
    expect(getStatusBgColor('  BLOCKED ')).toBe('#fecaca');
    expect(getStatusBgColor('N/A')).toBe('#f3f4f6');
  });

  it('returns empty string for unknown or empty input status', () => {
    expect(getStatusBgColor('')).toBe('');
    expect(getStatusBgColor('unknown')).toBe('');
    expect(getStatusBgColor(' tbd ')).toBe('');
    expect(getStatusBgColor('Passport check')).toBe('');
  });

  it('classifies real-world status phrases by their leading words', () => {
    expect(getStatusBgColor('Fail by HPXAPPS-56215')).toBe('#fee2e2');
    expect(getStatusBgColor('Pass with Defect DUNE-311046')).toBe('#ecfccb');
    expect(getStatusBgColor('Passed')).toBe('#dcfce7');
    expect(getStatusBgColor('Blocked by env')).toBe('#fecaca');
    expect(getStatusBgColor('Not run')).toBe('#f3f4f6');
    expect(getStatusBgColor('Pending')).toBe('#fef9c3');
  });
});
