# Report Generation

A React + TypeScript web application for creating interactive, self-contained HTML reports with configurable tables, rich text editing, and one-click export.

## Why This Exists

Quality reporting often boils down to sending tables — simple pass/fail grids that summarize test results. But reviewers frequently need *more context* behind a cell: why did something fail? What's the defect ID? What changed since last round?

Traditional table formats force a choice: keep it simple (and lose detail) or add detail (and drown the reader). HTML solves this by letting tables stay clean on the surface while hiding expandable details beneath each cell or row — available on click, invisible otherwise.

This app was built to make that workflow effortless: define your table structure, fill in results, attach details where needed, and export a single self-contained HTML file that anyone can open in a browser — no installs, no dependencies, no accounts. Simple outlook, rich information underneath.

## Features

### Table Editor
- **Column Groups & Sub-columns** — Two-level header structure (e.g., "Round 1" → "Greenfield" / "Sunspear")
- **Column Types** — `text` (rich HTML) or `status` (auto-colored Pass/Fail/In Progress/Blocked/N/A)
- **Cell-level Coloring** — Manual background color per cell via palette picker
- **Per-cell Expandable Details** — Attach hidden detail notes to individual cells, revealed on expand
- **Row-level Details** — Accordion or modal expand for row-wide notes
- **Split/Merged Rows** — Supports complex structures where test suite names span multiple rows

### Rich Text Editing
- Bold, Italic, Underline, Strikethrough, Superscript, Subscript
- Hyperlink insertion (Ctrl+K)
- HTML paste preservation (formatting from Word/web pages retained)

### Import
- **Paste Table** — Paste from Excel, Word, OneNote, or web pages; auto-detects structure and colors
- **JSON Import** — Define complex multi-level table structures via JSON for advanced layouts (split rows, nested groups, typed columns)

### Export
- **Self-contained HTML** — Single `.html` file with inline CSS + vanilla JS, no external dependencies; includes accordion/modal expand, noscript fallback, print styles
- **JSON** — Full report data for backup/transfer between instances

### Other
- **Undo** (Ctrl+Z) — 50-level undo history across all operations
- **Auto-save** — localStorage persistence with automatic schema migration
- **Note Sections** — Free-form rich text sections alongside tables
- **Live Preview** — Iframe preview of the generated HTML while editing

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
│   ├── HtmlPreview.tsx        # Live iframe preview
│   └── ConfirmDialog.tsx      # Custom modal confirmation dialog
├── store/
│   └── reportStore.ts         # Zustand store, CRUD, undo, localStorage
├── types/
│   └── report.ts              # TypeScript interfaces
└── utils/
    ├── htmlGenerator.ts       # Self-contained HTML export generator
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
    ["", "Scan", "NA", ""]
  ]
}
```

- `columns` entries can be plain strings (defaults to text type) or objects with `label` and `type`
- Empty first cells in rows create visual row-spanning (the value "belongs" to the row above)
