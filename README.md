# tiangong-ai-decks

`tiangong-ai-decks` is a reusable workspace for turning source material into reviewable deck JSON artifacts and externally rendered HTML reports.

The core repository is intentionally narrow:

- Keep archive and normalized-content contracts stable.
- Author each report through `decks/<deck-id>/brief.json` and `decks/<deck-id>/outline.json`.
- Generate a reviewable `decks/<deck-id>/deck.json`.
- Generate a clean `decks/<deck-id>/deck.public.json` for renderer handoff.
- Generate `decks/<deck-id>/render.handoff.json` so external renderers know to use `deck.public.json` by default.
- Carry multi-agent orchestration hints inside `brief.json` and `render.handoff.json` so external coordinators can parallelize source review, outlining, editing, and rendering.
- Hand `deck.public.json` to an explicit rendering skill to produce HTML outside the core build pipeline.

Source-specific preprocessing and archival are intentionally externalized to skills or agent workflows. Common inputs on this machine include `markdown`, `pdf`, `xlsx`, `docx`, `pptx`, and public `github` repositories.

## Quick Start

```bash
npm install
npm run cli -- new-deck project-overview --title "Tiangong AI Decks Overview"
```

Then:

1. Place local source files into `content/inbox/`, or provide remote sources such as public GitHub repository URLs.
2. Use the appropriate preprocessing skill or worker to archive originals into `content/sources/` and write normalized JSON documents into `content/normalized/`.
3. Review what is available:

```bash
npm run cli -- list-sources --verbose
```

4. Edit `decks/project-overview/brief.json` to point to the imported source ids.
5. Build the deck:

```bash
npm run cli -- build project-overview
```

## Commands

```bash
npm run cli -- list-sources [--verbose]
npm run cli -- new-deck <deck-id> [--title "..."] [--theme editorial-light]
npm run cli -- build <deck-id> [--theme editorial-light]
```

## Repository Shape

```text
apps/cli/                 Command-line entry point
packages/domain/          Shared JSON-first types for sources, documents, decks, and orchestration
packages/pipeline/        Source listing, brief/outline handling, and deck assembly
content/                  Long-lived source and normalized content library
decks/                    One workspace per report deck
AGENTS.md                 Project contract for future AI work
```

## Archive Contract

- Local files should enter through `content/inbox/`, then be archived and normalized by the appropriate preprocessing skill or worker.
- Archived sources live under `content/sources/<kind>/<year>/<archive-key>/`.
- PPTX archives should also include extracted slide media under `content/sources/pptx/<year>/<archive-key>/media/` with a companion `index.json`.
- `archive-key` is fixed as `<effective-date>--<kind>--<title-slug>--<import-stamp>`.
- `meta.json` preserves the archive key parts, date/title provenance, checksum, and retrieval hints such as `summary`, `keywords`, `titleAliases`, and `contentType`.
- Normalized documents live at `content/normalized/<source-id>.json` and must match the shared `NormalizedDocument` contract.
- Common `kind` values include `markdown`, `pdf`, `docx`, `pptx`, `xlsx`, and `github`, but the contract is open to additional skill-defined kinds.

## Skill-First Intake

- Use `pdf` for PDF extraction, OCR, and text cleanup.
- Use `xlsx` for spreadsheets and numeric appendices.
- Use `docx` for Word documents.
- Use `pptx` for existing slide decks you want to mine or archive.
- PPTX workflows should extract source-adjacent slide media, populate normalized `media` and section-level `mediaRefs`, and append `对应图片路径：` blocks for sections with primary images.
- For source types without a dedicated skill on this machine, the agent should still archive and normalize them into the same JSON contract.

## Notes

- User data under `content/` and `decks/` is intentionally ignored by Git by default. The repository tracks only scaffolding files such as `README.md` and `.gitkeep`.
- The repository intentionally does not ship file-type-specific import commands. Archival and normalization are handled by skills, workers, or agent workflows.
- `theme` in `brief.json` is only a freeform render hint for external skills. The repository does not ship a built-in HTML renderer or internal theme engine.
- Public GitHub repositories can still be archived as sources when the agent or a worker writes them into the same archive and normalized contracts.
- PDF-oriented preprocessing is text-first by default. It does not need to preserve page layout unless the task depends on layout.
- `deck.json` is the review artifact.
- `deck.public.json` is the clean renderer handoff artifact derived from `deck.json` without review-only notes.
- `render.handoff.json` is the machine-readable renderer contract. External HTML renderers, skills, and multi-agent coordinators should read it first and default to `deck.public.json`.

## Renderer QA

- Playwright verification is a hard requirement for rendered HTML output.
- Before sign-off, open the rendered HTML in Playwright and review at least one representative desktop viewport and one representative mobile viewport unless the deck brief defines different targets.
- If the page uses persistent floating UI such as a sticky table of contents or floating side panel, also verify an ultra-wide viewport such as `3840x2160`.
- Treat fixed-header or fixed-nav overlap, clipped content, unreadable overflow, and obvious JSON-dump rendering as blocking issues.
