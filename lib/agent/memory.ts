import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { MemorySnippet, ResearchRun, RunSummary } from "@/lib/agent/types";

interface Store {
  runs: ResearchRun[];
}

let chain: Promise<unknown> = Promise.resolve();

function exclusive<T>(work: () => T): Promise<T> {
  const run = chain.then(work, work);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function storePath(): string {
  const dir = process.env.MERIDIAN_DATA_DIR ?? path.join(process.cwd(), "data");
  return path.join(dir, "memory.json");
}

function readStore(): Store {
  try {
    const parsed = JSON.parse(readFileSync(storePath(), "utf8")) as Store;
    return { runs: Array.isArray(parsed.runs) ? parsed.runs : [] };
  } catch {
    return { runs: [] };
  }
}

function writeStore(store: Store): void {
  const file = storePath();
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(store));
  renameSync(temporary, file);
}

export function listRuns(limit = 30): Promise<RunSummary[]> {
  return exclusive(() =>
    readStore()
      .runs.slice(0, limit)
      .map((run) => ({
        id: run.id,
        query: run.query,
        title: run.brief.title,
        createdAt: run.createdAt,
        confidence: run.brief.confidence,
      })),
  );
}

export function listMemory(limit = 8): Promise<MemorySnippet[]> {
  return exclusive(() =>
    readStore()
      .runs.slice(0, limit)
      .map((run) => ({
        id: run.id,
        query: run.query,
        title: run.brief.title,
        overview: run.brief.overview,
        createdAt: run.createdAt,
      })),
  );
}

export function getRun(id: string): Promise<ResearchRun | null> {
  return exclusive(() => readStore().runs.find((run) => run.id === id) ?? null);
}

export function saveRun(run: ResearchRun): Promise<void> {
  return exclusive(() => {
    const store = readStore();
    store.runs = [run, ...store.runs.filter((item) => item.id !== run.id)].slice(0, 50);
    writeStore(store);
  });
}

export function deleteRun(id: string): Promise<boolean> {
  return exclusive(() => {
    const store = readStore();
    const next = store.runs.filter((run) => run.id !== id);
    const removed = next.length !== store.runs.length;
    if (removed) writeStore({ runs: next });
    return removed;
  });
}
