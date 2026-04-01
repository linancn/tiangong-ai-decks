export type SourceKind =
  | "markdown"
  | "pdf"
  | "github"
  | "docx"
  | "pptx"
  | "xlsx"
  | (string & {});
export type ArchiveDateSource =
  | "frontmatter"
  | "filename"
  | "document-metadata"
  | "pdf-metadata"
  | "github-api"
  | "manual"
  | "imported"
  | (string & {});
export type ArchiveTitleSource =
  | "frontmatter"
  | "first-heading"
  | "filename"
  | "document-metadata"
  | "pdf-metadata"
  | "repo-name"
  | "manual"
  | (string & {});
export type SelectionContentType = "notes" | "report" | "research" | "spec" | "documentation" | "repository" | "reference";

export interface SourceFingerprint {
  checksum: string;
  bytes?: number;
}

export interface ArchiveNaming {
  schemeVersion: "archive-v1";
  archiveKeyPattern: "<effective-date>--<kind>--<title-slug>--<import-stamp>";
  archiveKey: string;
  yearBucket: string;
  effectiveDate: string;
  effectiveDateSource: ArchiveDateSource;
  importStamp: string;
  titleSlug: string;
  titleSource: ArchiveTitleSource;
  archiveLabel: string;
}

export interface SourceSelectionHints {
  summary: string;
  keywords: string[];
  titleAliases: string[];
  contentType: SelectionContentType;
}

export interface ImportedSource {
  schemaVersion: number;
  id: string;
  kind: SourceKind;
  title: string;
  archive: ArchiveNaming;
  importedAt: string;
  originalName: string;
  originalLocation: string;
  storedPath: string;
  fingerprint?: SourceFingerprint;
  selectionHints: SourceSelectionHints;
  metadata?: Record<string, unknown>;
}

export interface DocumentSection {
  id: string;
  title: string;
  depth: number;
  content: string;
  order: number;
}

export interface Citation {
  sourceId: string;
  label: string;
  locator?: string;
}

export interface NormalizedDocument {
  schemaVersion: number;
  id: string;
  kind: SourceKind;
  title: string;
  summary: string;
  keywords: string[];
  importedSource: ImportedSource;
  sections: DocumentSection[];
  citations: Citation[];
  extractedAt: string;
}

export interface DeckBrief {
  title: string;
  subtitle?: string;
  objective: string;
  audience: string;
  durationMinutes?: number;
  theme: string;
  sources: string[];
  notes?: string;
}

export type SlideLayout =
  | "title"
  | "agenda"
  | "content"
  | "summary"
  | "closing";

export interface DeckSlide {
  id: string;
  layout: SlideLayout;
  title: string;
  kicker?: string;
  body?: string;
  bullets?: string[];
  sourceIds: string[];
  notes?: string;
}

export interface DeckOutlineSection {
  id: string;
  title: string;
  body: string;
  sourceIds: string[];
}

export interface Deck {
  id: string;
  title: string;
  subtitle?: string;
  theme: string;
  objective: string;
  audience: string;
  generatedAt: string;
  sourceIds: string[];
  outline: DeckOutlineSection[];
  slides: DeckSlide[];
}

export interface ProjectPaths {
  root: string;
  content: string;
  inbox: string;
  sources: string;
  normalized: string;
  library: string;
  decks: string;
}
