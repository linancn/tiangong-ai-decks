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
export type SelectionContentType =
  | "notes"
  | "report"
  | "research"
  | "spec"
  | "documentation"
  | "repository"
  | "reference"
  | "presentation";

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
  mediaRefs?: DocumentSectionMediaRef[];
}

export interface Citation {
  sourceId: string;
  label: string;
  locator?: string;
}

export interface DocumentSectionMediaRef {
  path: string;
  assetFile: string;
  relId: string;
  slideNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
  area: number;
  role?: "primary" | "supporting";
}

export interface NormalizedMediaLibrary {
  rootPath: string;
  indexPath: string;
  assetCount: number;
  referenceCount: number;
  webRenderableReferenceCount: number;
  relationshipTypeCounts?: Record<string, number>;
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
  media?: NormalizedMediaLibrary;
  extractedAt: string;
}

export interface WorkflowRole {
  id: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
}

export interface WorkflowOrchestration {
  enabled: boolean;
  mode: "single-agent" | "parallel" | "sequential" | "hybrid";
  coordinator?: string;
  roles: WorkflowRole[];
}

export interface BriefSection {
  id: string;
  title: string;
  body: string[];
}

export interface DeckBrief {
  title: string;
  subtitle?: string;
  objective: string;
  audience: string;
  durationMinutes?: number;
  theme: string;
  sources: string[];
  sections: BriefSection[];
  notes?: string;
  orchestration?: WorkflowOrchestration;
}

export interface DeckBriefArtifact extends DeckBrief {
  schemaVersion: number;
  deckId: string;
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
  notes?: string[];
}

export interface DeckOutlineSection {
  id: string;
  title: string;
  body: string[];
  sourceIds: string[];
}

export interface DeckOutlineArtifact {
  schemaVersion: number;
  deckId: string;
  status: "scaffold" | "generated" | "curated";
  generatedAt?: string;
  sections: DeckOutlineSection[];
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
  orchestration?: WorkflowOrchestration;
  outline: DeckOutlineSection[];
  slides: DeckSlide[];
}

export interface ReviewDeckArtifact extends Deck {
  schemaVersion: number;
  artifactKind: "review";
}

export interface PublicDeckSlide {
  id: string;
  layout: SlideLayout;
  title: string;
  kicker?: string;
  body?: string;
  bullets?: string[];
  sourceIds: string[];
}

export interface PublicDeck {
  id: string;
  title: string;
  subtitle?: string;
  theme: string;
  objective: string;
  audience: string;
  generatedAt: string;
  sourceIds: string[];
  orchestration?: WorkflowOrchestration;
  slides: PublicDeckSlide[];
}

export interface PublicDeckArtifact extends PublicDeck {
  schemaVersion: number;
  artifactKind: "public";
}

export interface DeckRenderHandoff {
  schemaVersion: number;
  deckId: string;
  title: string;
  displayArtifact: string;
  reviewArtifact: string;
  briefPath: string;
  sourceLockPath: string;
  themeHint?: string;
  orchestration?: WorkflowOrchestration;
  qualityGates?: {
    playwrightLayoutCheckRequired: boolean;
    minimumViewports: Array<{
      name: string;
      width: number;
      height: number;
    }>;
    failOn: string[];
  };
  rules: {
    publicOnly: boolean;
    includeSpeakerNotes: boolean;
    includeControlDirectives: boolean;
    includeSourceIdsInOutput: boolean;
    fallbackToReviewArtifact: "never-by-default";
  };
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
