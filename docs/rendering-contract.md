# Rendering Contract

External HTML rendering is intentionally outside the core repository build.

When a renderer or rendering skill is asked to produce HTML for a deck, use this input order:

1. `decks/<deck-id>/render.handoff.json`
2. `decks/<deck-id>/deck.public.json`
3. `decks/<deck-id>/sources.lock.json`
4. `decks/<deck-id>/brief.json`

Rules:

- Default to `deck.public.json` as the display artifact.
- Treat `deck.json` as review-only input.
- Do not render speaker notes from review slides.
- Do not expose source ids, archive keys, or internal pipeline metadata in the visible presentation unless the user explicitly asks for citation UI.
- Only inspect `deck.json` when the public artifact is missing or a user explicitly asks to debug the review layer.
- Preserve orchestration hints from `render.handoff.json` so multi-agent render pipelines can parallelize asset preparation, layout QA, and HTML verification.

The purpose of this contract is to keep the public presentation clean while preserving a richer review artifact for editing, provenance, and worker coordination.
