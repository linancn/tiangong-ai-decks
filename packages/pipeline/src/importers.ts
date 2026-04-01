import { copyFile, readFile, readdir, rm } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";

import type {
  ArchiveDateSource,
  ArchiveTitleSource,
  Citation,
  DocumentSection,
  ImportedSource,
  NormalizedDocument,
  SourceKind
} from "@presentation/domain";
import matter from "gray-matter";
import pdfParse from "pdf-parse";

import { getProjectPaths } from "./project.js";
import {
  CONTENT_SCHEMA_VERSION,
  classifyContentType,
  checksum,
  coerceDate,
  chunkText,
  dateOnly,
  deriveKeywords,
  deriveArchiveNaming,
  ensureDir,
  extractDateFromFilename,
  normalizeWhitespace,
  normalizePdfMetadataDate,
  parseMarkdownSections,
  pickBulletPoints,
  readJson,
  summarize,
  uniqueStrings,
  writeJson,
  writeText
} from "./utils.js";

export interface ImportResult {
  id: string;
  title: string;
  normalizedPath: string;
}

export interface ImportInboxResult {
  imported: Array<ImportResult & { inboxPath: string; cleared: boolean }>;
  skipped: Array<{ inboxPath: string; reason: string }>;
  failed: Array<{ inboxPath: string; error: string }>;
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
  archive: ImportedSource["archive"];
  importedAt: string;
  originalName: string;
  originalLocation: string;
  storedPath: string;
  bytes?: number;
  checksum: string;
  selectionHints: ImportedSource["selectionHints"];
  metadata?: Record<string, unknown>;
}): ImportedSource {
  return {
    schemaVersion: CONTENT_SCHEMA_VERSION,
    id: input.id,
    kind: input.kind,
    title: input.title,
    archive: input.archive,
    importedAt: input.importedAt,
    originalName: input.originalName,
    originalLocation: input.originalLocation,
    storedPath: input.storedPath,
    fingerprint: {
      checksum: input.checksum,
      bytes: input.bytes
    },
    selectionHints: input.selectionHints,
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
    schemaVersion: CONTENT_SCHEMA_VERSION,
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
  await ensureDir(rootDir);
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

function sourceFolderName(kind: SourceKind): string {
  if (kind === "markdown") {
    return "md";
  }

  return kind;
}

function resolveDateCandidate(input: Array<{ value?: string; source: ArchiveDateSource }>, importedAt: string): { effectiveDate: string; source: ArchiveDateSource } {
  for (const entry of input) {
    if (entry.value) {
      return {
        effectiveDate: entry.value,
        source: entry.source
      };
    }
  }

  return {
    effectiveDate: dateOnly(importedAt),
    source: "imported"
  };
}

function resolveTitleCandidate(input: Array<{ value?: string; source: ArchiveTitleSource }>, fallbackTitle: string): { title: string; source: ArchiveTitleSource } {
  for (const entry of input) {
    if (entry.value && entry.value.trim()) {
      return {
        title: entry.value.trim(),
        source: entry.source
      };
    }
  }

  return {
    title: fallbackTitle,
    source: "filename"
  };
}

function buildSelectionHints(input: {
  title: string;
  originalName: string;
  summary: string;
  keywords: string[];
  contentType: ImportedSource["selectionHints"]["contentType"];
}): ImportedSource["selectionHints"] {
  return {
    summary: input.summary,
    keywords: uniqueStrings(input.keywords, 8),
    titleAliases: uniqueStrings([
      input.title,
      titleFromFilename(input.originalName),
      basename(input.originalName, extname(input.originalName))
    ], 4),
    contentType: input.contentType
  };
}

export async function importMarkdownFile(filePath: string, startDir = process.cwd()): Promise<ImportResult> {
  const paths = await getProjectPaths(startDir);
  const absolutePath = resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  const importedAt = new Date().toISOString();
  const frontmatter = matter(raw);
  const parsed = parseMarkdownSections(raw, titleFromFilename(filePath));
  const resolvedTitle = resolveTitleCandidate([
    { value: typeof frontmatter.data.title === "string" ? frontmatter.data.title : undefined, source: "frontmatter" },
    { value: parsed.title !== titleFromFilename(filePath) ? parsed.title : undefined, source: "first-heading" }
  ], titleFromFilename(filePath));
  const title = resolvedTitle.title;
  const markdownDate = resolveDateCandidate([
    { value: coerceDate(frontmatter.data.date), source: "frontmatter" },
    { value: coerceDate(frontmatter.data.published), source: "frontmatter" },
    { value: coerceDate(frontmatter.data.publishedAt), source: "frontmatter" },
    { value: coerceDate(frontmatter.data.updatedAt), source: "frontmatter" },
    { value: extractDateFromFilename(basename(filePath)), source: "filename" }
  ], importedAt);
  const archive = deriveArchiveNaming({
    kindLabel: "md",
    title,
    importedAt,
    effectiveDate: markdownDate.effectiveDate,
    effectiveDateSource: markdownDate.source,
    titleSource: resolvedTitle.source
  });
  const id = await nextSourceId(join(paths.sources, sourceFolderName("markdown"), archive.yearBucket), archive.archiveKey);
  const sourceDir = join(paths.sources, sourceFolderName("markdown"), archive.yearBucket, id);
  const storedFile = join(sourceDir, `original${extname(filePath) || ".md"}`);
  await ensureDir(sourceDir);
  await copyFile(absolutePath, storedFile);

  const sections = buildSections(parsed.sections);
  const keywords = deriveKeywords(raw);
  const summary = summarize(sections[0]?.content ?? raw);
  const contentType = classifyContentType({
    kind: "markdown",
    title,
    text: raw
  });
  const importedSource = buildImportedSource({
    id,
    kind: "markdown",
    title,
    archive: {
      ...archive,
      archiveKey: id
    },
    importedAt,
    originalName: basename(filePath),
    originalLocation: absolutePath,
    storedPath: relative(paths.root, storedFile),
    bytes: Buffer.byteLength(raw, "utf8"),
    checksum: checksum(raw),
    selectionHints: buildSelectionHints({
      title,
      originalName: basename(filePath),
      summary,
      keywords,
      contentType
    }),
    metadata: {
      sourceFolder: sourceFolderName("markdown")
    }
  });

  const normalized = buildNormalizedDocument({
    id,
    kind: "markdown",
    title,
    summary,
    keywords,
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
  const extractedText = normalizeWhitespace(parsedPdf.text);
  const resolvedTitle = resolveTitleCandidate([
    { value: typeof parsedPdf.info?.Title === "string" ? parsedPdf.info.Title : undefined, source: "pdf-metadata" }
  ], titleFromFilename(filePath));
  const title = resolvedTitle.title;
  const pdfDate = resolveDateCandidate([
    { value: normalizePdfMetadataDate(parsedPdf.info?.CreationDate), source: "pdf-metadata" },
    { value: normalizePdfMetadataDate(parsedPdf.info?.ModDate), source: "pdf-metadata" },
    { value: extractDateFromFilename(basename(filePath)), source: "filename" }
  ], importedAt);
  const archive = deriveArchiveNaming({
    kindLabel: "pdf",
    title,
    importedAt,
    effectiveDate: pdfDate.effectiveDate,
    effectiveDateSource: pdfDate.source,
    titleSource: resolvedTitle.source
  });
  const id = await nextSourceId(join(paths.sources, sourceFolderName("pdf"), archive.yearBucket), archive.archiveKey);
  const sourceDir = join(paths.sources, sourceFolderName("pdf"), archive.yearBucket, id);
  const storedFile = join(sourceDir, `original${extname(filePath) || ".pdf"}`);
  await ensureDir(sourceDir);
  await copyFile(absolutePath, storedFile);
  await writeText(join(sourceDir, "extracted.txt"), extractedText + "\n");

  const chunks = chunkText(extractedText).map((content, index) => ({
    title: `PDF Excerpt ${index + 1}`,
    depth: 1,
    content
  }));
  const sections = buildSections(chunks);
  const keywords = deriveKeywords(extractedText);
  const summary = summarize(extractedText);
  const contentType = classifyContentType({
    kind: "pdf",
    title,
    text: extractedText
  });
  const importedSource = buildImportedSource({
    id,
    kind: "pdf",
    title,
    archive: {
      ...archive,
      archiveKey: id
    },
    importedAt,
    originalName: basename(filePath),
    originalLocation: absolutePath,
    storedPath: relative(paths.root, storedFile),
    bytes: buffer.byteLength,
    checksum: checksum(buffer),
    selectionHints: buildSelectionHints({
      title,
      originalName: basename(filePath),
      summary,
      keywords,
      contentType
    }),
    metadata: {
      numPages: parsedPdf.numpages,
      info: parsedPdf.info ?? {},
      sourceFolder: sourceFolderName("pdf")
    }
  });

  const normalized = buildNormalizedDocument({
    id,
    kind: "pdf",
    title,
    summary,
    keywords,
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
  const githubDate = resolveDateCandidate([
    { value: coerceDate(repoData.pushed_at), source: "github-api" },
    { value: coerceDate(repoData.updated_at), source: "github-api" }
  ], importedAt);
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

  const archive = deriveArchiveNaming({
    kindLabel: "github",
    title: fullName,
    importedAt,
    effectiveDate: githubDate.effectiveDate,
    effectiveDateSource: githubDate.source,
    titleSource: "repo-name"
  });
  const id = await nextSourceId(join(paths.sources, sourceFolderName("github"), archive.yearBucket), archive.archiveKey);
  const sourceDir = join(paths.sources, sourceFolderName("github"), archive.yearBucket, id);
  await ensureDir(sourceDir);
  await writeJson(join(sourceDir, "repo.json"), repoData);
  if (readme) {
    await writeText(join(sourceDir, "README.md"), readme);
  }

  const parsed = parseMarkdownSections(normalizedMarkdown, fullName);
  const sections = buildSections(parsed.sections);
  const fingerprintInput = JSON.stringify(repoData) + "\n" + readme;
  const keywords = uniqueStrings([...topics, ...deriveKeywords(normalizedMarkdown)], 8);
  const summary = summarize(`${description}\n\n${pickBulletPoints(normalizedMarkdown, 2).join(" ")}`);
  const contentType = classifyContentType({
    kind: "github",
    title: fullName,
    text: normalizedMarkdown
  });
  const importedSource = buildImportedSource({
    id,
    kind: "github",
    title: fullName,
    archive: {
      ...archive,
      archiveKey: id
    },
    importedAt,
    originalName: fullName,
    originalLocation: repoUrl,
    storedPath: relative(paths.root, join(sourceDir, "repo.json")),
    checksum: checksum(fingerprintInput),
    selectionHints: buildSelectionHints({
      title: fullName,
      originalName: repo,
      summary,
      keywords,
      contentType
    }),
    metadata: {
      owner,
      repo,
      defaultBranch,
      readmeIncluded: Boolean(readme),
      sourceFolder: sourceFolderName("github")
    }
  });

  const normalized = buildNormalizedDocument({
    id,
    kind: "github",
    title: fullName,
    summary,
    keywords,
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

async function listFilesRecursive(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return await listFilesRecursive(absolutePath);
      }

      if (entry.isFile()) {
        return [absolutePath];
      }

      return [];
    })
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
}

export async function importInbox(startDir = process.cwd()): Promise<ImportInboxResult> {
  const paths = await getProjectPaths(startDir);
  const inboxFiles = (await listFilesRecursive(paths.inbox))
    .filter((absolutePath) => basename(absolutePath) !== ".gitkeep");
  const result: ImportInboxResult = {
    imported: [],
    skipped: [],
    failed: []
  };

  for (const absolutePath of inboxFiles) {
    const inboxPath = relative(paths.root, absolutePath);
    const extension = extname(absolutePath).toLowerCase();

    try {
      let imported: ImportResult;
      if (extension === ".md" || extension === ".markdown") {
        imported = await importMarkdownFile(absolutePath, startDir);
      } else if (extension === ".pdf") {
        imported = await importPdfFile(absolutePath, startDir);
      } else {
        result.skipped.push({
          inboxPath,
          reason: `Unsupported file type: ${extension || "(no extension)"}`
        });
        continue;
      }

      let cleared = false;
      try {
        await rm(absolutePath, { force: true });
        cleared = true;
      } catch (error) {
        result.failed.push({
          inboxPath,
          error: `Imported successfully but failed to clear inbox file: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      result.imported.push({
        ...imported,
        inboxPath,
        cleared
      });
    } catch (error) {
      result.failed.push({
        inboxPath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return result;
}

export async function listNormalizedDocuments(startDir = process.cwd()): Promise<NormalizedDocument[]> {
  const paths = await getProjectPaths(startDir);
  const entries = await readdir(paths.normalized, { withFileTypes: true });
  const documents = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => readJson<NormalizedDocument>(join(paths.normalized, entry.name)))
  );

  return documents.sort((left, right) => {
    const dateOrder = right.importedSource.archive.effectiveDate.localeCompare(left.importedSource.archive.effectiveDate);
    if (dateOrder !== 0) {
      return dateOrder;
    }

    return right.extractedAt.localeCompare(left.extractedAt);
  });
}
