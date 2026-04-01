# tiangong-ai-decks

`tiangong-ai-decks` is a reusable workspace for turning source material into reviewable deck drafts and externally rendered HTML reports.

The core repository is intentionally narrow:

- Keep archive and normalized-content contracts stable.
- Author each report through `decks/<deck-id>/brief.md` and `decks/<deck-id>/outline.md`.
- Generate a reviewable `decks/<deck-id>/deck.md`.
- Hand `deck.md` to an explicit rendering skill to produce HTML outside the core build pipeline.

Source-specific preprocessing and archival are intentionally externalized to skills or agent workflows. Common inputs on this machine include `markdown`, `pdf`, `xlsx`, `docx`, `pptx`, and public `github` repositories.

## Quick Start

```bash
npm install
npm run cli -- new-deck project-overview --title "Tiangong AI Decks Overview"
```

Then:

1. Place local source files into `content/inbox/`, or provide remote sources such as public GitHub repository URLs.
2. Use the appropriate preprocessing skill to archive originals into `content/sources/` and write normalized documents into `content/normalized/`.
3. Review what is available:

```bash
npm run cli -- list-sources --verbose
```

4. Edit `decks/project-overview/brief.md` to point to the imported source ids.
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
packages/domain/          Shared types for sources, documents, and decks
packages/pipeline/        Source listing, brief/outline handling, and deck assembly
content/                  Long-lived source and normalized content library
decks/                    One workspace per report deck
AGENTS.md                 Project contract for future AI work
```

## Archive Contract

- Local files should enter through `content/inbox/`, then be archived and normalized by the appropriate preprocessing skill.
- Archived sources live under `content/sources/<kind>/<year>/<archive-key>/`.
- `archive-key` is fixed as `<effective-date>--<kind>--<title-slug>--<import-stamp>`.
- `meta.json` preserves the archive key parts, date/title provenance, checksum, and retrieval hints such as `summary`, `keywords`, `titleAliases`, and `contentType`.
- Common `kind` values include `markdown`, `pdf`, `docx`, `pptx`, `xlsx`, and `github`, but the contract is open to additional skill-defined kinds.

## Skill-First Intake

- Use `pdf` for PDF extraction, OCR, and text cleanup.
- Use `xlsx` for spreadsheets and numeric appendices.
- Use `docx` for Word documents.
- Use `pptx` for existing slide decks you want to mine or archive.
- For source types without a dedicated skill on this machine, the agent should still archive and normalize them into the same contract.

## Notes

- User data under `content/` and `decks/` is intentionally ignored by Git by default. The repository tracks only scaffolding files such as `README.md` and `.gitkeep`.
- The repository intentionally does not ship file-type-specific import commands. Archival and normalization are handled by skills.
- `theme` in `brief.md` is only a freeform render hint for external skills. The repository does not ship a built-in HTML renderer or internal theme engine.
- Public GitHub repositories can still be archived as sources when the agent or a skill writes them into the same archive and normalized contracts.
- PDF-oriented preprocessing is text-first by default. It does not need to preserve page layout unless the task depends on layout.
- `deck.md` is the review artifact and the handoff input for rendering skills.
