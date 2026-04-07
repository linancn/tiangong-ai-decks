import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type {
  ArchiveDateSource,
  ArchiveNaming,
  ArchiveTitleSource,
  SelectionContentType,
  SourceKind
} from "@tiangong-ai-decks/domain";

const ARCHIVE_SCHEME_VERSION = "archive-v1";
const ARCHIVE_KEY_PATTERN = "<effective-date>--<kind>--<title-slug>--<import-stamp>";
export const CONTENT_SCHEMA_VERSION = 1;

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
  const lexicalSource = input
    .replace(/^---[\s\S]*?---\s*/m, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\b[a-z]+:\/\/\S+/g, " ");
  const stopwords = new Set([
    "able",
    "about",
    "afterward",
    "again",
    "against",
    "almost",
    "along",
    "already",
    "although",
    "always",
    "among",
    "amongst",
    "and",
    "another",
    "anyone",
    "anything",
    "around",
    "after",
    "because",
    "become",
    "becomes",
    "becoming",
    "beforehand",
    "before",
    "being",
    "below",
    "beside",
    "besides",
    "between",
    "beyond",
    "both",
    "cannot",
    "could",
    "every",
    "everyone",
    "everything",
    "first",
    "from",
    "further",
    "here",
    "however",
    "have",
    "into",
    "itself",
    "into",
    "least",
    "many",
    "more",
    "most",
    "much",
    "must",
    "never",
    "often",
    "other",
    "otherwise",
    "over",
    "public",
    "rather",
    "same",
    "should",
    "since",
    "still",
    "the",
    "that",
    "their",
    "than",
    "there",
    "therefore",
    "these",
    "this",
    "those",
    "through",
    "throughout",
    "under",
    "until",
    "very",
    "whereas",
    "with",
    "will",
    "without",
    "would",
    "your",
    "yours",
    "user",
    "what",
    "when",
    "where",
    "which",
    "while",
    "using",
    "used",
    "into",
    "also",
    "any",
    "are",
    "can",
    "for",
    "get",
    "make",
    "made",
    "may",
    "not",
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
    "across",
    "cli",
    "command",
    "commands",
    "core",
    "files",
    "file",
    "html",
    "into",
    "items",
    "markdown",
    "note",
    "notes",
    "npm",
    "presentation",
    "presentations",
    "project",
    "readme",
    "repo",
    "repository",
    "repositories",
    "report",
    "run",
    "slide",
    "slides",
    "using",
    "workspace",
    "workspaces",
    "would"
  ]);

  const counts = new Map<string, number>();
  for (const word of lexicalSource.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) {
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

export function classifyContentType(input: {
  kind: SourceKind;
  title: string;
  text: string;
}): SelectionContentType {
  if (input.kind === "github") {
    return "repository";
  }

  if (input.kind === "pptx") {
    return "presentation";
  }

  const sample = `${input.title}\n${input.text}`.toLowerCase();
  const rules: Array<{ type: SelectionContentType; pattern: RegExp }> = [
    {
      type: "spec",
      pattern: /\b(rfc|spec|proposal|technical design|design doc|architecture|requirements?|prd)\b/
    },
    {
      type: "research",
      pattern: /\b(paper|study|research|benchmark|evaluation|experiment|survey|arxiv)\b/
    },
    {
      type: "documentation",
      pattern: /\b(documentation|docs|guide|manual|handbook|tutorial|readme)\b/
    },
    {
      type: "notes",
      pattern: /\b(notes|meeting|memo|journal|log|minutes)\b/
    },
    {
      type: "report",
      pattern: /\b(report|analysis|review|retrospective|postmortem|summary|brief|update)\b/
    }
  ];

  for (const rule of rules) {
    if (rule.pattern.test(sample)) {
      return rule.type;
    }
  }

  return "reference";
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

export function uniqueStrings(values: Array<string | undefined | null>, limit?: number): string[] {
  const output: string[] = [];
  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || output.includes(normalized)) {
      continue;
    }

    output.push(normalized);
    if (limit && output.length >= limit) {
      break;
    }
  }

  return output;
}

export function dateOnly(input: Date | string): string {
  const value = input instanceof Date ? input : new Date(input);
  const pad = (entry: number) => entry.toString().padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function parseCompactDate(value: string): string | undefined {
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (!compact) {
    return undefined;
  }

  return `${compact[1]}-${compact[2]}-${compact[3]}`;
}

export function coerceDate(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateOnly(value);
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const compact = parseCompactDate(trimmed);
  if (compact) {
    return compact;
  }

  const normalized = trimmed
    .replace(/^D:/, "")
    .replace(/[T_]/g, " ")
    .replace(/[./]/g, "-");
  const explicit = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  if (explicit) {
    return `${explicit[1]}-${explicit[2]}-${explicit[3]}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return dateOnly(parsed);
}

export function extractDateFromFilename(input: string): string | undefined {
  const normalized = input.replace(/\.[^.]+$/, "");
  const dashed = /(?:^|[^0-9])(\d{4})[-_](\d{2})[-_](\d{2})(?:[^0-9]|$)/.exec(normalized);
  if (dashed) {
    return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;
  }

  const compact = /(?:^|[^0-9])(\d{8})(?:[^0-9]|$)/.exec(normalized);
  if (compact) {
    return parseCompactDate(compact[1]);
  }

  return undefined;
}

export function normalizePdfMetadataDate(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const compact = /^D:(\d{4})(\d{2})(\d{2})/.exec(value);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }

  return coerceDate(value);
}

export function trimSlug(value: string, maxLength = 48): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength).replace(/-+$/g, "");
}

export function deriveArchiveNaming(input: {
  kindLabel: string;
  title: string;
  importedAt: string;
  effectiveDate?: string;
  effectiveDateSource?: ArchiveDateSource;
  titleSource: ArchiveTitleSource;
}): ArchiveNaming {
  const effectiveDate = input.effectiveDate ?? dateOnly(input.importedAt);
  const effectiveDateSource = input.effectiveDateSource ?? "imported";
  const importStamp = timestampId(new Date(input.importedAt));
  const titleSlug = trimSlug(slugify(input.title) || input.kindLabel || "source");
  const archiveKey = `${effectiveDate}--${input.kindLabel}--${titleSlug}--${importStamp}`;

  return {
    schemeVersion: ARCHIVE_SCHEME_VERSION,
    archiveKeyPattern: ARCHIVE_KEY_PATTERN,
    archiveKey,
    yearBucket: effectiveDate.slice(0, 4),
    effectiveDate,
    effectiveDateSource,
    importStamp,
    titleSlug,
    titleSource: input.titleSource,
    archiveLabel: `${effectiveDate} | ${input.title} | ${input.kindLabel}`
  };
}
