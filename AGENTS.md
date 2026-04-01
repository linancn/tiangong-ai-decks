# AGENTS

This repository is a personal system for building reviewable Markdown decks and HTML presentation outputs from accumulated source material. The project is not a generic slide editor. It is a source-driven report engine.

## Mission

- Continuously collect raw material in this repo: markdown notes, PDFs, public GitHub repositories, and related research assets.
- Normalize those materials into a stable machine-readable content library.
- Build a reviewable `deck.md` from a brief plus an outline, not by hand-editing finished HTML.
- Emit a static HTML presentation from that deck artifact when needed.

## Current Scope

V1 supports only:

- `markdown`
- `pdf`
- public `github` repository snapshots

V1 explicitly does not support:

- `docx`
- `pptx`
- direct WYSIWYG slide editing
- a browser-based studio UI
- fully automated citation extraction from arbitrary page coordinates

Do not introduce `docx` or `pptx` support unless explicitly requested. Keep implementation pressure on generation quality, data contracts, and workflow speed.

## Architectural Principles

1. Raw sources are immutable once imported.
2. Normalized content is the contract between importers and deck generation.
3. `brief.md` and `outline.md` are the primary authoring surfaces.
4. `deck.md` is the canonical review artifact for a deck. HTML is a render target, not the source of truth.
5. Prefer deterministic transforms over opaque magic. If AI is added later, it should generate or revise briefs, outlines, or `deck.md`, not dump final HTML directly.
6. Optimize for short iteration loops. CLI-first is preferred until there is sustained evidence that a studio UI is needed.

## Repository Contract

### `content/`

- `content/inbox/`: temporary drop zone for new files before import.
- `content/sources/<kind>/<source-id>/`: immutable imported snapshot plus `meta.json`.
- `content/normalized/<source-id>.json`: normalized document used by the builder.
- `content/library/`: future derived artifacts such as facts, quotes, tables, code insights, and visuals.
- `content/indexes/`: rebuildable search or retrieval indexes.

### `decks/<deck-id>/`

- `brief.md`: frontmatter defines `title`, `subtitle`, `objective`, `audience`, `durationMinutes`, `theme`, and `sources`.
- `outline.md`: human-editable outline. Each `##` heading becomes a content slide section.
- `outline.generated.md`: last machine-generated outline snapshot.
- `deck.md`: generated slide draft and canonical review artifact.
- `dist/index.html`: final static HTML output.
- `assets/`: deck-specific local assets when needed later.

### `presets/themes/`

- JSON theme definitions only.
- Prefer report-oriented light themes.
- Avoid default AI purple/blue palettes.
- Use a single strong accent color per theme.

## Authoring Rules

### Source Import

- Always import a source before relying on it for a deck.
- Preserve the imported original in `content/sources/`.
- Never overwrite or mutate an imported source snapshot in place.
- GitHub import in v1 should remain lightweight: repository metadata plus README snapshot is enough unless explicitly expanded.
- PDF import is text-first. Favor extracted text and summaries over layout fidelity.

### Deck Authoring

- `brief.md` defines the why, who, duration, theme, and intended sources.
- `outline.md` defines the story. Edit this before editing renderer code.
- `deck.md` is the review layer between outline generation and HTML rendering.
- Use `<!-- sources: id-a, id-b -->` directly below each `##` heading in `outline.md` when a slide should lock to specific sources.
- If the outline is still scaffold-only, the builder may overwrite it with an auto-generated outline.
- Keep most decks between 6 and 10 slides unless the brief justifies more.
- In `deck.md`, reserve `##` for slide boundaries. Use `###` or deeper headings inside slide content.

### Rendering

- Output is a single static HTML file per deck.
- The renderer should stay offline-friendly and self-contained where practical.
- Keep keyboard navigation and print-to-PDF friendliness.
- Prefer strong typography, restrained motion, and clean evidence-first layouts.
- The default renderer is built in. Future explicit skill-based renderers should consume `deck.md` rather than raw source material.

## Recommended Skills

Use the globally installed skills on this machine as the default capability map for this repository.

### Preprocessing And Archival

- `pdf`: default skill for PDF extraction, OCR, text cleanup, and PDF-to-structured-content preparation.
- `xlsx`: use when source material includes spreadsheet tables or numeric appendices that should be folded into normalized content.
- `docx`: globally available, but out of scope for repository v1. Only use if the repository scope is explicitly expanded.
- `pptx`: globally available, but out of scope for repository v1. Only use if the repository scope is explicitly expanded.

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

1. Start from the brief, outline, normalized documents, and theme presets.
2. Prefer editing `outline.md`, `deck.md`, or a theme preset over patching generated HTML directly.
3. Preserve backward compatibility of normalized document fields unless a migration is deliberate and documented.
4. Keep commands and workflows reproducible from the repo root.
5. Avoid adding heavy dependencies without a clear payoff in generation quality or developer speed.
6. Treat citations and source ids as first-class. Content slides should keep a traceable link to imported sources.

## Suggested Workflow

1. Import source material with the CLI.
2. Create a deck workspace with `new-deck`.
3. Fill in `brief.md`.
4. Run `build` once to get a first outline, `deck.md`, and HTML output.
5. Refine `outline.md` or directly refine `deck.md`.
6. Rebuild or re-render until the story and styling are right.

## Implementation Bias

If you extend this codebase, prefer this order:

1. Improve source normalization quality.
2. Improve outline generation quality.
3. Improve slide IR expressiveness.
4. Improve renderer quality and theme system.
5. Add retrieval, search, or lightweight AI assistance.
6. Only then consider a studio UI.

Keep the project practical. Fast generation and maintainable structure matter more than supporting every source type.
