import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";

import type {
  DeckBrief,
  DeckBriefArtifact,
  DeckOutlineArtifact,
  DeckOutlineSection,
  DeckRenderHandoff,
  NormalizedDocument,
  PublicDeckArtifact,
  ReviewDeckArtifact,
  WorkflowOrchestration
} from "@tiangong-ai-decks/domain";

import { getProjectPaths } from "./project.js";
import { pickBulletPoints, readJson, slugify, summarize, writeJson } from "./utils.js";

const BRIEF_SCHEMA_VERSION = 1;
const OUTLINE_SCHEMA_VERSION = 1;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function normalizeLines(lines: unknown): string[] {
  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createDefaultOrchestration(): WorkflowOrchestration {
  return {
    enabled: true,
    mode: "hybrid",
    coordinator: "deck-orchestrator",
    roles: [
      {
        id: "source-librarian",
        purpose: "Inspect normalized sources and produce grounded source locks for downstream workers.",
        inputs: ["content/normalized/*.json", "content/sources/**/meta.json"],
        outputs: ["sources.lock.json"]
      },
      {
        id: "storyliner",
        purpose: "Turn the brief and locked sources into a structured outline.",
        inputs: ["brief.json", "sources.lock.json"],
        outputs: ["outline.json", "outline.generated.json"]
      },
      {
        id: "review-editor",
        purpose: "Assemble the review deck artifact from outline sections and normalized sources.",
        inputs: ["brief.json", "outline.json", "content/normalized/*.json"],
        outputs: ["deck.json"]
      },
      {
        id: "renderer",
        purpose: "Render the public deck artifact into HTML or other presentation targets.",
        inputs: ["render.handoff.json", "deck.public.json", "sources.lock.json"],
        outputs: ["index.html"]
      },
      {
        id: "verifier",
        purpose: "Run viewport and overflow checks against rendered HTML before handoff.",
        inputs: ["render.handoff.json", "deck.public.json", "index.html"],
        outputs: ["preview/index.html.png", "verification-report.json"]
      }
    ]
  };
}

function createDefaultBriefSections(): DeckBriefArtifact["sections"] {
  return [
    {
      id: "context",
      title: "Context",
      body: [
        "Summarize why this deck exists and what the audience should understand by the end."
      ]
    },
    {
      id: "must-cover",
      title: "Must Cover",
      body: [
        "Add the most important questions or decision points.",
        "Add source ids after you import materials."
      ]
    },
    {
      id: "tone",
      title: "Tone",
      body: [
        "Concise",
        "Evidence-first",
        "Report-oriented"
      ]
    },
    {
      id: "constraints",
      title: "Constraints",
      body: [
        "Keep the deck between 6 and 10 slides.",
        "Keep each content slide anchored to imported sources."
      ]
    }
  ];
}

function createScaffoldOutlineSections(): DeckOutlineSection[] {
  return [
    {
      id: "situation",
      title: "Situation",
      sourceIds: [],
      body: [
        "Summarize the current situation with evidence from imported sources."
      ]
    },
    {
      id: "signals",
      title: "Signals",
      sourceIds: [],
      body: [
        "Surface the most important findings."
      ]
    },
    {
      id: "recommendation",
      title: "Recommendation",
      sourceIds: [],
      body: [
        "Close with decisions, tradeoffs, or next steps."
      ]
    }
  ];
}

function createBriefTemplate(deckId: string, title: string, theme: string): DeckBriefArtifact {
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    deckId,
    title,
    subtitle: "",
    objective: "State the business question or report objective.",
    audience: "Internal stakeholders",
    durationMinutes: 10,
    theme,
    sources: [],
    sections: createDefaultBriefSections(),
    orchestration: createDefaultOrchestration()
  };
}

function createOutlineTemplate(deckId: string): DeckOutlineArtifact {
  return {
    schemaVersion: OUTLINE_SCHEMA_VERSION,
    deckId,
    status: "scaffold",
    sections: createScaffoldOutlineSections()
  };
}

function flattenBriefSections(sections: DeckBriefArtifact["sections"]): string | undefined {
  const normalizedSections = sections
    .map((section) => ({
      id: slugify(section.id || section.title),
      title: section.title.trim(),
      body: normalizeLines(section.body)
    }))
    .filter((section) => section.title && section.body.length > 0);

  if (normalizedSections.length === 0) {
    return undefined;
  }

  const defaultSignature = JSON.stringify(createDefaultBriefSections().map((section) => ({
    title: section.title,
    body: section.body
  })));
  const sectionSignature = JSON.stringify(normalizedSections.map((section) => ({
    title: section.title,
    body: section.body
  })));

  if (sectionSignature === defaultSignature) {
    return undefined;
  }

  return normalizedSections
    .flatMap((section) => [section.title, ...section.body])
    .join("\n")
    .trim();
}

function normalizeOutlineSections(sections: unknown): DeckOutlineSection[] {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections
    .map((section): DeckOutlineSection | null => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const candidate = section as Record<string, unknown>;
      const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
      const body = normalizeLines(candidate.body);
      const sourceIds = Array.isArray(candidate.sourceIds)
        ? candidate.sourceIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
        : [];

      if (!title || body.length === 0) {
        return null;
      }

      return {
        id: typeof candidate.id === "string" && candidate.id.trim() ? candidate.id.trim() : slugify(title),
        title,
        body,
        sourceIds
      };
    })
    .filter((section): section is DeckOutlineSection => Boolean(section));
}

function isScaffoldOutline(artifact: DeckOutlineArtifact, sections: DeckOutlineSection[]): boolean {
  const scaffold = createScaffoldOutlineSections();
  if (sections.length === 0) {
    return true;
  }

  if (sections.length !== scaffold.length) {
    return false;
  }

  const matchesScaffold = sections.every((section, index) => (
    section.title === scaffold[index].title &&
    JSON.stringify(section.body) === JSON.stringify(scaffold[index].body)
  ));

  if (artifact.status === "scaffold") {
    return matchesScaffold;
  }

  return matchesScaffold;
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

  const briefPath = join(deckDir, "brief.json");
  if (!(await exists(briefPath))) {
    await writeJson(
      briefPath,
      createBriefTemplate(
        normalizedDeckId,
        options.title ?? "Untitled deck",
        options.theme ?? "editorial-light"
      )
    );
    created.push("brief.json");
  }

  const outlinePath = join(deckDir, "outline.json");
  if (!(await exists(outlinePath))) {
    await writeJson(outlinePath, createOutlineTemplate(normalizedDeckId));
    created.push("outline.json");
  }

  return {
    deckDir,
    created
  };
}

export async function loadDeckBrief(
  deckId: string,
  startDir = process.cwd()
): Promise<{ brief: DeckBrief; deckDir: string; briefPath: string }> {
  const paths = await getProjectPaths(startDir);
  const normalizedDeckId = slugify(deckId);
  const deckDir = join(paths.decks, normalizedDeckId);
  const briefPath = join(deckDir, "brief.json");
  const artifact = await readJson<DeckBriefArtifact>(briefPath);
  const sections = Array.isArray(artifact.sections)
    ? artifact.sections.map((section) => ({
      id: slugify(section.id || section.title),
      title: section.title.trim(),
      body: normalizeLines(section.body)
    }))
    : [];

  const title = typeof artifact.title === "string" && artifact.title.trim() ? artifact.title.trim() : normalizedDeckId;
  const objective = typeof artifact.objective === "string" && artifact.objective.trim()
    ? artifact.objective.trim()
    : "Summarize the imported sources.";
  const audience = typeof artifact.audience === "string" && artifact.audience.trim()
    ? artifact.audience.trim()
    : "Internal stakeholders";
  const theme = typeof artifact.theme === "string" && artifact.theme.trim()
    ? artifact.theme.trim()
    : "editorial-light";
  const sources = Array.isArray(artifact.sources)
    ? artifact.sources.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  return {
    brief: {
      title,
      subtitle: typeof artifact.subtitle === "string" && artifact.subtitle.trim() ? artifact.subtitle.trim() : undefined,
      objective,
      audience,
      durationMinutes: typeof artifact.durationMinutes === "number" ? artifact.durationMinutes : undefined,
      theme,
      sources,
      sections,
      notes: flattenBriefSections(sections),
      orchestration: artifact.orchestration
    },
    deckDir,
    briefPath
  };
}

export async function loadOrCreateOutline(
  deckId: string,
  brief: DeckBrief,
  documents: NormalizedDocument[],
  startDir = process.cwd()
): Promise<{ outline: DeckOutlineSection[]; deckDir: string; outlinePath: string; generated: boolean }> {
  const paths = await getProjectPaths(startDir);
  const normalizedDeckId = slugify(deckId);
  const deckDir = join(paths.decks, normalizedDeckId);
  const outlinePath = join(deckDir, "outline.json");
  const artifact = await readJson<DeckOutlineArtifact>(outlinePath);
  const sections = normalizeOutlineSections(artifact.sections);

  if (sections.length > 0 && !isScaffoldOutline(artifact, sections)) {
    return {
      outline: sections,
      deckDir,
      outlinePath,
      generated: false
    };
  }

  const generatedOutline = generateOutline(brief, documents);
  await writeJson(outlinePath, {
    schemaVersion: OUTLINE_SCHEMA_VERSION,
    deckId: normalizedDeckId,
    status: "generated",
    generatedAt: new Date().toISOString(),
    sections: generatedOutline
  } satisfies DeckOutlineArtifact);

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
        brief.objective,
        brief.notes ? summarize(brief.notes, 180) : `Audience: ${brief.audience}`
      ],
      sourceIds: contentSlides.slice(0, 2).map((document) => document.id)
    }
  ];

  for (const document of contentSlides) {
    const sectionBullets = [
      ...pickBulletPoints(document.summary, 2),
      ...document.sections.slice(0, 2).map((section) => `${section.title}: ${summarize(section.content, 140)}`)
    ].slice(0, 3);

    sections.push({
      id: slugify(document.title),
      title: document.title,
      body: sectionBullets,
      sourceIds: [document.id]
    });
  }

  const takeawayLines = sections
    .slice(1)
    .flatMap((section) => section.body)
    .filter((line) => line.trim().length > 0)
    .slice(0, 3);

  sections.push({
    id: "takeaways",
    title: "Takeaways",
    body: takeawayLines.length > 0
      ? takeawayLines
      : [
        brief.objective,
        `Audience: ${brief.audience}`
      ],
    sourceIds: [...new Set(contentSlides.map((document) => document.id))]
  });

  return sections;
}

export async function writeDeckArtifacts(
  deckId: string,
  payload: {
    reviewDeckArtifact: ReviewDeckArtifact;
    publicDeckArtifact: PublicDeckArtifact;
    renderHandoff: DeckRenderHandoff;
    outlineArtifact: DeckOutlineArtifact;
    sourceLock: Array<{
      id: string;
      title?: string;
      kind?: string;
      importedAt?: string;
      effectiveDate?: string;
      effectiveDateSource?: string;
      archiveLabel?: string;
      contentType?: string;
      keywords?: string[];
      summary?: string;
      titleAliases?: string[];
      normalizedPath?: string;
    }>;
  },
  startDir = process.cwd()
): Promise<{
  deckJsonPath: string;
  deckPublicJsonPath: string;
  renderHandoffPath: string;
  sourceLockPath: string;
  outlineGeneratedPath: string;
}> {
  const paths = await getProjectPaths(startDir);
  const deckDir = join(paths.decks, slugify(deckId));
  await mkdir(deckDir, { recursive: true });
  const deckJsonPath = join(deckDir, "deck.json");
  const deckPublicJsonPath = join(deckDir, "deck.public.json");
  const renderHandoffPath = join(deckDir, "render.handoff.json");
  const sourceLockPath = join(deckDir, "sources.lock.json");
  const outlineGeneratedPath = join(deckDir, "outline.generated.json");

  await writeJson(deckJsonPath, payload.reviewDeckArtifact);
  await writeJson(deckPublicJsonPath, payload.publicDeckArtifact);
  await writeJson(renderHandoffPath, payload.renderHandoff);
  await writeJson(sourceLockPath, payload.sourceLock);
  await writeJson(outlineGeneratedPath, payload.outlineArtifact);

  return {
    deckJsonPath,
    deckPublicJsonPath,
    renderHandoffPath,
    sourceLockPath,
    outlineGeneratedPath
  };
}
