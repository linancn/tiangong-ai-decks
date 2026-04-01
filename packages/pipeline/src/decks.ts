import type { Deck, DeckBrief, DeckOutlineSection, DeckSlide, NormalizedDocument } from "@presentation/domain";

import { pickBulletPoints, slugify, summarize } from "./utils.js";

function deriveSlideNotes(section: DeckOutlineSection, documents: Map<string, NormalizedDocument>): string | undefined {
  const matches = section.sourceIds
    .map((sourceId) => documents.get(sourceId))
    .filter((entry): entry is NormalizedDocument => Boolean(entry))
    .map((document) => `${document.title}: ${document.summary}`);

  if (matches.length === 0) {
    return undefined;
  }

  return matches.join("\n");
}

export function buildDeckModel(
  deckId: string,
  brief: DeckBrief,
  outline: DeckOutlineSection[],
  documents: NormalizedDocument[]
): Deck {
  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const sourceIds = [...new Set(outline.flatMap((section) => section.sourceIds))];
  const contentSlides: DeckSlide[] = outline.map((section, index) => ({
    id: `content-${index + 1}-${slugify(section.title)}`,
    layout: index === outline.length - 1 ? "summary" : "content",
    title: section.title,
    body: section.body,
    bullets: pickBulletPoints(section.body, 4),
    sourceIds: section.sourceIds,
    notes: deriveSlideNotes(section, documentMap)
  }));

  const deck: Deck = {
    id: slugify(deckId),
    title: brief.title,
    subtitle: brief.subtitle,
    theme: brief.theme,
    objective: brief.objective,
    audience: brief.audience,
    generatedAt: new Date().toISOString(),
    sourceIds,
    outline,
    slides: [
      {
        id: "title",
        layout: "title",
        title: brief.title,
        kicker: brief.audience,
        body: brief.subtitle ?? brief.objective,
        sourceIds: sourceIds.slice(0, 3)
      },
      {
        id: "agenda",
        layout: "agenda",
        title: "Agenda",
        body: outline.map((section) => `- ${section.title}`).join("\n"),
        bullets: outline.map((section) => section.title),
        sourceIds: sourceIds.slice(0, 3)
      },
      ...contentSlides,
      {
        id: "closing",
        layout: "closing",
        title: "Closing",
        body: [
          `- Objective: ${brief.objective}`,
          `- Audience: ${brief.audience}`,
          `- Sources covered: ${sourceIds.length}`
        ].join("\n"),
        bullets: [
          summarize(brief.objective, 120),
          `Deck built from ${sourceIds.length} locked source${sourceIds.length === 1 ? "" : "s"}`
        ],
        sourceIds
      }
    ]
  };

  return deck;
}
