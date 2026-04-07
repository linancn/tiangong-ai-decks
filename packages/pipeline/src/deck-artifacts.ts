import { join } from "node:path";

import type {
  Deck,
  PublicDeckArtifact,
  PublicDeckSlide,
  ReviewDeckArtifact
} from "@tiangong-ai-decks/domain";

import { getProjectPaths } from "./project.js";
import { readJson, slugify } from "./utils.js";

const DECK_ARTIFACT_SCHEMA_VERSION = 1;

export function createReviewDeckArtifact(deck: Deck): ReviewDeckArtifact {
  return {
    schemaVersion: DECK_ARTIFACT_SCHEMA_VERSION,
    artifactKind: "review",
    ...deck
  };
}

export function createPublicDeckArtifact(deck: Deck): PublicDeckArtifact {
  const slides: PublicDeckSlide[] = deck.slides.map(({ notes: _notes, ...slide }) => ({
    ...slide
  }));

  return {
    schemaVersion: DECK_ARTIFACT_SCHEMA_VERSION,
    artifactKind: "public",
    id: deck.id,
    title: deck.title,
    subtitle: deck.subtitle,
    theme: deck.theme,
    objective: deck.objective,
    audience: deck.audience,
    generatedAt: deck.generatedAt,
    sourceIds: deck.sourceIds,
    orchestration: deck.orchestration,
    slides
  };
}

export function parseReviewDeckArtifact(artifact: ReviewDeckArtifact): Deck {
  const { schemaVersion: _schemaVersion, artifactKind: _artifactKind, ...deck } = artifact;
  return deck;
}

export async function loadDeckArtifact(deckId: string, startDir = process.cwd()): Promise<{ deck: Deck; deckPath: string }> {
  const paths = await getProjectPaths(startDir);
  const deckPath = join(paths.decks, slugify(deckId), "deck.json");
  const artifact = await readJson<ReviewDeckArtifact>(deckPath);

  return {
    deck: parseReviewDeckArtifact(artifact),
    deckPath
  };
}
