# AGENTS

This repository is a reusable system for building reviewable deck JSON artifacts from accumulated source material. The project is not a generic slide editor. It is a source-driven report engine with explicit orchestration boundaries for single-agent and multi-agent workflows.

## Mission

- Continuously collect raw material in this repo: markdown notes, PDFs, spreadsheets, Word documents, slide decks, public GitHub repositories, and related research assets.
- Normalize those materials into a stable machine-readable content library.
- Build a reviewable `deck.json` from a brief plus an outline, not by hand-editing finished HTML.
- Hand the finished `deck.public.json` to an explicit rendering skill when HTML is needed.

## Current Scope

The core repository is responsible for:

- stable archive and normalized-content contracts
- reviewable deck authoring through `brief.json`, `outline.json`, and `deck.json`
- CLI browsing and deck assembly from normalized JSON sources
- multi-agent-ready orchestration hints in deck workspaces
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

## Architectural Principles

1. Raw sources are immutable once imported.
2. Normalized content is the contract between skill-driven archival and deck generation.
3. `brief.json` and `outline.json` are the primary authoring surfaces.
4. `deck.json` is the canonical review artifact for a deck. HTML is an external render target, not the source of truth.
5. Prefer deterministic transforms over opaque magic. If AI is added later, it should generate or revise JSON artifacts, not dump final HTML directly.
6. Optimize for short iteration loops. CLI-first is preferred until there is sustained evidence that a studio UI is needed.
7. Multi-agent orchestration should happen around explicit JSON handoff artifacts, not through implicit shared state.

## Repository Contract

### `content/`

- `content/inbox/`: temporary drop zone for new files before archival. This directory is intentionally not versioned except for the `.gitkeep` placeholder.
- `content/sources/<kind>/<year>/<archive-key>/`: immutable imported snapshot plus `meta.json`.
- `content/normalized/<source-id>.json`: normalized document used by the builder.
- `content/library/`: future derived artifacts such as facts, quotes, tables, code insights, and visuals.
- `content/indexes/`: rebuildable search or retrieval indexes.
- User data under `content/` should remain local by default. Keep only scaffolding files such as `.gitkeep` and documentation in Git.

### `decks/<deck-id>/`

- `brief.json`: objective, audience, duration, theme hint, source ids, and orchestration hints.
- `outline.json`: human-editable outline. Each section becomes a content slide section.
- `outline.generated.json`: last machine-generated outline snapshot.
- `deck.json`: generated slide draft and canonical review artifact.
- `deck.public.json`: renderer-facing JSON derived from `deck.json` with review-only content removed.
- `render.handoff.json`: renderer-facing contract that tells external HTML renderers to consume `deck.public.json` by default.
- `sources.lock.json`: source lock used to trace the deck back to archived materials.
- `assets/`: deck-specific local assets when needed later.
- Deck workspaces are user data and should remain gitignored by default, except for repository scaffolding such as `decks/README.md` and `decks/.gitkeep`.

## Authoring Rules

### Source Intake And Archival

- Always archive and normalize a source before relying on it for a deck.
- New or updated files should be dropped into `content/inbox/` first, not copied directly into `content/sources/`.
- `content/inbox/` is transient staging only. A preprocessing skill or explicit agent workflow should remove successfully archived files from inbox.
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
- `selectionHints.contentType` from the controlled set: `notes`, `report`, `research`, `spec`, `documentation`, `repository`, `reference`, `presentation`.
- Preserve the imported original in `content/sources/`.
- Never overwrite or mutate an imported source snapshot in place.
- Derived companions must never replace or rewrite the imported original file. If a workflow needs extracted companions, add them as new files beside the source under the same archive directory.
- Skills should write `kind` values that match the actual source type, such as `markdown`, `pdf`, `docx`, `pptx`, `xlsx`, or `github`.
- Remote GitHub repositories are the normal exception to the local-inbox rule. They may be archived directly by URL and should still end up in the same archive structure.
- PDF-oriented preprocessing should favor extracted text, OCR, and summaries over layout fidelity unless the task explicitly depends on page layout.
- Spreadsheet-oriented preprocessing should preserve headers, sheet structure, and numeric meaning in normalized output.
- Document and slide preprocessing should preserve semantic structure, headings, and key textual content in normalized output.
- PPTX preprocessing must also extract embedded slide media into `content/sources/pptx/<year>/<archive-key>/media/`.
- PPTX media extraction must write `content/sources/pptx/<year>/<archive-key>/media/index.json` with:
- `rootPath` and `indexPath`.
- `assetCount`, `referenceCount`, `webRenderableReferenceCount`, and `relationshipTypeCounts`.
- one item per slide relationship with `slideNumber`, `relId`, `relationshipType`, `assetFile`, `path`, `sourcePath`, `webRenderable`, and `mimeType`.
- `content/normalized/<source-id>.json` for PPTX sources must include a top-level `media` summary that points at the source-adjacent `media/` directory and `media/index.json`.
- Each PPTX `sections[]` entry in `content/normalized/<source-id>.json` must include `mediaRefs` when matching slide images exist.
- Each `mediaRefs` item must include `path`, `assetFile`, `relId`, `slideNumber`, `left`, `top`, `width`, `height`, `area`, and `role`.
- `role` should distinguish `primary` from `supporting` images. Prefer large, content-bearing visuals as `primary`, and avoid flooding the section with tiny decorative icons.
- When a PPTX section has at least one `primary` image, append a `对应图片路径：` block to the end of that section's `content` field using repository-relative paths.

### Deck Authoring

- `brief.json` defines the why, who, duration, freeform render hint, intended sources, and orchestration hints.
- `outline.json` defines the story. Edit this before editing any rendering prompt or output.
- `deck.json` is the review layer between outline generation and HTML rendering.
- `deck.public.json` is the clean handoff artifact for display rendering. It should exclude speaker notes and review-only fields.
- `render.handoff.json` is the first renderer entrypoint when present. Rendering skills and orchestration workers should read it before choosing input files.
- If the outline is still scaffold-only, the builder may overwrite it with an auto-generated outline.
- Keep most decks between 6 and 10 slides unless the brief justifies more.
- `brief.json`, `outline.json`, `deck.json`, and `deck.public.json` should stay readable and stable enough for both human editing and machine orchestration.

### Multi-Agent Execution

- The repository should support both single-agent and multi-agent execution.
- Multi-agent execution should coordinate around JSON artifacts rather than shared hidden context.
- Use `brief.json` and `render.handoff.json` to describe preferred orchestration mode and worker roles.
- Typical worker decomposition is:
- source librarian: inspect normalized documents and maintain `sources.lock.json`
- storyliner: derive or revise `outline.json`
- review editor: assemble `deck.json`
- renderer: consume `deck.public.json` and `render.handoff.json`
- verifier: run Playwright checks on rendered HTML

### Rendering

- The repository does not render HTML directly.
- HTML should be produced only by an explicit rendering skill.
- `theme` in `brief.json` is only a freeform style hint string for rendering skills. It is not backed by an internal theme preset file.
- Rendering skills should prefer `render.handoff.json` when present, then `deck.public.json`, plus `sources.lock.json`, the brief's style hint, and archived source context rather than raw inbox files.
- Prefer strong typography, restrained motion, and clean evidence-first layouts.
- Playwright verification is a hard requirement for rendered HTML, not optional polish.
- Before considering rendered HTML done, open it in Playwright and review at least one representative desktop viewport and one representative mobile viewport unless the brief defines different targets.
- If the rendered HTML uses persistent floating chrome such as a sticky table of contents, fixed rail, or floating side sheet, also review at least one ultra-wide viewport such as `3840x2160`.
- Treat any fixed-header or fixed-nav occlusion, clipped slide content, unreadable overflow, or obvious JSON-dump rendering as a blocking failure that must be fixed before handoff.

## Recommended Skills

Use the globally installed skills on this machine as the default capability map for this repository.

### Preprocessing And Archival

- `pdf`: default skill for PDF extraction, OCR, text cleanup, and PDF-to-structured-content preparation.
- `xlsx`: use when source material includes spreadsheet tables or numeric appendices that should be folded into normalized content.
- `docx`: use when source material arrives as Word documents and should be archived into the same normalized-content contract.
- `pptx`: use when source material arrives as existing slide decks that should be mined, archived, and normalized before reuse.
- `pptx` workflows must preserve both text and slide media contracts. Text-only PPTX normalization is incomplete unless the media contract above is also satisfied.
- If no dedicated preprocessing skill exists for a source type, the agent must still follow the same archive and normalized-data contracts.

### Output And Rendering

- `frontend-design`: default skill for turning `deck.json` into polished HTML presentation pages.
- `web-artifacts-builder`: use when the output needs a more elaborate multi-component web artifact rather than a straightforward presentation page.
- `webapp-testing`: default verification skill for checking rendered HTML in Playwright before sign-off.
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
2. Prefer editing `brief.json`, `outline.json`, or `deck.json` over patching rendered HTML directly.
3. Preserve backward compatibility of normalized document fields unless a migration is deliberate and documented.
4. Keep commands and workflows reproducible from the repo root.
5. Avoid adding heavy dependencies without a clear payoff in generation quality or developer speed.
6. Treat citations and source ids as first-class. Content slides should keep a traceable link to imported sources.

## Suggested Workflow

1. Intake: place new or changed source files into `content/inbox/`.
2. Normalize and archive: choose the appropriate preprocessing skill or worker, parse the inbox files or remote source, archive originals into `content/sources/`, write normalized outputs into `content/normalized/`, and clear successful local inbox items.
3. Compose: when asked for a report or HTML presentation, search the archived and normalized material, select relevant sources, and produce `brief.json`, `outline.json`, `sources.lock.json`, and a reviewable `deck.json`.
4. Render: turn `deck.public.json` into final HTML only through an explicit rendering skill such as `frontend-design`.
5. Verify: open the rendered HTML in Playwright before completion and fix any layout clipping, fixed-UI overlap, overflow, or broken viewport behavior found in the target viewports.

Operational notes:

- Do not build decks directly from files still sitting in `content/inbox/`.
- Prefer normalized content as the primary input for composition. Refer back to archived originals only when needed.
- `deck.json` is the handoff artifact between composition and rendering.
- Source naming and metadata are part of retrieval quality. Do not improvise archive keys or omit selection hints.
- `content/inbox/` should remain disposable and should not accumulate long-term material.

## Implementation Bias

If you extend this codebase, prefer this order:

1. Improve source normalization quality.
2. Improve outline generation quality.
3. Improve slide JSON expressiveness.
4. Improve render handoff quality for external skills.
5. Add retrieval, search, orchestration, or lightweight AI assistance.
6. Only then consider a studio UI.

Keep the project practical. Fast generation and maintainable structure matter more than supporting every source type.
