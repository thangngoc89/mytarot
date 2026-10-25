# AGENTS.md

This document outlines the architecture, directory structure, and deployment rules for AI agents working on the **MyTarot ("Tron cottage by the Amber stream — Metallic Winter")** repository.

---

## 1. Project Overview & Architecture

- **Application Type**: 100% Client-Side Single Page Application (SPA).
- **Runtime Dependencies**: **Zero backend / Zero LLM server**. All reading logic, deck partitioning, shuffle algorithms, card orientation, and interpretation synthesis run directly in the browser via vanilla JavaScript.
- **Tooling Stack**: **Python 3** (Standard Library for build/deploy scripts) and Vanilla JS / Tailwind CSS (via CDN) / HTML5.
  > **IMPORTANT FOR AGENTS**: Do NOT introduce Node.js, npm, or complex JS bundling frameworks (Webpack/Vite/Rollup). Keep the repository lightweight using standard Python scripts.

---

## 2. Directory Layout

| Directory / File | Description |
| :--- | :--- |
| `static/` | **Source of truth** for all frontend assets (`index.html`, `css/`, `js/`, `data/`, `images/`). **Always edit files here.** |
| `docs/` | **Production build output** deployed to GitHub Pages. Generated automatically by `scripts/build.py`. **Do not edit directly.** |
| `scripts/` | Python utilities for offline deck processing, dataset extraction, building, and deploying. |
| `deploy.py` | Convenience root script to build, stage, commit, and push `docs/` to GitHub Pages. |
| `main.py` | Minimal local static server using FastAPI/Uvicorn for local preview (`python main.py`). |
| `.nojekyll` & `docs/.nojekyll` | Ensures GitHub Pages serves all assets directly without Jekyll filtering. |

---

## 3. Build & Deployment Rules

### Rule 1: Always modify `static/`, never `docs/`
- All frontend changes (HTML, CSS, JavaScript in `app.js`, card images, datasets) must be made in `static/`.
- `docs/` is the compiled output for GitHub Pages. Any manual changes made inside `docs/` will be overwritten on the next build.

### Rule 2: Single-Command Deployment
Whenever you need to build and deploy to GitHub Pages:
```bash
python deploy.py
# or:
python scripts/deploy.py
```
This script will:
1. Copy all assets from `static/` to `docs/`.
2. Ensure `docs/.nojekyll` is present.
3. Stage `docs/` and deployment scripts in git.
4. Create a timestamped commit if there are changes.
5. Push to the active remote branch (`origin/master`).

### Rule 3: Build Only (without Git Commit / Push)
To inspect or verify the build output in `docs/` locally without committing:
```bash
python scripts/build.py
```

---

## 4. GitHub Pages Settings

The repository is configured to serve from the `docs/` folder:
- **Settings** → **Pages**
- **Source**: `Deploy from a branch`
- **Branch**: `master`
- **Folder**: `/docs`
- **Public URL**: `https://thangngoc89.github.io/mytarot/`
