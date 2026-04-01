import { copyFile, readFile, readdir } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import type { Citation, DocumentSection, ImportedSource, NormalizedDocument } from "@presentation/domain";
import pdfParse from "pdf-parse";

import { getProjectPaths } from "./project.js";
import {
  checksum,
  chunkText,
  deriveKeywords,
  ensureDir,
  normalizeWhitespace,
  parseMarkdownSections,
  pickBulletPoints,
  readJson,
  slugify,
  summarize,
  timestampId,
  writeJson,
  writeText
} from "./utils.js";

export interface ImportResult {
  id: string;
  title: string;
  normalizedPath: string;
}

function buildSections(sections: Array<{ title: string; depth: number; content: string }>): DocumentSection[] {
  return sections.map((section, index) => ({
    id: `section-${index + 1}`,
    title: section.title,
    depth: section.depth,
    content: section.content,
    order: index
  }));
}

function buildImportedSource(input: {
  id: string;
  kind: ImportedSource["kind"];
  title: string;
  importedAt: string;
  originalName: string;
  originalLocation: string;
  storedPath: string;
  bytes?: number;
  checksum: string;
  metadata?: Record<string, unknown>;
}): ImportedSource {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    importedAt: input.importedAt,
    originalName: input.originalName,
    originalLocation: input.originalLocation,
    storedPath: input.storedPath,
    fingerprint: {
      checksum: input.checksum,
      bytes: input.bytes
    },
    metadata: input.metadata
  };
}

function buildNormalizedDocument(input: {
  id: string;
  kind: NormalizedDocument["kind"];
  title: string;
  summary: string;
  keywords: string[];
  importedSource: ImportedSource;
  sections: DocumentSection[];
  citations?: Citation[];
  extractedAt: string;
}): NormalizedDocument {
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    summary: input.summary,
    keywords: input.keywords,
    importedSource: input.importedSource,
    sections: input.sections,
    citations: input.citations ?? [
      {
        sourceId: input.id,
        label: input.title
      }
    ],
    extractedAt: input.extractedAt
  };
}

async function nextSourceId(rootDir: string, baseId: string): Promise<string> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const existing = new Set(entries.map((entry) => entry.name));
  if (!existing.has(baseId)) {
    return baseId;
  }

  let counter = 2;
  while (existing.has(`${baseId}-${counter}`)) {
    counter += 1;
  }

  return `${baseId}-${counter}`;
}

function titleFromFilename(filePath: string): string {
  return basename(filePath, extname(filePath))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export async function importMarkdownFile(filePath: string, startDir = process.cwd()): Promise<ImportResult> {
  const paths = await getProjectPaths(startDir);
  const absolutePath = resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const importedAt = new Date().toISOString();
  const baseId = `${slugify(basename(filePath, extname(filePath))) || "source"}-${timestampId()}`;
  const id = await nextSourceId(join(paths.sources, "md"), baseId);
  const sourceDir = join(paths.sources, "md", id);
  const storedFile = join(sourceDir, `original${extname(filePath) || ".md"}`);
  await ensureDir(sourceDir);
  await copyFile(absolutePath, storedFile);

  const parsed = parseMarkdownSections(raw, titleFromFilename(filePath));
  const sections = buildSections(parsed.sections);
  const importedSource = buildImportedSource({
    id,
    kind: "markdown",
    title: parsed.title,
    importedAt,
    originalName: basename(filePath),
    originalLocation: absolutePath,
    storedPath: relative(paths.root, storedFile),
    bytes: Buffer.byteLength(raw, "utf8"),
    checksum: checksum(raw)
  });

  const normalized = buildNormalizedDocument({
    id,
    kind: "markdown",
    title: parsed.title,
    summary: summarize(sections[0]?.content ?? raw),
    keywords: deriveKeywords(raw),
    importedSource,
    sections,
    extractedAt: importedAt
  });

  await writeJson(join(sourceDir, "meta.json"), importedSource);
  await writeJson(join(paths.normalized, `${id}.json`), normalized);

  return {
    id,
    title: normalized.title,
    normalizedPath: relative(paths.root, join(paths.normalized, `${id}.json`))
  };
}

export async function importPdfFile(filePath: string, startDir = process.cwd()): Promise<ImportResult> {
  const paths = await getProjectPaths(startDir);
  const absolutePath = resolve(filePath);
  const buffer = await readFile(absolutePath);
  const parsedPdf = await pdfParse(buffer);
  const importedAt = new Date().toISOString();
  const baseId = `${slugify(basename(filePath, extname(filePath))) || "pdf"}-${timestampId()}`;
  const id = await nextSourceId(join(paths.sources, "pdf"), baseId);
  const sourceDir = join(paths.sources, "pdf", id);
  const storedFile = join(sourceDir, `original${extname(filePath) || ".pdf"}`);
  const extractedText = normalizeWhitespace(parsedPdf.text);
  await ensureDir(sourceDir);
  await copyFile(absolutePath, storedFile);
  await writeText(join(sourceDir, "extracted.txt"), extractedText + "\n");

  const chunks = chunkText(extractedText).map((content, index) => ({
    title: `PDF Excerpt ${index + 1}`,
    depth: 1,
    content
  }));
  const title = typeof parsedPdf.info?.Title === "string" && parsedPdf.info.Title.trim()
    ? parsedPdf.info.Title.trim()
    : titleFromFilename(filePath);
  const sections = buildSections(chunks);
  const importedSource = buildImportedSource({
    id,
    kind: "pdf",
    title,
    importedAt,
    originalName: basename(filePath),
    originalLocation: absolutePath,
    storedPath: relative(paths.root, storedFile),
    bytes: buffer.byteLength,
    checksum: checksum(buffer),
    metadata: {
      numPages: parsedPdf.numpages,
      info: parsedPdf.info ?? {}
    }
  });

  const normalized = buildNormalizedDocument({
    id,
    kind: "pdf",
    title,
    summary: summarize(extractedText),
    keywords: deriveKeywords(extractedText),
    importedSource,
    sections,
    extractedAt: importedAt
  });

  await writeJson(join(sourceDir, "meta.json"), importedSource);
  await writeJson(join(paths.normalized, `${id}.json`), normalized);

  return {
    id,
    title,
    normalizedPath: relative(paths.root, join(paths.normalized, `${id}.json`))
  };
}

function parseGitHubUrl(input: string): { owner: string; repo: string } {
  const match = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git|\/|$)/.exec(input.trim());
  if (!match) {
    throw new Error("GitHub source must be a repository URL such as https://github.com/owner/repo");
  }

  return {
    owner: match[1],
    repo: match[2]
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "accept": "application/vnd.github+json",
      "user-agent": "presentation-cli"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return await response.json() as T;
}

export async function importGitHubRepo(repoUrl: string, startDir = process.cwd()): Promise<ImportResult> {
  const { owner, repo } = parseGitHubUrl(repoUrl);
  const paths = await getProjectPaths(startDir);
  const importedAt = new Date().toISOString();
  const repoData = await fetchJson<Record<string, unknown>>(`https://api.github.com/repos/${owner}/${repo}`);
  const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: {
      "accept": "application/vnd.github.raw+json",
      "user-agent": "presentation-cli"
    }
  });

  let readme = "";
  if (readmeResponse.ok) {
    readme = await readmeResponse.text();
  }

  const description = typeof repoData.description === "string" ? repoData.description : "";
  const fullName = typeof repoData.full_name === "string" ? repoData.full_name : `${owner}/${repo}`;
  const defaultBranch = typeof repoData.default_branch === "string" ? repoData.default_branch : "main";
  const topics = Array.isArray(repoData.topics) ? repoData.topics.filter((entry): entry is string => typeof entry === "string") : [];
  const metadataLines = [
    `Repository: ${fullName}`,
    description ? `Description: ${description}` : "",
    typeof repoData.language === "string" ? `Primary language: ${repoData.language}` : "",
    typeof repoData.stargazers_count === "number" ? `Stars: ${repoData.stargazers_count}` : "",
    typeof repoData.forks_count === "number" ? `Forks: ${repoData.forks_count}` : "",
    typeof repoData.updated_at === "string" ? `Updated at: ${repoData.updated_at}` : "",
    topics.length > 0 ? `Topics: ${topics.join(", ")}` : "",
    `Default branch: ${defaultBranch}`
  ].filter(Boolean);

  const normalizedMarkdown = [
    `# ${fullName}`,
    "",
    description,
    "",
    "## Repository Snapshot",
    "",
    ...metadataLines.map((line) => `- ${line}`),
    "",
    readme ? "## README" : "",
    "",
    readme
  ].filter(Boolean).join("\n");

  const baseId = `${slugify(`${owner}-${repo}`)}-${timestampId()}`;
  const id = await nextSourceId(join(paths.sources, "github"), baseId);
  const sourceDir = join(paths.sources, "github", id);
  await ensureDir(sourceDir);
  await writeJson(join(sourceDir, "repo.json"), repoData);
  if (readme) {
    await writeText(join(sourceDir, "README.md"), readme);
  }

  const parsed = parseMarkdownSections(normalizedMarkdown, fullName);
  const sections = buildSections(parsed.sections);
  const fingerprintInput = JSON.stringify(repoData) + "\n" + readme;
  const importedSource = buildImportedSource({
    id,
    kind: "github",
    title: fullName,
    importedAt,
    originalName: fullName,
    originalLocation: repoUrl,
    storedPath: relative(paths.root, join(sourceDir, "repo.json")),
    checksum: checksum(fingerprintInput),
    metadata: {
      owner,
      repo,
      defaultBranch,
      readmeIncluded: Boolean(readme)
    }
  });

  const normalized = buildNormalizedDocument({
    id,
    kind: "github",
    title: fullName,
    summary: summarize(`${description}\n\n${pickBulletPoints(normalizedMarkdown, 2).join(" ")}`),
    keywords: deriveKeywords(normalizedMarkdown),
    importedSource,
    sections,
    extractedAt: importedAt
  });

  await writeJson(join(sourceDir, "meta.json"), importedSource);
  await writeJson(join(paths.normalized, `${id}.json`), normalized);

  return {
    id,
    title: normalized.title,
    normalizedPath: relative(paths.root, join(paths.normalized, `${id}.json`))
  };
}

export async function listNormalizedDocuments(startDir = process.cwd()): Promise<NormalizedDocument[]> {
  const paths = await getProjectPaths(startDir);
  const entries = await readdir(paths.normalized, { withFileTypes: true });
  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readJson<NormalizedDocument>(join(paths.normalized, entry.name)))
  );

  return documents.sort((left, right) => right.extractedAt.localeCompare(left.extractedAt));
}
