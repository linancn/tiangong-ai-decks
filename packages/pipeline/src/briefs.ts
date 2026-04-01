import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import matter from "gray-matter";

import type { Deck, DeckBrief, DeckOutlineSection, NormalizedDocument, ThemeDefinition } from "@presentation/domain";

import { getProjectPaths } from "./project.js";
import { pickBulletPoints, readJson, slugify, stripMarkdown, summarize, writeJson } from "./utils.js";

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export interface DeckWorkspaceResult {
  deckDir: string;
  created: string[];
}

export async function createDeckWorkspace(
  deckId: string,
  options: {
    title?: string;
    theme?: string;
  } = {},
  startDir = process.cwd()
): Promise<DeckWorkspaceResult> {
  const paths = await getProjectPaths(startDir);
  const normalizedDeckId = slugify(deckId);
  const deckDir = join(paths.decks, normalizedDeckId);
  const created: string[] = [];
  await mkdir(deckDir, { recursive: true });
  await mkdir(join(deckDir, "assets"), { recursive: true });

  const briefPath = join(deckDir, "brief.md");
  if (!(await exists(briefPath))) {
    const title = options.title ?? "Untitled deck";
    const theme = options.theme ?? "report-clay";
    const briefTemplate = `---
title: "${title}"
subtitle: ""
objective: "State the business question or report objective."
audience: "Internal stakeholders"
durationMinutes: 10
theme: "${theme}"
sources: []
---

## Context
Summarize why this deck exists and what the audience should understand by the end.

## Must Cover
- Add the most important questions or decision points.
- Add source ids after you import materials.

## Tone
- Concise
- Evidence-first
- Report-oriented

## Constraints
- Keep the deck between 6 and 10 slides.
- Keep each content slide anchored to imported sources.
`;
    await writeFile(briefPath, briefTemplate, "utf8");
    created.push("brief.md");
  }

  const outlinePath = join(deckDir, "outline.md");
  if (!(await exists(outlinePath))) {
    const outlineTemplate = `# Outline

<!-- Build will overwrite this file if it only contains the scaffold below. -->

## Situation
<!-- sources: -->
- Summarize the current situation with evidence from imported sources.

## Signals
<!-- sources: -->
- Surface the most important findings.

## Recommendation
<!-- sources: -->
- Close with decisions, tradeoffs, or next steps.
`;
    await writeFile(outlinePath, outlineTemplate, "utf8");
    created.push("outline.md");
  }

  return {
    deckDir,
    created
  };
}

export async function loadDeckBrief(deckId: string, startDir = process.cwd()): Promise<{ brief: DeckBrief; deckDir: string }> {
  const paths = await getProjectPaths(startDir);
  const deckDir = join(paths.decks, slugify(deckId));
  const briefPath = join(deckDir, "brief.md");
  const raw = await readFile(briefPath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  const title = typeof data.title === "string" && data.title.trim() ? data.title.trim() : slugify(deckId);
  const objective = typeof data.objective === "string" && data.objective.trim()
    ? data.objective.trim()
    : "Summarize the imported sources.";
  const audience = typeof data.audience === "string" && data.audience.trim()
    ? data.audience.trim()
    : "Internal stakeholders";
  const theme = typeof data.theme === "string" && data.theme.trim()
    ? data.theme.trim()
    : "report-clay";
  const sourceIds = Array.isArray(data.sources)
    ? data.sources.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const cleanedNotes = normalizeBriefNotes(parsed.content);

  return {
    brief: {
      title,
      subtitle: typeof data.subtitle === "string" && data.subtitle.trim() ? data.subtitle.trim() : undefined,
      objective,
      audience,
      durationMinutes: typeof data.durationMinutes === "number" ? data.durationMinutes : undefined,
      theme,
      sources: sourceIds,
      notes: cleanedNotes
    },
    deckDir
  };
}

function normalizeBriefNotes(input: string): string | undefined {
  const cleaned = stripMarkdown(input);
  if (!cleaned) {
    return undefined;
  }

  const scaffoldMarkers = [
    "Summarize why this deck exists and what the audience should understand by the end.",
    "Add the most important questions or decision points.",
    "Keep the deck between 6 and 10 slides."
  ];

  if (scaffoldMarkers.every((marker) => cleaned.includes(marker))) {
    return undefined;
  }

  return cleaned;
}

function parseOutlineSections(raw: string): DeckOutlineSection[] {
  const normalized = raw.replace(/\r/g, "");
  const lines = normalized.split("\n");
  const sections: DeckOutlineSection[] = [];
  let currentTitle = "";
  let currentLines: string[] = [];
  let currentSources: string[] = [];

  const push = () => {
    if (!currentTitle) {
      currentLines = [];
      currentSources = [];
      return;
    }

    const body = currentLines.join("\n").trim();
    if (!body) {
      currentLines = [];
      currentSources = [];
      return;
    }

    sections.push({
      id: slugify(currentTitle),
      title: currentTitle,
      body,
      sourceIds: currentSources
    });
    currentLines = [];
    currentSources = [];
  };

  for (const line of lines) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) {
      push();
      currentTitle = heading[1].trim();
      continue;
    }

    const sourceDirective = /^<!--\s*sources:\s*(.*?)\s*-->$/.exec(line.trim());
    if (sourceDirective) {
      currentSources = sourceDirective[1]
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      continue;
    }

    if (currentTitle) {
      currentLines.push(line);
    }
  }

  push();
  return sections;
}

function isScaffoldOutline(sections: DeckOutlineSection[]): boolean {
  const scaffoldTitles = new Set(["Situation", "Signals", "Recommendation"]);
  return sections.length === 3 && sections.every((section) => scaffoldTitles.has(section.title));
}

export async function loadOrCreateOutline(
  deckId: string,
  brief: DeckBrief,
  documents: NormalizedDocument[],
  startDir = process.cwd()
): Promise<{ outline: DeckOutlineSection[]; deckDir: string; outlinePath: string; generated: boolean }> {
  const paths = await getProjectPaths(startDir);
  const deckDir = join(paths.decks, slugify(deckId));
  const outlinePath = join(deckDir, "outline.md");
  const raw = await readFile(outlinePath, "utf8");
  const parsed = parseOutlineSections(raw);

  if (parsed.length > 0 && !isScaffoldOutline(parsed)) {
    return {
      outline: parsed,
      deckDir,
      outlinePath,
      generated: false
    };
  }

  const generatedOutline = generateOutline(brief, documents);
  await writeFile(outlinePath, renderOutlineMarkdown(generatedOutline), "utf8");

  return {
    outline: generatedOutline,
    deckDir,
    outlinePath,
    generated: true
  };
}

export function generateOutline(brief: DeckBrief, documents: NormalizedDocument[]): DeckOutlineSection[] {
  const selected = documents.filter((document) => brief.sources.length === 0 || brief.sources.includes(document.id));
  const workingSet = selected.length > 0 ? selected : documents;
  const maxContentSlides = Math.min(5, Math.max(3, (brief.durationMinutes ?? 10) - 4));
  const contentSlides = workingSet.slice(0, maxContentSlides);

  const sections: DeckOutlineSection[] = [
    {
      id: "objective",
      title: "Objective",
      body: [
        `- ${brief.objective}`,
        brief.notes ? `- ${summarize(brief.notes, 180)}` : `- Audience: ${brief.audience}`
      ].join("\n"),
      sourceIds: contentSlides.slice(0, 2).map((document) => document.id)
    }
  ];

  for (const document of contentSlides) {
    const keyBullets = [
      ...pickBulletPoints(document.summary, 2),
      ...document.sections.slice(0, 2).map((section) => `${section.title}: ${summarize(section.content, 140)}`)
    ].slice(0, 3);

    sections.push({
      id: slugify(document.title),
      title: document.title,
      body: keyBullets.map((bullet) => `- ${bullet}`).join("\n"),
      sourceIds: [document.id]
    });
  }

  const takeawayLines = sections
    .slice(1)
    .flatMap((section) => section.body.split("\n"))
    .filter((line) => line.trim().length > 0)
    .slice(0, 3);

  sections.push({
    id: "takeaways",
    title: "Takeaways",
    body: takeawayLines.length > 0
      ? takeawayLines.join("\n")
      : [
        `- ${brief.objective}`,
        `- Audience: ${brief.audience}`
      ].join("\n"),
    sourceIds: [...new Set(contentSlides.map((document) => document.id))]
  });

  return sections;
}

export function renderOutlineMarkdown(outline: DeckOutlineSection[]): string {
  const blocks = outline.map((section) => {
    const sourceIds = section.sourceIds.join(", ");
    return [
      `## ${section.title}`,
      `<!-- sources: ${sourceIds} -->`,
      section.body.trim(),
      ""
    ].join("\n");
  });

  return ["# Outline", "", ...blocks].join("\n").trim() + "\n";
}

export async function loadThemeDefinition(themeId: string, startDir = process.cwd()): Promise<ThemeDefinition> {
  const paths = await getProjectPaths(startDir);
  const themePath = join(paths.presets, "themes", `${themeId}.json`);
  return await readJson<ThemeDefinition>(themePath);
}

export async function writeDeckArtifacts(
  deckId: string,
  payload: {
    deck: Deck;
    deckMarkdown: string;
    outline: DeckOutlineSection[];
    html: string;
    sourceLock: Array<{
      id: string;
      title?: string;
      kind?: string;
      importedAt?: string;
      normalizedPath?: string;
    }>;
  },
  startDir = process.cwd()
): Promise<{ deckMdPath: string; htmlPath: string }> {
  const paths = await getProjectPaths(startDir);
  const deckDir = join(paths.decks, slugify(deckId));
  const distDir = join(deckDir, "dist");
  await mkdir(distDir, { recursive: true });
  await writeFile(join(deckDir, "deck.md"), payload.deckMarkdown, "utf8");
  await writeJson(join(deckDir, "sources.lock.json"), payload.sourceLock);
  await writeFile(join(deckDir, "outline.generated.md"), renderOutlineMarkdown(payload.outline), "utf8");
  await writeFile(join(distDir, "index.html"), payload.html, "utf8");

  return {
    deckMdPath: join(deckDir, "deck.md"),
    htmlPath: join(distDir, "index.html")
  };
}
