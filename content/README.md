# Content Library

`content/` stores long-lived source material and normalized artifacts.

- `inbox/`: disposable drop zone for raw files before import. Ignored by Git except for `.gitkeep`.
- `inbox/` should be emptied by `import-inbox` after successful archival. Failed or unsupported files remain for manual handling.
- `sources/`: immutable imported snapshots grouped by kind and year. Each source lives under `content/sources/<kind>/<year>/<archive-key>/`.
- `normalized/`: machine-readable documents generated from imported sources.
- `library/`: future derived facts, quotes, tables, visuals, and code insights.
- `indexes/`: search and retrieval indexes. Safe to rebuild.

Archive key format:

- `<effective-date>--<kind>--<title-slug>--<import-stamp>`
- `effective-date` prefers substantive source date over import time
- `import-stamp` uses `YYYYMMDD-HHMMSS`

Archive metadata contract in `meta.json`:

- `schemaVersion`: current imported-source schema version
- `archive.schemeVersion`: current archive naming scheme version
- `archive.effectiveDate` plus `archive.effectiveDateSource`
- `archive.titleSlug` plus `archive.titleSource`
- `selectionHints.summary`
- `selectionHints.keywords`
- `selectionHints.titleAliases`
- `selectionHints.contentType`
