# Deck Workspaces

Each deck lives in its own folder under `decks/`.

Expected files:

- `brief.md`: audience, objective, theme, and locked source ids.
- `outline.md`: human-editable outline that drives slide generation.
- `deck.md`: generated slide draft and canonical review artifact.
- `dist/index.html`: final static HTML deck.

Notes:

- Review and edit `deck.md` as needed before re-rendering HTML.
- Inside `deck.md`, use `##` only for slide boundaries. Use `###` or deeper headings inside a slide body.
