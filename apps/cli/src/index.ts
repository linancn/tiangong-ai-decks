#!/usr/bin/env node

import { Command } from "commander";

import type { NormalizedDocument } from "@tiangong-ai-decks/domain";

import {
  buildDeckModel,
  createPublicDeckArtifact,
  createReviewDeckArtifact,
  createDeckWorkspace,
  listNormalizedDocuments,
  loadDeckBrief,
  loadOrCreateOutline,
  writeDeckArtifacts
} from "@tiangong-ai-decks/pipeline";

const program = new Command();

program
  .name("tiangong-ai-decks")
  .description("Build reviewable JSON deck artifacts from normalized source libraries prepared by skills.")
  .version("0.1.0");

program
  .command("new-deck")
  .description("Create a new deck workspace with brief and outline JSON scaffolds.")
  .argument("<deckId>", "Deck identifier")
  .option("--title <title>", "Human-readable deck title")
  .option("--theme <theme>", "Render-hint style string written into brief.json", "editorial-light")
  .action(async (deckId: string, options: { title?: string; theme?: string }) => {
    const result = await createDeckWorkspace(deckId, {
      title: options.title,
      theme: options.theme
    });
    console.log(`Deck workspace ready at ${result.deckDir}`);
    console.log(`Created files: ${result.created.length > 0 ? result.created.join(", ") : "none"}`);
  });

program
  .command("build")
  .description("Build review and public deck JSON artifacts from archived sources.")
  .argument("<deckId>", "Deck identifier")
  .option("--theme <theme>", "Override the render-hint style string from brief.json")
  .action(async (deckId: string, options: { theme?: string }) => {
    const documents = await listNormalizedDocuments();
    const { brief } = await loadDeckBrief(deckId);
    if (options.theme) {
      brief.theme = options.theme;
    }

    const unresolvedBriefSources = brief.sources.filter(
      (sourceId: string) => !documents.some((document: NormalizedDocument) => document.id === sourceId)
    );
    if (unresolvedBriefSources.length > 0) {
      throw new Error(`Missing normalized JSON for brief sources: ${unresolvedBriefSources.join(", ")}`);
    }

    const outlineResult = await loadOrCreateOutline(deckId, brief, documents);
    const deck = buildDeckModel(deckId, brief, outlineResult.outline, documents);
    const reviewDeckArtifact = createReviewDeckArtifact(deck);
    const publicDeckArtifact = createPublicDeckArtifact(deck);
    const roundTrippedDeck = reviewDeckArtifact;
    const unresolvedDeckSources = roundTrippedDeck.sourceIds.filter(
      (sourceId: string) => !documents.some((document: NormalizedDocument) => document.id === sourceId)
    );
    if (unresolvedDeckSources.length > 0) {
      throw new Error(`Missing normalized JSON for outline/deck sources: ${unresolvedDeckSources.join(", ")}`);
    }

    const renderHandoff = {
      schemaVersion: 1,
      deckId: roundTrippedDeck.id,
      title: roundTrippedDeck.title,
      displayArtifact: "deck.public.json",
      reviewArtifact: "deck.json",
      briefPath: "brief.json",
      sourceLockPath: "sources.lock.json",
      themeHint: brief.theme,
      orchestration: brief.orchestration,
      rules: {
        publicOnly: true,
        includeSpeakerNotes: false,
        includeControlDirectives: false,
        includeSourceIdsInOutput: false,
        fallbackToReviewArtifact: "never-by-default" as const
      }
    };
    const sourceLock = roundTrippedDeck.sourceIds.map((sourceId: string) => {
      const document = documents.find((entry: NormalizedDocument) => entry.id === sourceId);
      return {
        id: sourceId,
        title: document?.title,
        kind: document?.kind,
        importedAt: document?.importedSource.importedAt,
        effectiveDate: document?.importedSource.archive.effectiveDate,
        effectiveDateSource: document?.importedSource.archive.effectiveDateSource,
        archiveLabel: document?.importedSource.archive.archiveLabel,
        contentType: document?.importedSource.selectionHints.contentType,
        keywords: document?.importedSource.selectionHints.keywords,
        summary: document?.summary,
        titleAliases: document?.importedSource.selectionHints.titleAliases,
        normalizedPath: document ? `content/normalized/${document.id}.json` : undefined
      };
    });
    const artifacts = await writeDeckArtifacts(deckId, {
      reviewDeckArtifact,
      publicDeckArtifact,
      renderHandoff,
      outlineArtifact: {
        schemaVersion: 1,
        deckId: roundTrippedDeck.id,
        status: outlineResult.generated ? "generated" : "curated",
        generatedAt: new Date().toISOString(),
        sections: outlineResult.outline
      },
      sourceLock
    });

    console.log(`Built deck ${roundTrippedDeck.id}`);
    console.log(`Outline ${outlineResult.generated ? "generated" : "loaded"} from ${outlineResult.outlinePath}`);
    console.log(`Deck JSON: ${artifacts.deckJsonPath}`);
    console.log(`Public Deck JSON: ${artifacts.deckPublicJsonPath}`);
    console.log(`Render Handoff: ${artifacts.renderHandoffPath}`);
    console.log(`Source Lock: ${artifacts.sourceLockPath}`);
    console.log("HTML rendering is external to this repository. Renderers and orchestration workers should read render.handoff.json and use deck.public.json by default.");
  });

program
  .command("list-sources")
  .description("List normalized documents currently available to the deck builder.")
  .option("--verbose", "Show summary, aliases, and date provenance")
  .action(async (options: { verbose?: boolean }) => {
    const documents = await listNormalizedDocuments();
    if (documents.length === 0) {
      console.log("No normalized documents found.");
      return;
    }

    for (const document of documents) {
      const keywords = document.importedSource.selectionHints.keywords.slice(0, 4).join(", ");
      console.log(
        [
          document.importedSource.archive.effectiveDate,
          `${document.kind}/${document.importedSource.selectionHints.contentType}`,
          document.id,
          document.title,
          keywords
        ].filter(Boolean).join("  |  ")
      );

      if (options.verbose) {
        console.log(`  date-source: ${document.importedSource.archive.effectiveDateSource}`);
        console.log(`  title-source: ${document.importedSource.archive.titleSource}`);
        console.log(`  archive: ${document.importedSource.archive.archiveLabel}`);
        console.log(`  aliases: ${document.importedSource.selectionHints.titleAliases.join(", ")}`);
        console.log(`  summary: ${document.summary}`);
      }
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
