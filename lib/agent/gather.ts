import { canonicalUrl, stamp } from "@/lib/agent/text";
import type {
  AgentEvent,
  GatheredDocument,
  ResearchTask,
  SourceDocument,
} from "@/lib/agent/types";
import { mapPool } from "@/lib/agent/pool";
import { searchSource } from "@/lib/sources";

export async function gatherTasks(
  tasks: ResearchTask[],
  signal: AbortSignal | undefined,
  onUpdate: (event: AgentEvent) => void,
): Promise<{ documents: SourceDocument[]; droppedDuplicates: number }> {
  const batches = await mapPool(tasks, 4, async (task) => {
    onUpdate({
      type: "gather_start",
      source: task.source,
      query: task.query,
      at: stamp(),
    });
    try {
      const documents = await searchSource(task.source, task.query, signal);
      onUpdate({
        type: "gather_done",
        source: task.source,
        query: task.query,
        count: documents.length,
        at: stamp(),
      });
      return documents;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Source failed.";
      onUpdate({
        type: "gather_done",
        source: task.source,
        query: task.query,
        count: 0,
        error: message,
        at: stamp(),
      });
      return [] as GatheredDocument[];
    }
  });

  return assignDocuments(batches.flat());
}

export function assignDocuments(gathered: GatheredDocument[]): {
  documents: SourceDocument[];
  droppedDuplicates: number;
} {
  const seen = new Set<string>();
  const unique: GatheredDocument[] = [];
  let droppedDuplicates = 0;
  for (const document of gathered) {
    const key = `${document.source}:${canonicalUrl(document.url)}`;
    if (seen.has(key)) {
      droppedDuplicates += 1;
      continue;
    }
    seen.add(key);
    unique.push(document);
  }

  const capped = unique.slice(0, 12);
  droppedDuplicates += unique.length - capped.length;
  return {
    droppedDuplicates,
    documents: capped.map((document, index) => ({
      ...document,
      id: `d${index + 1}`,
    })),
  };
}
