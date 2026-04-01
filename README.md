# Presentation

`presentation` is a personal presentation workspace. It accumulates raw source material, normalizes it into a stable content model, and builds reviewable `deck.md` files plus static HTML decks for reports.

V1 scope is intentionally narrow:

- Import `markdown`, `pdf`, and public `github` repositories.
- Normalize sources into JSON documents under `content/normalized/`.
- Author each report through `decks/<deck-id>/brief.md` and `decks/<deck-id>/outline.md`.
- Generate a reviewable `decks/<deck-id>/deck.md`.
- Render a static HTML deck to `decks/<deck-id>/dist/index.html`.

## Quick Start

```bash
npm install
npm run cli -- list-themes
npm run cli -- import-md README.md
npm run cli -- new-deck project-overview --title "Presentation Project Overview"
npm run cli -- list-sources
```

Edit `decks/project-overview/brief.md` to point to the imported source ids, then build:

```bash
npm run cli -- build project-overview
```

If you only want to re-render HTML from an existing `deck.md`:

```bash
npm run cli -- render-html project-overview
```

## Commands

```bash
npm run cli -- import-md <file>
npm run cli -- import-pdf <file>
npm run cli -- import-github <repo-url>
npm run cli -- list-sources
npm run cli -- new-deck <deck-id> [--title "..."] [--theme report-clay]
npm run cli -- build <deck-id> [--theme report-moss]
npm run cli -- render-html <deck-id> [--theme report-moss]
```

## Repository Shape

```text
apps/cli/                 Command-line entry point
packages/domain/          Shared types for sources, documents, decks, and themes
packages/pipeline/        Importers, brief/outline handling, and deck assembly
packages/renderer-html/   Static HTML renderer
presets/themes/           Theme definitions
content/                  Long-lived source and normalized content library
decks/                    One workspace per report deck
AGENTS.md                 Project contract for future AI work
```

## Notes

- `docx` and `pptx` are out of scope for v1.
- GitHub import currently snapshots repository metadata and README for public repositories.
- PDF import is text-first. It does not preserve page layout or figures yet.
- `deck.md` is the review artifact. The built-in HTML renderer reads the same deck structure, and future skill-based renderers should consume the same file.
