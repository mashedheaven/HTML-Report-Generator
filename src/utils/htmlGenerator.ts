import type { Report, TableSection, NoteSection } from '../types';
import { getStatusBgColor, getStatusTextColor } from './statusColors';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function generateStyles(): string {
  return `
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; background: #f9fafb; color: #111827; line-height: 1.6; }
      .report-header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
      .report-header h1 { font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 8px; }
      .report-header p { color: #6b7280; font-size: 14px; }
      .report-description { color: #374151; font-size: 15px; margin-top: 8px; }
      .section { margin-bottom: 32px; background: #fff; border-radius: 8px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .section h2 { font-size: 20px; font-weight: 600; margin-bottom: 16px; color: #1f2937; }
      .note-content { color: #374151; font-size: 14px; line-height: 1.7; }
      .note-content b, .note-content strong { font-weight: 600; }
      .note-content i, .note-content em { font-style: italic; }
      .note-content u { text-decoration: underline; }
      .note-content s, .note-content strike { text-decoration: line-through; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; border: 1px solid #d1d5db; }
      th { padding: 8px 10px; text-align: center; font-weight: 600; border: 1px solid #d1d5db; }
      th.group-header { background: #e5e7eb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      th.col-header { background: #f3f4f6; font-size: 12px; }
      td { padding: 6px 10px; border: 1px solid #e5e7eb; vertical-align: middle; text-align: center; }
      tr:hover { opacity: 0.95; }
      .status-cell { font-weight: 600; font-size: 12px; border-radius: 0; }
      .expand-btn { background: none; border: 1px solid #d1d5db; border-radius: 4px; width: 22px; height: 22px; cursor: pointer; font-size: 14px; font-weight: bold; color: #6b7280; display: inline-flex; align-items: center; justify-content: center; transition: all 0.2s; }
      .expand-btn:hover { background: #f3f4f6; color: #111827; }
      .expand-btn.open { transform: rotate(45deg); color: #2563eb; border-color: #2563eb; }
      .detail-row { display: none; }
      .detail-row.visible { display: table-row; }
      .detail-cell { padding: 12px 16px; background: #f8fafc; border: 1px solid #e5e7eb; text-align: left; }
      .detail-content { font-size: 13px; color: #4b5563; line-height: 1.6; }
      .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
      .modal-overlay.visible { display: flex; }
      .modal-box { background: #fff; border-radius: 8px; padding: 24px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
      .modal-box h3 { font-size: 16px; font-weight: 600; margin-bottom: 12px; }
      .modal-box .detail-content { margin-bottom: 16px; }
      .modal-close { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 6px 16px; cursor: pointer; font-size: 14px; }
      .modal-close:hover { background: #e5e7eb; }
      @media print { .expand-btn { display: none; } .detail-row { display: table-row !important; } .modal-overlay { display: none !important; } body { padding: 16px; } }
      noscript .detail-row { display: table-row !important; }
      .cell-detail-dot { position: absolute; bottom: 2px; right: 3px; width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; }
      .cell-details-grid { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
      .cell-detail-item { font-size: 13px; color: #374151; line-height: 1.5; }
      .cell-detail-item strong { color: #111827; }
    </style>`;
}

function generateScript(): string {
  return `
    <script>
      function toggleAccordion(rowId) {
        var detailRow = document.getElementById('detail-' + rowId);
        var btn = document.getElementById('btn-' + rowId);
        if (detailRow.classList.contains('visible')) {
          detailRow.classList.remove('visible');
          btn.classList.remove('open');
          btn.textContent = '+';
        } else {
          detailRow.classList.add('visible');
          btn.classList.add('open');
          btn.textContent = '+';
        }
      }
      function openModal(rowId) {
        var modal = document.getElementById('modal-' + rowId);
        modal.classList.add('visible');
      }
      function closeModal(rowId) {
        var modal = document.getElementById('modal-' + rowId);
        modal.classList.remove('visible');
      }
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
          var modals = document.querySelectorAll('.modal-overlay.visible');
          modals.forEach(function(m) { m.classList.remove('visible'); });
        }
      });
    </script>`;
}

function generateTableSection(section: TableSection): string {
  const columnGroups = section.columnGroups || [];
  const rows = section.rows || [];
  const allColumns = columnGroups.flatMap(g => g.columns);
  if (allColumns.length === 0) return '<p style="color:#6b7280;font-style:italic;">No columns defined.</p>';

  const totalCols = allColumns.length + 1; // +1 for expand button col

  let html = '<table>';

  // Group header row
  html += '<thead><tr>';
  html += '<th class="group-header" style="width:30px;"></th>';
  columnGroups.forEach(group => {
    html += `<th class="group-header" colspan="${group.columns.length}">${escapeHtml(group.label)}</th>`;
  });
  html += '</tr>';

  // Sub-column header row (only if any group has multiple columns or different label)
  const hasSubCols = columnGroups.some(g => g.columns.length > 1 || (g.columns.length === 1 && g.columns[0].label !== g.label));
  if (hasSubCols) {
    html += '<tr>';
    html += '<th class="col-header"></th>';
    columnGroups.forEach(group => {
      group.columns.forEach(col => {
        html += `<th class="col-header">${escapeHtml(col.label)}</th>`;
      });
    });
    html += '</tr>';
  }
  html += '</thead>';

  html += '<tbody>';
  let modals = '';

  rows.forEach(row => {
    const hasRowDetails = row.details.trim().length > 0;
    const hasCellDetails = allColumns.some(col => {
      const cell = row.cells[col.id];
      return cell && cell.details && cell.details.trim().length > 0;
    });
    const hasDetails = hasRowDetails || hasCellDetails;
    html += '<tr>';

    // Expand button
    if (hasDetails) {
      if (row.detailMode === 'accordion') {
        html += `<td><button class="expand-btn" id="btn-${row.id}" onclick="toggleAccordion('${row.id}')">+</button></td>`;
      } else {
        html += `<td><button class="expand-btn" onclick="openModal('${row.id}')">+</button></td>`;
      }
    } else {
      html += '<td></td>';
    }

    // Cells
    allColumns.forEach(col => {
      const cell = row.cells[col.id] || { content: '', bgColor: '', details: '' };
      const isStatus = col.type === 'status';
      const bgColor = cell.bgColor || (isStatus ? getStatusBgColor(cell.content) : '');
      const textColor = isStatus ? getStatusTextColor(cell.content) : '';
      const cellHasDetail = (cell.details || '').trim().length > 0;
      const style = [
        bgColor ? `background:${bgColor}` : '',
        textColor ? `color:${textColor}` : '',
        isStatus ? 'font-weight:600' : '',
        'position:relative',
      ].filter(Boolean).join(';');

      if (isStatus) {
        html += `<td class="status-cell" style="${style}">${escapeHtml(cell.content)}${cellHasDetail ? '<span class="cell-detail-dot"></span>' : ''}</td>`;
      } else {
        html += `<td style="${style}">${cell.content || ''}${cellHasDetail ? '<span class="cell-detail-dot"></span>' : ''}</td>`;
      }
    });

    html += '</tr>';

    // Detail row (accordion) - combined row details + per-cell details
    if (hasDetails && row.detailMode === 'accordion') {
      let detailContent = '';
      if (hasRowDetails) {
        detailContent += `<div class="detail-content">${row.details}</div>`;
      }
      if (hasCellDetails) {
        detailContent += '<div class="cell-details-grid">';
        allColumns.forEach(col => {
          const cell = row.cells[col.id];
          if (cell && cell.details && cell.details.trim().length > 0) {
            detailContent += `<div class="cell-detail-item"><strong>${escapeHtml(col.label)}:</strong> ${cell.details}</div>`;
          }
        });
        detailContent += '</div>';
      }
      html += `<tr class="detail-row" id="detail-${row.id}"><td colspan="${totalCols}"><div class="detail-cell">${detailContent}</div></td></tr>`;
    }

    // Modal
    if (hasDetails && row.detailMode === 'modal') {
      let detailContent = '';
      if (hasRowDetails) {
        detailContent += `<div class="detail-content">${row.details}</div>`;
      }
      if (hasCellDetails) {
        detailContent += '<div class="cell-details-grid">';
        allColumns.forEach(col => {
          const cell = row.cells[col.id];
          if (cell && cell.details && cell.details.trim().length > 0) {
            detailContent += `<div class="cell-detail-item"><strong>${escapeHtml(col.label)}:</strong> ${cell.details}</div>`;
          }
        });
        detailContent += '</div>';
      }
      modals += `<div class="modal-overlay" id="modal-${row.id}" onclick="if(event.target===this)closeModal('${row.id}')"><div class="modal-box"><h3>Details</h3>${detailContent}<button class="modal-close" onclick="closeModal('${row.id}')">Close</button></div></div>`;
    }
  });

  html += '</tbody></table>';
  html += modals;
  return html;
}

function generateNoteSection(section: NoteSection): string {
  return `<div class="note-content">${section.content}</div>`;
}

export function generateHtmlReport(report: Report): string {
  const generatedAt = new Date().toLocaleString();

  let sectionsHtml = '';
  report.sections.forEach(section => {
    sectionsHtml += '<div class="section">';
    sectionsHtml += `<h2>${escapeHtml(section.title)}</h2>`;
    if (section.type === 'table') {
      sectionsHtml += generateTableSection(section);
    } else {
      sectionsHtml += generateNoteSection(section);
    }
    sectionsHtml += '</div>';
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(report.title)}</title>
  ${generateStyles()}
</head>
<body>
  <noscript><style>.detail-row{display:table-row!important;}.expand-btn{display:none!important;}</style></noscript>
  <div class="report-header">
    <h1>${escapeHtml(report.title)}</h1>
    ${report.description ? `<p class="report-description">${escapeHtml(report.description)}</p>` : ''}
    <p>Generated: ${escapeHtml(generatedAt)}</p>
  </div>
  ${sectionsHtml}
  ${generateScript()}
</body>
</html>`;
}
