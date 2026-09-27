export const SOURCE_ORDER = [
  "wikipedia",
  "openalex",
  "arxiv",
  "crossref",
  "hackernews",
  "duckduckgo",
  "mdn",
] as const;

export type SourceId = (typeof SOURCE_ORDER)[number];

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_ORDER as readonly string[]).includes(value);
}

export const SOURCE_CATALOG: Record<
  SourceId,
  { label: string; description: string }
> = {
  wikipedia: {
    label: "Wikipedia",
    description:
      "Encyclopedic overviews, definitions, history, and biographies.",
  },
  openalex: {
    label: "OpenAlex",
    description:
      "Scholarly works with abstracts, authors, and publication years.",
  },
  arxiv: {
    label: "arXiv",
    description:
      "Preprints in computing, physics, math, statistics, and related fields.",
  },
  crossref: {
    label: "Crossref",
    description:
      "Published journal and conference metadata, sometimes with abstracts.",
  },
  hackernews: {
    label: "Hacker News",
    description:
      "Practitioner discussion and recent industry reaction.",
  },
  duckduckgo: {
    label: "DuckDuckGo",
    description:
      "Open web pages for current events, products, companies, and topics the catalogs above do not cover.",
  },
  mdn: {
    label: "MDN",
    description: "Web platform documentation for browser and JavaScript APIs.",
  },
};

export interface GatheredDocument {
  source: SourceId;
  title: string;
  url: string;
  text: string;
  published?: string;
  authors?: string[];
}

export interface SourceDocument extends GatheredDocument {
  id: string;
}

export interface ResearchTask {
  source: SourceId;
  query: string;
  purpose: string;
}

export interface ResearchPlan {
  refinedQuestion: string;
  whyTheseSources: string;
  memoryIdsToReuse: string[];
  tasks: ResearchTask[];
}

export interface Claim {
  id: string;
  text: string;
  quote: string;
  relevance: number;
  documentId: string;
}

export interface DistilledClaim {
  id: string;
  text: string;
  claimIds: string[];
  documentIds: string[];
}

export interface CitedText {
  text: string;
  sourceIds: string[];
}

export interface BriefFinding {
  heading: string;
  detail: string;
  sourceIds: string[];
}

export interface BriefReference {
  id: string;
  title: string;
  url: string;
  source: SourceId;
  cited: boolean;
  published?: string;
  authors?: string[];
}

export interface ResearchBrief {
  title: string;
  overview: string;
  keyPoints: CitedText[];
  findings: BriefFinding[];
  actionableInsights: CitedText[];
  gaps: string[];
  confidence: "low" | "medium" | "high";
  references: BriefReference[];
}

export interface MemorySnippet {
  id: string;
  query: string;
  title: string;
  overview: string;
  createdAt: string;
}

export type AgentEvent =
  | { type: "status"; message: string; at: string }
  | { type: "plan"; plan: ResearchPlan; at: string }
  | {
      type: "gather_start";
      source: SourceId;
      query: string;
      at: string;
    }
  | {
      type: "gather_done";
      source: SourceId;
      query: string;
      count: number;
      error?: string;
      at: string;
    }
  | {
      type: "documents";
      count: number;
      droppedDuplicates: number;
      at: string;
    }
  | { type: "read_done"; claims: number; at: string }
  | { type: "distill_done"; before: number; after: number; at: string }
  | { type: "brief"; brief: ResearchBrief; at: string }
  | { type: "saved"; id: string; at: string };

export interface ResearchRun {
  id: string;
  query: string;
  createdAt: string;
  plan: ResearchPlan;
  documents: SourceDocument[];
  claims: DistilledClaim[];
  brief: ResearchBrief;
  events: AgentEvent[];
}

export interface RunSummary {
  id: string;
  query: string;
  title: string;
  createdAt: string;
  confidence: ResearchBrief["confidence"];
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}
