import { AgentError } from "@/lib/agent/config";
import { writeBrief } from "@/lib/agent/briefer";
import { distillClaims } from "@/lib/agent/distiller";
import { assignDocuments, gatherTasks } from "@/lib/agent/gather";
import { completeJson, type CompleteJson } from "@/lib/agent/llm";
import { listMemory, saveRun } from "@/lib/agent/memory";
import { planResearch } from "@/lib/agent/planner";
import { readDocuments } from "@/lib/agent/reader";
import { stamp } from "@/lib/agent/text";
import type {
  AgentEvent,
  GatheredDocument,
  LlmConfig,
  ResearchRun,
  ResearchTask,
} from "@/lib/agent/types";

export interface RunOptions {
  query: string;
  llm: LlmConfig;
  signal?: AbortSignal;
  complete?: CompleteJson;
  gather?: (
    tasks: ResearchTask[],
    signal: AbortSignal | undefined,
    onUpdate: (event: AgentEvent) => void,
  ) => Promise<GatheredDocument[]>;
}

export function runResearch(options: RunOptions): AsyncGenerator<AgentEvent, ResearchRun> {
  return streamEvents((emit) => execute(options, emit));
}

async function execute(
  options: RunOptions,
  emit: (event: AgentEvent) => void,
): Promise<ResearchRun> {
  const events: AgentEvent[] = [];
  const record = (event: AgentEvent) => {
    events.push(event);
    emit(event);
  };

  const query = options.query.trim();
  if (query.length < 3) {
    throw new AgentError("Ask a question of at least a few words.");
  }
  if (query.length > 2000) {
    throw new AgentError("Keep the question under 2000 characters.");
  }

  const complete = options.complete ?? completeJson;
  record({ type: "status", message: "Checking memory for overlapping briefs.", at: stamp() });
  const memory = await listMemory(8);

  record({
    type: "status",
    message: "Asking the model which sources fit this question.",
    at: stamp(),
  });
  const plan = await planResearch({
    llm: options.llm,
    query,
    memory,
    complete,
    signal: options.signal,
  });
  record({ type: "plan", plan, at: stamp() });

  const reused = memory.filter((item) => plan.memoryIdsToReuse.includes(item.id));
  if (reused.length) {
    record({
      type: "status",
      message: `Reusing ${reused.length} earlier brief${reused.length === 1 ? "" : "s"} as background.`,
      at: stamp(),
    });
  }

  record({
    type: "status",
    message: "Gathering from the selected sources in parallel.",
    at: stamp(),
  });
  const gathered = options.gather
    ? await options.gather(plan.tasks, options.signal, record)
    : null;
  const packed = options.gather
    ? assignDocuments(gathered ?? [])
    : await gatherTasks(plan.tasks, options.signal, record);
  const { documents, droppedDuplicates } = packed;

  record({
    type: "documents",
    count: documents.length,
    droppedDuplicates,
    at: stamp(),
  });
  if (documents.length === 0) {
    throw new AgentError(
      "The selected sources returned nothing usable. Try a more specific question.",
    );
  }

  record({
    type: "status",
    message: `Reading ${documents.length} document${documents.length === 1 ? "" : "s"} and keeping only grounded claims.`,
    at: stamp(),
  });
  const claims = await readDocuments({
    llm: options.llm,
    question: plan.refinedQuestion,
    documents,
    complete,
    signal: options.signal,
    onDocument: (document) => {
      record({
        type: "status",
        message: `Reading ${document.id}: ${document.title}`,
        at: stamp(),
      });
    },
  });
  record({ type: "read_done", claims: claims.length, at: stamp() });
  if (claims.length === 0) {
    throw new AgentError(
      "None of the retrieved pages contained a claim the model could ground in the text.",
    );
  }

  record({
    type: "status",
    message: "Merging duplicate claims and dropping what does not answer the question.",
    at: stamp(),
  });
  const distilled = await distillClaims({
    llm: options.llm,
    question: plan.refinedQuestion,
    claims,
    complete,
    signal: options.signal,
  });
  record({
    type: "distill_done",
    before: claims.length,
    after: distilled.length,
    at: stamp(),
  });

  record({ type: "status", message: "Writing the brief from the distilled claims.", at: stamp() });
  const brief = await writeBrief({
    llm: options.llm,
    query,
    question: plan.refinedQuestion,
    claims: distilled,
    documents,
    memory: reused,
    complete,
    signal: options.signal,
  });
  record({ type: "brief", brief, at: stamp() });

  const run: ResearchRun = {
    id: crypto.randomUUID(),
    query,
    createdAt: stamp(),
    plan,
    documents,
    claims: distilled,
    brief,
    events,
  };
  const saved: AgentEvent = { type: "saved", id: run.id, at: stamp() };
  events.push(saved);
  await saveRun(run);
  emit(saved);
  return run;
}

function streamEvents(
  work: (emit: (event: AgentEvent) => void) => Promise<ResearchRun>,
): AsyncGenerator<AgentEvent, ResearchRun> {
  const queue: AgentEvent[] = [];
  let finished = false;
  let failure: unknown = null;
  let result: ResearchRun | null = null;
  let wake: (() => void) | null = null;

  const emit = (event: AgentEvent) => {
    queue.push(event);
    wake?.();
    wake = null;
  };

  const pending = work(emit).then(
    (run) => {
      result = run;
      finished = true;
      wake?.();
    },
    (error: unknown) => {
      failure = error;
      finished = true;
      wake?.();
    },
  );

  return (async function* () {
    while (!finished || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        continue;
      }
      yield queue.shift() as AgentEvent;
    }
    await pending;
    if (failure) throw failure;
    if (!result) throw new AgentError("Research ended without a brief.");
    return result;
  })();
}
