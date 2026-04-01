#!/usr/bin/env node

import { Command } from "commander";

import {
  buildDeckModel,
  createDeckWorkspace,
  importGitHubRepo,
  importInbox,
  importMarkdownFile,
  importPdfFile,
  listNormalizedDocuments,
  loadDeckBrief,
  loadOrCreateOutline,
  parseDeckMarkdown,
  renderDeckMarkdown,
  writeDeckArtifacts
} from "@presentation/pipeline";

const program = new Command();

program
  .name("presentation")
  .description("Build reviewable Markdown decks from markdown, PDF, and GitHub sources.")
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
  .command("import-inbox")
  .description("Import supported files from content/inbox/, archive them, and remove successful imports from inbox.")
  .action(async () => {
    const result = await importInbox();
    if (result.imported.length === 0 && result.skipped.length === 0 && result.failed.length === 0) {
      console.log("No files found in content/inbox.");
      return;
    }

    for (const item of result.imported) {
      console.log(`Imported ${item.id} from ${item.inboxPath}${item.cleared ? "" : " (inbox file not cleared)"}`);
    }

    for (const item of result.skipped) {
      console.log(`Skipped ${item.inboxPath}: ${item.reason}`);
    }

    for (const item of result.failed) {
      console.log(`Failed ${item.inboxPath}: ${item.error}`);
    }

    console.log(`Imported ${result.imported.length} item(s).`);
    if (result.failed.length > 0) {
      process.exitCode = 1;
    }
  });

program
  .command("new-deck")
  .description("Create a new deck workspace with brief and outline scaffolds.")
  .argument("<deckId>", "Deck identifier")
  .option("--title <title>", "Human-readable deck title")
  .option("--theme <theme>", "Render-hint style string written into brief.md", "editorial-light")
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
  .description("Build a reviewable deck.md from archived sources.")
  .argument("<deckId>", "Deck identifier")
  .option("--theme <theme>", "Override the render-hint style string from brief.md")
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
    const sourceLock = roundTrippedDeck.sourceIds.map((sourceId) => {
      const document = documents.find((entry) => entry.id === sourceId);
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
      deckMarkdown,
      outline: outlineResult.outline,
      sourceLock
    });

    console.log(`Built deck ${roundTrippedDeck.id}`);
    console.log(`Outline ${outlineResult.generated ? "generated" : "loaded"} from ${outlineResult.outlinePath}`);
    console.log(`Deck Markdown: ${artifacts.deckMdPath}`);
    console.log(`Source Lock: ${artifacts.sourceLockPath}`);
    console.log("HTML rendering is external to this repository. Use an explicit rendering skill against deck.md.");
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
