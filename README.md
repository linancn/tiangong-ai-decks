# Presentation

`presentation` is a personal presentation workspace. It accumulates raw source material, normalizes it into a stable content model, and builds reviewable `deck.md` files for reports.

V1 scope is intentionally narrow:

- Import `markdown`, `pdf`, and public `github` repositories.
- Normalize sources into JSON documents under `content/normalized/`.
- Author each report through `decks/<deck-id>/brief.md` and `decks/<deck-id>/outline.md`.
- Generate a reviewable `decks/<deck-id>/deck.md`.
- Hand `deck.md` to an explicit rendering skill to produce HTML outside the core build pipeline.

## Quick Start

```bash
npm install
cp README.md content/inbox/
npm run cli -- import-inbox
npm run cli -- new-deck project-overview --title "Presentation Project Overview"
npm run cli -- list-sources --verbose
```

Edit `decks/project-overview/brief.md` to point to the imported source ids, then build:

```bash
npm run cli -- build project-overview
```

## Commands

```bash
npm run cli -- import-inbox
npm run cli -- import-md <file>
npm run cli -- import-pdf <file>
npm run cli -- import-github <repo-url>
npm run cli -- list-sources [--verbose]
npm run cli -- new-deck <deck-id> [--title "..."] [--theme editorial-light]
npm run cli -- build <deck-id> [--theme editorial-light]
```

## Repository Shape

```text
apps/cli/                 Command-line entry point
packages/domain/          Shared types for sources, documents, and decks
packages/pipeline/        Importers, brief/outline handling, and deck assembly
content/                  Long-lived source and normalized content library
decks/                    One workspace per report deck
AGENTS.md                 Project contract for future AI work
```

## Archive Contract

- Local files should enter through `content/inbox/`, then be imported with `import-inbox`.
- Archived sources live under `content/sources/<kind>/<year>/<archive-key>/`.
- `archive-key` is fixed as `<effective-date>--<kind>--<title-slug>--<import-stamp>`.
- `meta.json` preserves the archive key parts, date/title provenance, checksum, and retrieval hints such as `summary`, `keywords`, `titleAliases`, and `contentType`.

## Notes

- `docx` and `pptx` are out of scope for v1.
- `theme` in `brief.md` is only a freeform render hint for external skills. The repository does not ship a built-in HTML renderer or internal theme engine.
- GitHub import currently snapshots repository metadata and README for public repositories.
- PDF import is text-first. It does not preserve page layout or figures yet.
- `deck.md` is the review artifact and the handoff input for rendering skills.
