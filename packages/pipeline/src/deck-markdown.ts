import { readFile } from "node:fs/promises";
import { join } from "node:path";

import matter from "gray-matter";

import type { Deck, DeckOutlineSection, DeckSlide } from "@presentation/domain";

import { getProjectPaths } from "./project.js";
import { pickBulletPoints, slugify } from "./utils.js";

interface DeckFrontmatter {
  id?: string;
  title?: string;
  subtitle?: string;
  theme?: string;
  objective?: string;
  audience?: string;
  generatedAt?: string;
  sourceIds?: string[];
}

function escapeCommentValue(value: string): string {
  return value.replace(/-->/g, "--&gt;");
}

function normalizeSources(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildOutlineFromSlides(slides: DeckSlide[]): DeckOutlineSection[] {
  return slides
    .filter((slide) => slide.layout === "content" || slide.layout === "summary")
    .map((slide) => ({
      id: slugify(slide.id || slide.title),
      title: slide.title,
      body: slide.body ?? (slide.bullets ?? []).map((bullet) => `- ${bullet}`).join("\n"),
      sourceIds: slide.sourceIds
    }))
    .filter((section) => section.body.trim().length > 0);
}

export function renderDeckMarkdown(deck: Deck): string {
  const data: DeckFrontmatter = {
    id: deck.id,
    title: deck.title,
    theme: deck.theme,
    objective: deck.objective,
    audience: deck.audience,
    generatedAt: deck.generatedAt,
    sourceIds: deck.sourceIds
  };
  if (deck.subtitle) {
    data.subtitle = deck.subtitle;
  }

  const sections: string[] = [`# ${deck.title}`, ""];
  if (deck.subtitle) {
    sections.push(deck.subtitle, "");
  }

  for (const slide of deck.slides) {
    sections.push(`## ${slide.title}`);
    sections.push(`<!-- id: ${escapeCommentValue(slide.id)} -->`);
    sections.push(`<!-- layout: ${slide.layout} -->`);
    if (slide.kicker) {
      sections.push(`<!-- kicker: ${escapeCommentValue(slide.kicker)} -->`);
    }
    sections.push(`<!-- sources: ${slide.sourceIds.join(", ")} -->`);
    sections.push("");

    const body = slide.body?.trim()
      ? slide.body.trim()
      : (slide.bullets ?? []).map((bullet) => `- ${bullet}`).join("\n");
    if (body) {
      sections.push(body, "");
    }

    if (slide.notes?.trim()) {
      sections.push("### Speaker Notes", "", slide.notes.trim(), "");
    }
  }

  const markdown = sections.join("\n").trimEnd() + "\n";
  return matter.stringify(markdown, data);
}

export function parseDeckMarkdown(raw: string): Deck {
  const parsed = matter(raw);
  const data = parsed.data as DeckFrontmatter;
  const lines = parsed.content.replace(/\r/g, "").split("\n");

  const slides: DeckSlide[] = [];
  let current: {
    title: string;
    id?: string;
    layout?: DeckSlide["layout"];
    kicker?: string;
    sourceIds: string[];
    bodyLines: string[];
    noteLines: string[];
    mode: "body" | "notes";
  } | null = null;
  let headingTitle = data.title?.trim() || "";

  const pushSlide = () => {
    if (!current) {
      return;
    }

    const body = current.bodyLines.join("\n").trim();
    const notes = current.noteLines.join("\n").trim();
    slides.push({
      id: current.id ?? slugify(current.title),
      layout: current.layout ?? "content",
      title: current.title,
      kicker: current.kicker,
      body: body || undefined,
      bullets: body ? pickBulletPoints(body, 4) : [],
      sourceIds: current.sourceIds,
      notes: notes || undefined
    });
    current = null;
  };

  for (const line of lines) {
    const h1 = /^#\s+(.*)$/.exec(line);
    if (h1 && !headingTitle) {
      headingTitle = h1[1].trim();
      continue;
    }

    const h2 = /^##\s+(.*)$/.exec(line);
    if (h2) {
      pushSlide();
      current = {
        title: h2[1].trim(),
        sourceIds: [],
        bodyLines: [],
        noteLines: [],
        mode: "body"
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const directive = /^<!--\s*(id|layout|kicker|sources):\s*(.*?)\s*-->$/.exec(line.trim());
    if (directive) {
      const [, key, value] = directive;
      if (key === "id") {
        current.id = value.trim();
      } else if (key === "layout") {
        current.layout = value.trim() as DeckSlide["layout"];
      } else if (key === "kicker") {
        current.kicker = value.trim();
      } else if (key === "sources") {
        current.sourceIds = normalizeSources(value);
      }
      continue;
    }

    if (/^###\s+Speaker Notes\s*$/.test(line.trim())) {
      current.mode = "notes";
      continue;
    }

    if (current.mode === "notes") {
      current.noteLines.push(line);
    } else {
      current.bodyLines.push(line);
    }
  }

  pushSlide();

  const title = data.title?.trim() || headingTitle || "Untitled deck";
  const sourceIds = Array.isArray(data.sourceIds) && data.sourceIds.length > 0
    ? data.sourceIds
    : [...new Set(slides.flatMap((slide) => slide.sourceIds))];
  const outline = buildOutlineFromSlides(slides);

  return {
    id: data.id?.trim() || slugify(title),
    title,
    subtitle: data.subtitle?.trim() || undefined,
    theme: data.theme?.trim() || "editorial-light",
    objective: data.objective?.trim() || "Summarize the imported sources.",
    audience: data.audience?.trim() || "Internal stakeholders",
    generatedAt: data.generatedAt?.trim() || new Date().toISOString(),
    sourceIds,
    outline,
    slides
  };
}

export async function loadDeckMarkdown(deckId: string, startDir = process.cwd()): Promise<{ deck: Deck; deckPath: string }> {
  const paths = await getProjectPaths(startDir);
  const deckPath = join(paths.decks, slugify(deckId), "deck.md");
  const raw = await readFile(deckPath, "utf8");
  return {
    deck: parseDeckMarkdown(raw),
    deckPath
  };
}
