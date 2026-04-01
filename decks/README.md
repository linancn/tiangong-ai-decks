# Deck Workspaces

Each deck lives in its own folder under `decks/`.

Expected files:

- `brief.md`: audience, objective, freeform render hint, and locked source ids.
- `outline.md`: human-editable outline that drives slide generation.
- `deck.md`: generated slide draft and canonical review artifact.
- `sources.lock.json`: locked source snapshot used to compose the deck.

Notes:

- Review and edit `deck.md` as needed before handing it to a rendering skill.
- `theme` in `brief.md` is only a style hint string for external skills. It is not backed by an internal theme preset file.
- Inside `deck.md`, use `##` only for slide boundaries. Use `###` or deeper headings inside a slide body.
- HTML output is not produced by the core repository build. Use an explicit rendering skill such as `frontend-design`.
