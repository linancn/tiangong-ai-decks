import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function timestampId(date = new Date()): string {
  const pad = (input: number) => input.toString().padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("") + "-" + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join("");
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as T;
}

export function checksum(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeWhitespace(input: string): string {
  return input.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function summarize(input: string, maxLength = 260): string {
  const compact = normalizeWhitespace(input).replace(/\n/g, " ");
  if (compact.length <= maxLength) {
    return compact;
  }

  return compact.slice(0, maxLength - 1).trimEnd() + "…";
}

export function deriveKeywords(input: string, limit = 8): string[] {
  const stopwords = new Set([
    "about",
    "after",
    "before",
    "being",
    "from",
    "have",
    "into",
    "more",
    "that",
    "than",
    "their",
    "there",
    "these",
    "this",
    "with",
    "will",
    "your",
    "what",
    "when",
    "where",
    "which",
    "while",
    "using",
    "used",
    "into",
    "also",
    "only",
    "each",
    "some",
    "such",
    "just",
    "like",
    "then",
    "them",
    "they",
    "were",
    "been",
    "does",
    "doing",
    "than",
    "across",
    "report",
    "slide",
    "slides"
  ]);

  const counts = new Map<string, number>();
  for (const word of input.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) {
    if (stopwords.has(word)) {
      continue;
    }

    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export interface MarkdownSectionSeed {
  title: string;
  depth: number;
  content: string;
}

export function parseMarkdownSections(markdown: string, fallbackTitle: string): { title: string; sections: MarkdownSectionSeed[] } {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const sections: MarkdownSectionSeed[] = [];
  let currentTitle = "Overview";
  let currentDepth = 1;
  let currentLines: string[] = [];
  let detectedTitle = fallbackTitle;

  const pushSection = () => {
    const content = normalizeWhitespace(currentLines.join("\n"));
    if (!content) {
      currentLines = [];
      return;
    }

    sections.push({
      title: currentTitle,
      depth: currentDepth,
      content
    });
    currentLines = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const depth = heading[1].length;
      const title = heading[2].trim();
      if (depth === 1 && detectedTitle === fallbackTitle) {
        detectedTitle = title;
      }

      pushSection();
      currentTitle = title;
      currentDepth = depth;
      continue;
    }

    currentLines.push(line);
  }

  pushSection();

  if (sections.length === 0) {
    sections.push({
      title: "Overview",
      depth: 1,
      content: normalizeWhitespace(markdown)
    });
  }

  return {
    title: detectedTitle,
    sections
  };
}

export function chunkText(input: string, maxChars = 1600): string[] {
  const compact = normalizeWhitespace(input);
  if (!compact) {
    return [];
  }

  const paragraphs = compact.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = paragraph;
      continue;
    }

    const sentences = paragraph.split(/(?<=[.!?。！？])\s+/);
    let sentenceChunk = "";
    for (const sentence of sentences) {
      const joined = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence;
      if (joined.length <= maxChars) {
        sentenceChunk = joined;
      } else {
        if (sentenceChunk) {
          chunks.push(sentenceChunk);
        }
        sentenceChunk = sentence;
      }
    }
    if (sentenceChunk) {
      chunks.push(sentenceChunk);
    }
    current = "";
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

export function pickBulletPoints(input: string, limit = 3): string[] {
  const candidates = normalizeWhitespace(input)
    .replace(/\n/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 30 && entry.length <= 220);

  const bullets: string[] = [];
  for (const candidate of candidates) {
    const normalized = candidate.replace(/^[-*]\s+/, "").replace(/[.:;]+$/, "");
    if (bullets.includes(normalized)) {
      continue;
    }

    bullets.push(normalized);
    if (bullets.length === limit) {
      return bullets;
    }
  }

  const fallback = normalizeWhitespace(input)
    .split("\n")
    .map((entry) => entry.trim().replace(/^[-*]\s+/, ""))
    .filter((entry) => entry.length > 0)
    .slice(0, limit);

  return bullets.length > 0 ? bullets : fallback;
}

export function stripMarkdown(input: string): string {
  return normalizeWhitespace(
    input
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*]\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/<!--.*?-->/gs, "")
  );
}

export async function writeText(path: string, contents: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, contents, "utf8");
}
