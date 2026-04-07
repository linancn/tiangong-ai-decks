# Deck Workspaces

Each deck lives in its own folder under `decks/`.

Expected files:

- `brief.json`: audience, objective, freeform render hint, locked source ids, and orchestration hints.
- `outline.json`: human-editable outline that drives slide generation.
- `outline.generated.json`: last machine-generated outline snapshot.
- `deck.json`: generated review artifact and canonical deck handoff inside the core pipeline.
- `deck.public.json`: clean renderer handoff JSON derived from `deck.json`.
- `render.handoff.json`: machine-readable renderer and orchestration contract that points external workers to `deck.public.json`.
- `sources.lock.json`: locked source snapshot used to compose the deck.

Notes:

- Deck workspaces are user output and are gitignored by default. The repository keeps only `decks/README.md` and `decks/.gitkeep`.
- Deck assembly assumes the relevant source material has already been archived and normalized by preprocessing skills or workers.
- Review and edit `deck.json` as needed before handing it to a rendering skill.
- Hand rendering skills `render.handoff.json` or `deck.public.json` by default, not `deck.json`.
- `theme` in `brief.json` is only a style hint string for external skills. It is not backed by an internal theme preset file.
- HTML output is not produced by the core repository build. Use an explicit rendering skill such as `frontend-design`.
- Playwright verification is required before considering rendered HTML complete.
- At minimum, validate one representative desktop viewport and one representative mobile viewport, and fix any clipping, fixed-UI overlap, or broken layout before handoff.
- If the rendered deck keeps a sticky or floating side directory, also validate an ultra-wide viewport such as `3840x2160`.
