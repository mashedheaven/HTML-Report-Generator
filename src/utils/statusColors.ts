export function getStatusColor(value: string): string {
  const v = value.toLowerCase().trim();
  if (v === 'pass' || v === 'passed') return '#dcfce7';
  if (v === 'fail' || v === 'failed') return '#fee2e2';
  if (v === 'in progress' || v === 'in-progress') return '#fef9c3';
  if (v === 'blocked') return '#fecaca';
  if (v === 'n/a' || v === 'na') return '#f3f4f6';
  if (v === 'warning') return '#fef9c3';
  return '';
}

export const getStatusBgColor = getStatusColor;

export function getStatusTextColor(value: string): string {
  const v = value.toLowerCase().trim();
  if (v === 'pass' || v === 'passed') return '#166534';
  if (v === 'fail' || v === 'failed') return '#991b1b';
  if (v === 'in progress' || v === 'in-progress') return '#854d0e';
  if (v === 'blocked') return '#991b1b';
  if (v === 'n/a' || v === 'na') return '#4b5563';
  if (v === 'warning') return '#854d0e';
  return '';
}
