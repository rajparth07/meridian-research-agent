import { asRecord, asString } from "@/lib/agent/json";
import type { CompleteJson } from "@/lib/agent/llm";
import {
  SOURCE_CATALOG,
  SOURCE_ORDER,
  isSourceId,
  type LlmConfig,
  type MemorySnippet,
  type ResearchPlan,
  type ResearchTask,
} from "@/lib/agent/types";

export async function planResearch(input: {
  llm: LlmConfig;
  query: string;
  memory: MemorySnippet[];
  complete: CompleteJson;
  signal?: AbortSignal;
}): Promise<ResearchPlan> {
  const catalog = SOURCE_ORDER.map(
    (id) => `- ${id}: ${SOURCE_CATALOG[id].description}`,
  ).join("\n");
  const memoryBlock = input.memory.length
    ? input.memory
        .map(
          (item) =>
            `- id: ${item.id}\n  query: ${item.query}\n  title: ${item.title}\n  overview: ${item.overview}`,
        )
        .join("\n")
    : "None.";

  const knownIds = new Set(input.memory.map((item) => item.id));

  return input.complete(
    input.llm,
    `You are the planning desk of Meridian, a research agent.
You do not answer the user's question. You decide how to research it.

Choose only from these sources:
${catalog}

Plan requirements:
- Select the sources that fit this question. Use more than one source when they would contribute different kinds of evidence.
- Each task needs its own short search query, not a copy of the full user paragraph.
- memory_ids_to_reuse may list ids from the prior-brief section only when a prior brief materially overlaps. Otherwise use an empty array.
- Do not invent source names.

Return one JSON object:
{
  "refined_question": "one precise question",
  "why_these_sources": "why this set of sources fits",
  "memory_ids_to_reuse": [],
  "tasks": [
    { "source": "wikipedia", "query": "search words", "purpose": "what this task should add" }
  ]
}`,
    `Question:\n${input.query}\n\nPrior briefs:\n${memoryBlock}`,
    (value) => parsePlan(value, knownIds),
    input.signal,
  );
}

function parsePlan(value: unknown, knownIds: Set<string>): ResearchPlan {
  const record = asRecord(value);
  const tasks: ResearchTask[] = [];
  const rawTasks = Array.isArray(record.tasks) ? record.tasks : [];
  for (const item of rawTasks) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const task = item as Record<string, unknown>;
    const source = typeof task.source === "string" ? task.source : "";
    if (!isSourceId(source)) continue;
    if (typeof task.query !== "string" || typeof task.purpose !== "string") continue;
    const query = task.query.trim().slice(0, 300);
    const purpose = task.purpose.trim().slice(0, 400);
    if (!query || !purpose) continue;
    tasks.push({ source, query, purpose });
    if (tasks.length === 6) break;
  }
  if (tasks.length === 0) {
    throw new Error("The plan did not include a usable source task.");
  }

  const memoryIds = Array.isArray(record.memory_ids_to_reuse)
    ? record.memory_ids_to_reuse
        .filter((id): id is string => typeof id === "string" && knownIds.has(id))
        .slice(0, 3)
    : [];

  return {
    refinedQuestion: asString(record.refined_question, "refined_question").slice(0, 500),
    whyTheseSources: asString(record.why_these_sources, "why_these_sources").slice(0, 800),
    memoryIdsToReuse: memoryIds,
    tasks,
  };
}
