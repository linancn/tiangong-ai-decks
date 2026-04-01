# AGENTS

This repository is a reusable system for building reviewable Markdown decks from accumulated source material. The project is not a generic slide editor. It is a source-driven report engine.

## Mission

- Continuously collect raw material in this repo: markdown notes, PDFs, spreadsheets, Word documents, slide decks, public GitHub repositories, and related research assets.
- Normalize those materials into a stable machine-readable content library.
- Build a reviewable `deck.md` from a brief plus an outline, not by hand-editing finished HTML.
- Hand the finished `deck.md` to an explicit rendering skill when HTML is needed.

## Current Scope

The core repository is responsible for:

- stable archive and normalized-content contracts
- reviewable deck authoring through `brief.md`, `outline.md`, and `deck.md`
- CLI browsing and deck assembly from normalized sources
- explicit handoff to rendering skills for final HTML

Common source types on this machine that can be archived through skills or agent workflows:

- `markdown`
- `pdf`
- `xlsx`
- `docx`
- `pptx`
- public `github` repository snapshots

Still out of scope for the core repository:

- direct WYSIWYG slide editing
- a browser-based studio UI
- fully automated citation extraction from arbitrary page coordinates

Source-format coverage should expand through skills and contract-preserving workflows, not by adding new file-type-specific core importers unless there is a clear long-term payoff.

## Architectural Principles

1. Raw sources are immutable once imported.
2. Normalized content is the contract between skill-driven archival and deck generation.
3. `brief.md` and `outline.md` are the primary authoring surfaces.
4. `deck.md` is the canonical review artifact for a deck. HTML is an external render target, not the source of truth.
5. Prefer deterministic transforms over opaque magic. If AI is added later, it should generate or revise briefs, outlines, or `deck.md`, not dump final HTML directly.
6. Optimize for short iteration loops. CLI-first is preferred until there is sustained evidence that a studio UI is needed.

## Repository Contract

### `content/`

- `content/inbox/`: temporary drop zone for new files before archival. This directory is intentionally not versioned except for the `.gitkeep` placeholder.
- `content/sources/<kind>/<year>/<archive-key>/`: immutable imported snapshot plus `meta.json`.
- `content/normalized/<source-id>.json`: normalized document used by the builder.
- `content/library/`: future derived artifacts such as facts, quotes, tables, code insights, and visuals.
- `content/indexes/`: rebuildable search or retrieval indexes.
- User data under `content/` should remain local by default. Keep only scaffolding files such as `.gitkeep` and documentation in Git.

### `decks/<deck-id>/`

- `brief.md`: frontmatter defines `title`, `subtitle`, `objective`, `audience`, `durationMinutes`, `theme`, and `sources`.
- `outline.md`: human-editable outline. Each `##` heading becomes a content slide section.
- `outline.generated.md`: last machine-generated outline snapshot.
- `deck.md`: generated slide draft and canonical review artifact.
- `sources.lock.json`: source lock used to trace the deck back to archived materials.
- `assets/`: deck-specific local assets when needed later.
- Deck workspaces are user data and should remain gitignored by default, except for repository scaffolding such as `decks/README.md` and `decks/.gitkeep`.

## Authoring Rules

### Source Intake And Archival

- Always archive and normalize a source before relying on it for a deck.
- New or updated files should be dropped into `content/inbox/` first, not copied directly into `content/sources/`.
- `content/inbox/` is transient staging only. A preprocessing skill or explicit agent workflow should remove successfully archived files from inbox.
- Intake and preprocessing are skill-first. The repository does not ship file-type-specific import commands.
- Archive each imported source under `content/sources/<kind>/<year>/<archive-key>/`.
- The `archive-key` format is fixed: `<effective-date>--<kind>--<title-slug>--<import-stamp>`.
- `effective-date` must prefer substantive source date over import time. Resolution order is: content/frontmatter date, then source metadata date, then filename date, then import date fallback.
- `title` must prefer substantive content title over raw filename. Resolution order is: explicit source title, then first heading when available, then filename or repository name.
- `title-slug` must come from the substantive title or repository name, not only from the raw filename when a better title is available.
- `import-stamp` must use the actual import timestamp in `YYYYMMDD-HHMMSS` form so repeat imports stay unique.
- `meta.json` must preserve the fixed archive contract:
- `schemaVersion` for the imported-source schema.
- `archive.schemeVersion` and `archive.archiveKeyPattern`.
- `archive.effectiveDate` plus `archive.effectiveDateSource`.
- `archive.titleSlug` plus `archive.titleSource`.
- `selectionHints.summary`.
- `selectionHints.keywords`.
- `selectionHints.titleAliases`.
- `selectionHints.contentType` from the controlled set: `notes`, `report`, `research`, `spec`, `documentation`, `repository`, `reference`.
- Preserve the imported original in `content/sources/`.
- Never overwrite or mutate an imported source snapshot in place.
- Skills should write `kind` values that match the actual source type, such as `markdown`, `pdf`, `docx`, `pptx`, `xlsx`, or `github`.
- Remote GitHub repositories are the normal exception to the local-inbox rule. They may be archived directly by URL and should still end up in the same archive structure.
- PDF-oriented preprocessing should favor extracted text, OCR, and summaries over layout fidelity unless the task explicitly depends on page layout.
- Spreadsheet-oriented preprocessing should preserve headers, sheet structure, and numeric meaning in normalized output.
- Document and slide preprocessing should preserve semantic structure, headings, and key textual content in normalized output.

### Deck Authoring

- `brief.md` defines the why, who, duration, freeform render hint, and intended sources.
- `outline.md` defines the story. Edit this before editing any rendering prompt or output.
- `deck.md` is the review layer between outline generation and HTML rendering.
- Use `<!-- sources: id-a, id-b -->` directly below each `##` heading in `outline.md` when a slide should lock to specific sources.
- If the outline is still scaffold-only, the builder may overwrite it with an auto-generated outline.
- Keep most decks between 6 and 10 slides unless the brief justifies more.
- In `deck.md`, reserve `##` for slide boundaries. Use `###` or deeper headings inside slide content.

### Rendering

- The repository does not render HTML directly.
- HTML should be produced only by an explicit rendering skill.
- `theme` in `brief.md` is only a freeform style hint string for rendering skills. It is not backed by an internal theme preset file.
- Rendering skills should consume `deck.md`, `sources.lock.json`, the brief's style hint, and archived source context rather than raw inbox files.
- Prefer strong typography, restrained motion, and clean evidence-first layouts.

## Recommended Skills

Use the globally installed skills on this machine as the default capability map for this repository.

### Preprocessing And Archival

- `pdf`: default skill for PDF extraction, OCR, text cleanup, and PDF-to-structured-content preparation.
- `xlsx`: use when source material includes spreadsheet tables or numeric appendices that should be folded into normalized content.
- `docx`: use when source material arrives as Word documents and should be archived into the same normalized-content contract.
- `pptx`: use when source material arrives as existing slide decks that should be mined, archived, and normalized before reuse.
- If no dedicated preprocessing skill exists for a source type, the agent must still follow the same archive and normalized-data contracts.

### Output And Rendering

- `frontend-design`: default skill for turning `deck.md` into polished HTML presentation pages.
- `web-artifacts-builder`: use when the output needs a more elaborate multi-component web artifact rather than a straightforward presentation page.
- `imagegen`: supporting skill for deck-specific visual assets such as covers, illustrations, textures, and backgrounds.
- `theme-factory`: use when the main need is to create or refine reusable presentation themes rather than changing deck content.
- `brand-guidelines`: use when output must conform to a defined brand system or visual identity.

## Design Direction

The project is for reports, not startup landing pages. Generated decks should feel:

- editorial
- asymmetric when helpful, but not chaotic
- concise
- evidence-first
- light-theme by default

Avoid:

- centered generic heroes on every slide
- placeholder copy
- lorem ipsum
- generic dashboard-card spam
- decorative animations that slow down iteration

## AI Contribution Rules

When an AI agent works in this repo, it should:

1. Start from the brief, outline, normalized documents, and source locks.
2. Prefer editing `brief.md`, `outline.md`, or `deck.md` over patching rendered HTML directly.
3. Preserve backward compatibility of normalized document fields unless a migration is deliberate and documented.
4. Keep commands and workflows reproducible from the repo root.
5. Avoid adding heavy dependencies without a clear payoff in generation quality or developer speed.
6. Treat citations and source ids as first-class. Content slides should keep a traceable link to imported sources.

## Suggested Workflow

1. Intake: place new or changed source files into `content/inbox/`.
2. Normalize and archive: choose the appropriate preprocessing skill, parse the inbox files or remote source, archive originals into `content/sources/`, write normalized outputs into `content/normalized/`, and clear successful local inbox items.
3. Compose: when asked for a report or HTML presentation, search the archived and normalized material, select relevant sources, and produce `brief.md`, `outline.md`, `sources.lock.json`, and a reviewable `deck.md`.
4. Render: turn `deck.md` into final HTML only through an explicit rendering skill such as `frontend-design`.

Operational notes:

- Do not build decks directly from files still sitting in `content/inbox/`.
- Prefer normalized content as the primary input for composition. Refer back to archived originals only when needed.
- `deck.md` is the handoff artifact between composition and rendering.
- Source naming and metadata are part of retrieval quality. Do not improvise archive keys or omit selection hints.
- `content/inbox/` should remain disposable and should not accumulate long-term material.

## Implementation Bias

If you extend this codebase, prefer this order:

1. Improve source normalization quality.
2. Improve outline generation quality.
3. Improve slide IR expressiveness.
4. Improve render handoff quality for external skills.
5. Add retrieval, search, or lightweight AI assistance.
6. Only then consider a studio UI.

Keep the project practical. Fast generation and maintainable structure matter more than supporting every source type.
