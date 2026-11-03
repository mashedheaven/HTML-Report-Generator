# Report Generation

A React + TypeScript web application for creating interactive, self-contained HTML reports with configurable tables, rich text editing, and one-click export.

## Why This Exists

Quality reporting often boils down to sending tables — simple pass/fail grids that summarize test results. But reviewers frequently need *more context* behind a cell: why did something fail? What's the defect ID? What changed since last round?

Traditional table formats force a choice: keep it simple (and lose detail) or add detail (and drown the reader). HTML solves this by letting tables stay clean on the surface while hiding expandable details beneath each cell or row — available on click, invisible otherwise.

This app was built to make that workflow effortless: define your table structure, fill in results, attach details where needed, and export a single self-contained HTML file that anyone can open in a browser — no installs, no dependencies, no accounts. Simple outlook, rich information underneath.

## Features

### The exported report (single self-contained `.html`, works offline)
- **Summary dashboard** — pass rate, counts per status, a stacked status bar, a per-table breakdown, and an "Issues referenced" list built from every issue key in the report
- **Sticky toolbar** — filter rows by text (press `/`), filter by status chips, expand/collapse all details, dark-mode toggle, print / save as PDF
- **Table of contents** with fail badges per section (reports with 3+ sections)
- **Merged cells** — blank leading cells merge into the cell above (rowspan), so grouped test suites read like the original spreadsheet
- **Issue links** — set a tracker base URL and keys like `DUNE-311046` become links everywhere
- **Smart statuses** — "Fail by HPXAPPS-56215", "Pass with defect X", "Blocked", "Not run"… are classified by their leading words and coloured accordingly
- **Expandable details** — inline accordion or pop-up modal per row, plus per-cell notes; cells with notes are clickable
- **Accessible & robust** — keyboard support, ARIA attributes, focus handling, no inline event handlers, all rich content sanitised (DOMPurify)
- **Print-ready** — toolbar hidden, every detail (including pop-up details) printed, colours preserved
- **Light / dark / auto theme**, compact mode, custom accent colour, responsive down to phone width

### Editor
- **Column groups & sub-columns** with two-level headers; reorder groups
- **Column types** — `text` (rich HTML) or `status` (free-text with suggestions, auto-coloured and counted)
- **Rows** — insert, duplicate, move up/down, delete; row-level and cell-level details
- **Sections** — tables and rich-text notes; reorder, duplicate, collapse
- **Report settings** — author, report date, overall status (On track / At risk / Off track / Complete), accent colour, issue tracker URL, dashboard/TOC toggles, theme
- **Edit / Split / Preview** views — live preview keeps its scroll position, with desktop and phone widths and "open in new tab"
- **Duplicate report** — start next week's report from this week's in one click
- **Undo / Redo** (Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z) — typing is grouped into single steps; native undo still works inside text fields
- **Search & sort** the report list, with a pass-rate bar per report
- **Sample report** to explore every feature

### Import
- **Paste Table** — from Excel, Word, OneNote or web pages; handles merged cells (rowspan/colspan), keeps cell colours, and auto-detects status columns
- **JSON Import** — complex multi-level tables, including row details and merge settings (see below)
- **Report JSON** — import one or more full report backups

### Export
- **Self-contained HTML** — inline CSS + vanilla JS, no external requests
- **JSON** — full report data for backup/transfer between instances

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.6 |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| State | Zustand 5 (with undo stack) |
| Icons | lucide-react |
| IDs | uuid v11 |

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for Production

```bash
npm run build
npm run preview
```

## Tests

```bash
npm test
```

## Project Structure

```
src/
├── App.tsx                    # Root component, global Ctrl+Z listener
├── components/
│   ├── ReportList.tsx         # Dashboard — create/delete/export reports
│   ├── ReportEditor.tsx       # Edit/preview toggle, section management
│   ├── TableEditor.tsx        # Column groups, cells, colors, row management
│   ├── NoteEditor.tsx         # Rich text note sections
│   ├── RichTextEditor.tsx     # contentEditable editor with toolbar
│   ├── PasteTableImport.tsx   # Paste & JSON table import panel
│   ├── HtmlPreview.tsx        # Live iframe preview (desktop/phone widths)
│   ├── ReportSettingsPanel.tsx# Author, date, overall status, theme, issue links
│   └── ConfirmDialog.tsx      # Custom modal confirmation dialog
├── data/
│   └── sampleReport.ts        # Sample weekly QA report
├── store/
│   └── reportStore.ts         # Zustand store, CRUD, undo, localStorage
├── types/
│   └── report.ts              # TypeScript interfaces
└── utils/
    ├── htmlGenerator.ts       # Self-contained HTML export generator
    ├── statusColors.ts        # Status classification & colours
    ├── reportStats.ts         # Status counts for dashboards
    ├── richText.ts            # Sanitising, escaping, issue-key linking
    └── exportImport.ts        # File download/upload utilities
```

## JSON Import Format

For complex tables (multi-level headers, split rows), use the JSON tab in the import panel:

```json
{
  "columnGroups": [
    { "label": "Test", "columns": ["Suite", "Sub-test"] },
    { "label": "Round 1", "columns": ["OS", {"label": "Status", "type": "status"}] }
  ],
  "rows": [
    ["Memory Monitoring", "PrintHPx", "Windows", "Pass"],
    ["", "Scan", "NA", ""],
    { "cells": ["", "Copy", "NA", "Fail by DUNE-311995"], "details": "<p>Duplicate of DUNE-311046</p>", "mode": "modal" }
  ],
  "mergeColumns": 2
}
```

- `columns` entries can be plain strings (defaults to text type) or objects with `label` and `type`
- Rows can be arrays of values, or objects with `cells`, optional `details` (HTML) and `mode` (`accordion` | `modal`); a cell can also be `{ "content", "details", "bgColor" }`
- `mergeColumns: N` merges blank cells in the first N columns into the cell above (rowspan), so empty first cells "belong" to the row above
