export type SourceKind = "markdown" | "pdf" | "github";

export interface SourceFingerprint {
  checksum: string;
  bytes?: number;
}

export interface ImportedSource {
  id: string;
  kind: SourceKind;
  title: string;
  importedAt: string;
  originalName: string;
  originalLocation: string;
  storedPath: string;
  fingerprint?: SourceFingerprint;
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

export interface ThemeDefinition {
  id: string;
  name: string;
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
  colors: {
    background: string;
    backgroundAlt: string;
    panel: string;
    panelAlt: string;
    text: string;
    muted: string;
    accent: string;
    accentSoft: string;
    border: string;
    shadow: string;
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
  presets: string;
}
