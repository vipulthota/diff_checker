# DiffSpace

**Compare. Find Differences. Fix Faster.**

DiffSpace is a free, public, privacy-first comparison tool for **text, code, documents, images and spreadsheets**.
It is a pure front-end app: everything runs in the visitor's browser. There is no backend, no database, no login,
no analytics and no file storage — the host only serves static files.

> Your files are processed locally in your browser whenever possible. We do not permanently store your files or comparison data.

---

## Contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Project structure](#project-structure)
4. [Free deployment](#free-deployment) (GitHub Pages · Cloudflare Pages · Netlify · Vercel)
5. [Custom domain](#custom-domain)
6. [Privacy and security design](#privacy-and-security-design)
7. [Feature checklist](#feature-checklist)
8. [Known limitations](#known-limitations)

## Features

| Mode | What it does |
| --- | --- |
| **Text** | Line / word / character / smart diffs, side-by-side and unified views, ignore options, search, difference navigation, hide unchanged, per-difference merging with an editable merged result, unified-diff export. |
| **Code** | Everything in Text plus syntax highlighting for 20 languages, language auto-detection from file extension, horizontal scrolling, wrap toggle. Code is only ever _displayed as text_. |
| **Documents** | TXT, Markdown, PDF (PDF.js) and DOCX (Mammoth) are converted to text and compared. PDFs get page markers and a page navigator. |
| **Images** | PNG / JPG / WEBP / GIF with side-by-side, overlay, fade, slider, pixel-difference and flicker modes, zoom / pan / fit / actual size, difference image download. |
| **Spreadsheets** | CSV / TSV / XLSX / XLS (SheetJS). Added / removed / modified rows, added / removed columns, modified cells, worksheet selection, filters, search, CSV/XLSX export. |

## Quick start

Requirements: **Node.js 20 or newer** (22 recommended).

```bash
npm install        # install dependencies
npm run dev        # start the dev server at http://localhost:5173
npm run build      # type-check + production build into ./dist
npm run preview    # serve the production build locally
```

Other scripts:

```bash
npm test           # unit tests for the comparison engines (Vitest)
npm run lint       # ESLint
npm run typecheck  # TypeScript (strict mode)
npm run format     # Prettier
```

No `.env` file, API key or server is needed — ever.

## Project structure

```
src/
├── components/
│   ├── ui/              Button, Dialog, Menu, Controls (checkbox, segmented, select, notices)
│   ├── layout/          Header, Footer, Dialogs (settings + shortcuts), ErrorBoundary
│   ├── editors/         TextInputPane (textarea + line numbers + drop zone)
│   ├── diff-viewer/     DiffViewer (virtualized split/unified), renderLine (safe highlighting)
│   └── file-dropzone/   Dropzone overlay + FilePicker
├── features/
│   ├── text-diff/       TextDiffEngine, merge, displayModel, TextWorkspace (shared by Text/Code/Documents)
│   ├── code-diff/       (code mode = TextWorkspace + lib/prism syntax highlighting)
│   ├── document-diff/   DocumentDiffEngine (PDF.js + Mammoth extraction)
│   ├── image-diff/      ImageDiffEngine (pure pixel diff) + ImageCompare UI
│   └── spreadsheet-diff/ SpreadsheetDiffEngine, parseSheet (SheetJS) + SpreadsheetCompare UI
├── workers/             diff.worker.ts — runs heavy diffs off the main thread
├── hooks/               useTextDiff, useSheetDiff, useHotkeys, useHashRoute, useDebouncedValue
├── lib/                 files (limits + validation), prism, languages, prefs, workerClient, exportPdf
├── utils/ types/ pages/ styles/
├── App.tsx
└── main.tsx
```

The comparison engines (`*DiffEngine.ts`) are plain TypeScript with no React in them, so they are reusable and unit-tested.

## Free deployment

DiffSpace builds to plain static files in `dist/`. Nothing else is needed on the host. The app uses hash URLs
(`/#/text`, `/#/images`, …) and relative asset paths, so it works on any host, in any sub-folder, with **no rewrite rules**.

**Build command:** `npm run build` **Output directory:** `dist`

First, put the code in a Git repository (needed for all three options below):

```bash
git init
git add .
git commit -m "DiffSpace"
```

Create an empty repository on GitHub (github.com → **New repository**), then:

```bash
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

### Option 1 — GitHub Pages (free)

1. **Create repository** and **push** the project as shown above (branch `main`).
2. In the repository open **Settings → Pages**. Under **Build and deployment → Source** choose **GitHub Actions**.
3. The included workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs `npm ci`, `npm test`,
   `npm run build` (output `dist`) and deploys automatically on every push to `main`.
4. Open the **Actions** tab, wait for the green check. Your site is live at
   `https://<your-user>.github.io/<your-repo>/`.
5. **Custom domain later:** Settings → Pages → **Custom domain** (see [Custom domain](#custom-domain)).

### Option 2 — Cloudflare Pages (free)

1. **Create repository** and **push** the project (see above).
2. Go to the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** and pick the repository.
3. Settings: **Framework preset** `None` · **Build command** `npm run build` · **Build output directory** `dist`
   · environment variable `NODE_VERSION` = `22` (optional).
4. Click **Save and Deploy**. You get `https://<project>.pages.dev`.
5. **Custom domain later:** project → **Custom domains → Set up a custom domain**.

### Option 3 — Netlify (free)

1. **Create repository** and **push** the project (see above).
2. In Netlify: **Add new site → Import an existing project** → choose the repository.
3. Build settings are read from [`netlify.toml`](netlify.toml): **Build command** `npm run build`, **Publish directory** `dist`.
4. Click **Deploy**. You get `https://<name>.netlify.app`.
5. **Custom domain later:** Site configuration → **Domain management → Add a domain**.

_No Git?_ Netlify and Cloudflare Pages also let you run `npm run build` locally and drag-and-drop the `dist` folder.

### Option 4 — Vercel (free, static)

Import the repository at vercel.com/new. [`vercel.json`](vercel.json) already sets build command `npm run build`
and output directory `dist`.

## Custom domain

The app has no hard-coded domain or localhost URL, so any domain works (for example `mydifftool.com`).

1. Buy a domain from any registrar.
2. Add it in your host's dashboard (see the "Custom domain later" step of each option above).
3. The host shows you DNS records. At your registrar create them:
   - **Apex / root domain** (`mydifftool.com`): an `A` record (or `ALIAS`/`ANAME`) to the value the host gives you.
   - **`www` subdomain**: a `CNAME` record to your `…github.io`, `…pages.dev` or `…netlify.app` address.
4. Wait for DNS to propagate (minutes to a few hours). HTTPS certificates are issued automatically and are free.
5. GitHub Pages only: a `CNAME` file is created for you when you set the domain in Settings → Pages.

## Privacy and security design

- **Local processing.** Files are read with the browser `File` APIs and compared in the page (or a Web Worker).
  Nothing is sent anywhere. There is no server code in this project.
- **No storage of content.** Comparison content is only held in memory; closing or clearing the tab discards it.
  `localStorage` is used for exactly two harmless keys: `diffspace:theme` and `diffspace:prefs`
  (font size, default wrap, default comparison style).
- **Strict Content-Security-Policy** (injected into the production `index.html`): no inline scripts, no third-party
  scripts, and `connect-src 'self'` — the page is not even allowed to make requests to other sites.
- **No analytics, cookies or trackers.** Fonts are system fonts, so no third-party font requests either.
- **Untrusted input.** Uploaded content is always rendered as React text nodes (never `innerHTML`). Syntax
  highlighting only tokenizes text. HTML/SVG uploads are shown as source code; SVG is not accepted as an image.
  DOCX output from Mammoth is parsed with `DOMParser` (inert) and reduced to text. PDFs are only text-extracted.
  Spreadsheet formulas are never evaluated.
- **Size limits** (see `src/lib/files.ts`): text 25 MB (warning at 1 MB), documents 60 MB, spreadsheets 40 MB,
  images 40 MB / 100 megapixels. Larger files get a clear message instead of freezing the tab.

## Feature checklist

- [x] Landing page, header navigation (Text · Code · Documents · Images · Spreadsheets), no login/pricing/account UI
- [x] Light / dark / system theme (only the preference is saved)
- [x] Responsive: side-by-side on desktop, stacked inputs and unified default on mobile
- [x] Text: paste / type / upload / drag & drop, copy, clear (with undo), swap, paste from clipboard
- [x] Line, word, character and smart comparison; added / removed / modified / unchanged highlighting with `+` `−` `~` markers
- [x] Line numbers, side-by-side & unified views, synchronized scrolling, line wrap
- [x] Hide / show unchanged lines (expandable folds), first / previous / next / last difference
- [x] Statistics (differences, added, removed, modified, unchanged), live-updating
- [x] Ignore whitespace / blank lines / case / punctuation / line endings / leading-trailing spaces
- [x] Merge: accept left / right per difference, accept all left / right, reset, undo / redo, editable merged result, copy / download
- [x] Search with match count, previous / next, highlighting, `Ctrl/Cmd + F`
- [x] Code: 20 languages, extension detection, manual selection, horizontal scroll, copy / download
- [x] Documents: TXT, MD, PDF (pages + page navigator), DOCX (headings, paragraphs, lists, tables)
- [x] Images: 6 compare modes, zoom / pan / fit / actual size, opacity, difference intensity & tolerance, dimensions / format / size, difference PNG download
- [x] Spreadsheets: CSV / TSV / XLSX / XLS, worksheet selection, header-aware column alignment, row / column / cell highlighting, hide unchanged, filters, search, ignore whitespace / case, CSV & XLSX export
- [x] Exports: unified diff (copy / `.diff`), merged text, PDF report (jsPDF), difference image, spreadsheet result
- [x] Web Worker for large diffs, debouncing, virtualized rendering (tested with 120,000-line files)
- [x] Friendly errors for empty / unsupported / corrupted / too-large files; error boundary; no stack traces shown
- [x] Keyboard shortcuts + help panel (`Ctrl/Cmd + /`), focus-visible states, ARIA labels, accessible dialogs, non-colour indicators; axe-core reports no violations on the main views
- [x] TypeScript strict, ESLint, Prettier, unit tests for all engines, static-host ready (GitHub Pages / Cloudflare / Netlify / Vercel)

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Enter` | Run comparison |
| `Ctrl/Cmd + F` | Search (while focus is inside the comparison) |
| `Alt + ↓` / `Alt + ↑` | Next / previous difference |
| `Esc` | Close dialog or search |
| `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` | Undo / redo (typing, or merge choices) |
| `Ctrl/Cmd + /` | Show the shortcut panel |

## Known limitations

- **Documents are compared by text only.** Fonts, colours, images, headers/footers and page layout are not compared
  (the UI says so). Scanned PDFs without a text layer have nothing to extract (no OCR). Password-protected PDFs and
  legacy `.doc` files are not supported. PDF text order follows the PDF's internal order, which can differ from the visual order.
- **Word / character granularity is applied inside lines.** Lines are aligned first, then changed lines are
  highlighted word-by-word or character-by-character. Moved blocks of text appear as a deletion plus an addition.
- **Images:** animated GIFs animate in the viewer, but the pixel difference uses the first frame. SVG is intentionally
  not supported. Differently-sized images are aligned at the top-left corner.
- **PDF export** uses the standard PDF fonts, so characters outside Latin-1 appear as `?` (use the `.diff` download for full fidelity).
- **Spreadsheets:** only cell values (as displayed) are compared — not formulas, styles or merged cells. Rows are
  matched by content, not by a key column.
- **Very large files.** Text over 25 MB and spreadsheets over 40 MB are refused. Text boxes with multi-megabyte
  content may feel slow because that is a browser limitation; soft-wrapping is turned off automatically for them.
- Pasting from the clipboard button needs the browser's clipboard permission; `Ctrl/Cmd + V` always works.
- Search is a literal text search (no regular expressions).
#   d i f f _ c h e c k e r  
 