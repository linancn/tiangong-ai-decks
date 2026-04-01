#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { Command } from "commander";

import {
  buildDeckModel,
  createDeckWorkspace,
  importGitHubRepo,
  importMarkdownFile,
  importPdfFile,
  listNormalizedDocuments,
  loadDeckBrief,
  loadDeckMarkdown,
  loadOrCreateOutline,
  loadThemeDefinition,
  parseDeckMarkdown,
  renderDeckMarkdown,
  writeDeckArtifacts,
  getProjectPaths
} from "@presentation/pipeline";
import { renderDeckHtml } from "@presentation/renderer-html";

const program = new Command();

program
  .name("presentation")
  .description("Build reviewable Markdown decks and HTML presentations from markdown, PDF, and GitHub sources.")
  .version("0.1.0");

program
  .command("import-md")
  .description("Import a markdown source into the content library.")
  .argument("<file>", "Path to a markdown file")
  .action(async (file: string) => {
    const result = await importMarkdownFile(file);
    console.log(`Imported markdown source ${result.id}`);
    console.log(`Normalized document: ${result.normalizedPath}`);
  });

program
  .command("import-pdf")
  .description("Import a PDF source into the content library.")
  .argument("<file>", "Path to a PDF file")
  .action(async (file: string) => {
    const result = await importPdfFile(file);
    console.log(`Imported PDF source ${result.id}`);
    console.log(`Normalized document: ${result.normalizedPath}`);
  });

program
  .command("import-github")
  .description("Import a public GitHub repository snapshot into the content library.")
  .argument("<repoUrl>", "Repository URL such as https://github.com/owner/repo")
  .action(async (repoUrl: string) => {
    const result = await importGitHubRepo(repoUrl);
    console.log(`Imported GitHub source ${result.id}`);
    console.log(`Normalized document: ${result.normalizedPath}`);
  });

program
  .command("new-deck")
  .description("Create a new deck workspace with brief and outline scaffolds.")
  .argument("<deckId>", "Deck identifier")
  .option("--title <title>", "Human-readable deck title")
  .option("--theme <theme>", "Theme id", "report-clay")
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
  .description("Build a reviewable deck.md and static HTML.")
  .argument("<deckId>", "Deck identifier")
  .option("--theme <theme>", "Override the theme from brief.md")
  .action(async (deckId: string, options: { theme?: string }) => {
    const documents = await listNormalizedDocuments();
    const { brief } = await loadDeckBrief(deckId);
    if (options.theme) {
      brief.theme = options.theme;
    }

    const outlineResult = await loadOrCreateOutline(deckId, brief, documents);
    const deck = buildDeckModel(deckId, brief, outlineResult.outline, documents);
    const deckMarkdown = renderDeckMarkdown(deck);
    const roundTrippedDeck = parseDeckMarkdown(deckMarkdown);
    const theme = await loadThemeDefinition(options.theme ?? roundTrippedDeck.theme);
    const html = renderDeckHtml(roundTrippedDeck, theme);
    const sourceLock = deck.sourceIds.map((sourceId) => {
      const document = documents.find((entry) => entry.id === sourceId);
      return {
        id: sourceId,
        title: document?.title,
        kind: document?.kind,
        importedAt: document?.importedSource.importedAt,
        normalizedPath: document ? `content/normalized/${document.id}.json` : undefined
      };
    });
    const artifacts = await writeDeckArtifacts(deckId, {
      deck: roundTrippedDeck,
      deckMarkdown,
      outline: outlineResult.outline,
      html,
      sourceLock
    });

    console.log(`Built deck ${roundTrippedDeck.id}`);
    console.log(`Outline ${outlineResult.generated ? "generated" : "loaded"} from ${outlineResult.outlinePath}`);
    console.log(`Deck Markdown: ${artifacts.deckMdPath}`);
    console.log(`HTML output: ${artifacts.htmlPath}`);
  });

program
  .command("render-html")
  .description("Render HTML from an existing deck.md.")
  .argument("<deckId>", "Deck identifier")
  .option("--theme <theme>", "Override the theme from deck.md")
  .action(async (deckId: string, options: { theme?: string }) => {
    const { deck, deckPath } = await loadDeckMarkdown(deckId);
    if (options.theme) {
      deck.theme = options.theme;
    }

    const theme = await loadThemeDefinition(deck.theme);
    const html = renderDeckHtml(deck, theme);
    const artifacts = await writeDeckArtifacts(deckId, {
      deck,
      deckMarkdown: renderDeckMarkdown(deck),
      outline: deck.outline,
      html,
      sourceLock: deck.sourceIds.map((sourceId) => ({ id: sourceId }))
    });

    console.log(`Rendered HTML from ${deckPath}`);
    console.log(`HTML output: ${artifacts.htmlPath}`);
  });

program
  .command("list-sources")
  .description("List normalized documents currently available to the deck builder.")
  .action(async () => {
    const documents = await listNormalizedDocuments();
    if (documents.length === 0) {
      console.log("No normalized documents found.");
      return;
    }

    for (const document of documents) {
      console.log(`${document.id}  |  ${document.kind}  |  ${document.title}`);
    }
  });

program
  .command("list-themes")
  .description("List available deck themes.")
  .action(async () => {
    const paths = await getProjectPaths();
    const themeDir = join(paths.presets, "themes");
    const entries = await readdir(themeDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      console.log(entry.name.replace(/\.json$/, ""));
    }
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
