# Content Library

`content/` stores long-lived source material and normalized JSON artifacts.

- `inbox/`: disposable drop zone for raw files before archival. Ignored by Git except for `.gitkeep`.
- `inbox/` should be processed by the appropriate preprocessing skill or agent workflow. Successful local imports should be cleared from inbox afterward.
- `sources/`: immutable imported snapshots grouped by kind and year. Each source lives under `content/sources/<kind>/<year>/<archive-key>/`.
- For `pptx` archives, extracted slide media should live beside the original file under `content/sources/pptx/<year>/<archive-key>/media/` with a companion `index.json`.
- `normalized/`: machine-readable `NormalizedDocument` JSON files generated from imported sources.
- `library/`: future derived facts, quotes, tables, cross-source visuals, generated visuals, and code insights.
- `indexes/`: search and retrieval indexes. Safe to rebuild.
- User files under these working directories are intentionally gitignored by default. Only scaffolding files such as `.gitkeep` and this README should be versioned.
- The repository does not parse raw source files itself. Skills, workers, and agent workflows should write into this structure.

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

Common source kinds:

- `markdown`
- `pdf`
- `docx`
- `pptx`
- `xlsx`
- `github`

Additional skill-defined kinds are acceptable as long as they follow the same contract.

PPTX normalization rules:

- Keep the imported `.pptx` file untouched inside its archive directory.
- Extract embedded slide media into `content/sources/pptx/<year>/<archive-key>/media/`.
- Write `content/sources/pptx/<year>/<archive-key>/media/index.json` with per-slide media references and repository-relative paths.
- Mirror the PPTX media summary into `content/normalized/<source-id>.json` under `media`.
- For each normalized slide section, include `mediaRefs` with image path, slide relation id, geometry, area, and `primary` or `supporting` role.
- If a section has one or more `primary` images, append a `对应图片路径：` block to the end of that section's `content`.
