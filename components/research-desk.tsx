"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Loader2, Settings, Trash2 } from "lucide-react";

import { BriefView } from "@/components/brief-view";
import { SettingsDialog, type LlmSettings } from "@/components/settings-dialog";
import { TraceList, type DeskEvent } from "@/components/trace-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  SOURCE_CATALOG,
  SOURCE_ORDER,
  type ResearchBrief,
  type ResearchPlan,
  type ResearchRun,
  type RunSummary,
} from "@/lib/agent/types";

const STORAGE_KEY = "meridian.llm";
const EMPTY_SETTINGS: LlmSettings = { apiKey: "", baseUrl: "", model: "" };
const settingsListeners = new Set<() => void>();
let cachedSettingsRaw = "";
let cachedSettings: LlmSettings = EMPTY_SETTINGS;

function readSettingsSnapshot(): LlmSettings {
  const raw = localStorage.getItem(STORAGE_KEY) ?? "";
  if (raw === cachedSettingsRaw) return cachedSettings;
  cachedSettingsRaw = raw;
  if (!raw) {
    cachedSettings = EMPTY_SETTINGS;
    return cachedSettings;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    cachedSettings = {
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl ?? "",
      model: parsed.model ?? "",
    };
  } catch {
    cachedSettings = EMPTY_SETTINGS;
  }
  return cachedSettings;
}

function writeSettings(value: LlmSettings) {
  const raw = JSON.stringify(value);
  localStorage.setItem(STORAGE_KEY, raw);
  cachedSettingsRaw = raw;
  cachedSettings = value;
  for (const listener of settingsListeners) listener();
}

function subscribeSettings(listener: () => void) {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
}

const EXAMPLES = [
  "What is retrieval-augmented generation, and when does it help?",
  "How do language-model agents decide which tools to call, and where do they fail?",
  "What should a small team check before adopting a vector database?",
];

interface ServerConfig {
  hasServerKey: boolean;
  baseUrl: string;
  model: string;
}

export function ResearchDesk() {
  const [query, setQuery] = useState("");
  const settings = useSyncExternalStore(
    subscribeSettings,
    readSettingsSnapshot,
    () => EMPTY_SETTINGS,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [server, setServer] = useState<ServerConfig | null>(null);
  const [memory, setMemory] = useState<RunSummary[]>([]);
  const [memoryError, setMemoryError] = useState("");
  const [events, setEvents] = useState<DeskEvent[]>([]);
  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [activeQuery, setActiveQuery] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetch("/api/config")
      .then((response) => response.json())
      .then((payload: ServerConfig) => setServer(payload))
      .catch(() => undefined);
    void refreshMemory();
    return () => abortRef.current?.abort();
  }, []);

  async function refreshMemory() {
    try {
      const response = await fetch("/api/memory");
      const payload = (await response.json()) as { runs?: RunSummary[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Memory could not be loaded.");
      setMemory(payload.runs ?? []);
      setMemoryError("");
    } catch (loadError) {
      setMemoryError(loadError instanceof Error ? loadError.message : "Memory could not be loaded.");
    }
  }

  function saveSettings(next: LlmSettings) {
    writeSettings(next);
  }

  async function research() {
    const question = query.trim();
    if (question.length < 3 || phase === "running") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("running");
    setError("");
    setEvents([]);
    setBrief(null);
    setPlan(null);
    setRunId(null);
    setActiveQuery(question);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query: question,
          apiKey: settings.apiKey || undefined,
          baseUrl: settings.baseUrl || undefined,
          model: settings.model || undefined,
        }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/event-stream")) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Request failed (${response.status}).`);
      }
      if (!response.body) throw new Error("The research stream did not open.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      let sawBrief = false;
      let sawError = false;
      while (!finished) {
        const chunk = await reader.read();
        finished = chunk.done;
        buffer += decoder.decode(chunk.value ?? new Uint8Array(), { stream: !chunk.done });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const data = part
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim())
            .join("");
          if (!data) continue;
          const event = JSON.parse(data) as DeskEvent;
          setEvents((current) => [...current, event]);
          if (event.type === "plan") setPlan(event.plan);
          if (event.type === "brief") {
            sawBrief = true;
            setBrief(event.brief);
          }
          if (event.type === "saved") setRunId(event.id);
          if (event.type === "error") {
            sawError = true;
            setError(event.message);
            setPhase("error");
          }
        }
      }
      if (!sawError && !sawBrief) {
        setError("The run ended before a brief was written.");
        setPhase("error");
      } else if (!sawError) {
        setPhase("done");
      }
      await refreshMemory();
    } catch (runError) {
      if (controller.signal.aborted) return;
      setError(runError instanceof Error ? runError.message : "Research failed.");
      setPhase("error");
    }
  }

  async function openRun(id: string) {
    if (phase === "running") return;
    const response = await fetch(`/api/memory/${id}`);
    const payload = (await response.json()) as { run?: ResearchRun; error?: string };
    if (!response.ok || !payload.run) {
      setError(payload.error || "That brief could not be opened.");
      setPhase("error");
      return;
    }
    setRunId(payload.run.id);
    setActiveQuery(payload.run.query);
    setPlan(payload.run.plan);
    setBrief(payload.run.brief);
    setEvents(payload.run.events);
    setError("");
    setPhase("done");
  }

  async function removeRun(id: string) {
    if (!window.confirm("Remove this brief from memory?")) return;
    await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (runId === id) {
      setRunId(null);
      setBrief(null);
      setPlan(null);
      setEvents([]);
      setPhase("idle");
    }
    await refreshMemory();
  }

  const status = [...events].reverse().find((event) => event.type === "status");
  const modelName = settings.model || server?.model || "gpt-4o-mini";
  const needsKey = !settings.apiKey && !server?.hasServerKey;

  return (
    <div className="min-h-dvh">
      <header className="border-t-4 border-t-[oklch(0.52_0.12_42)] border-b border-b-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div>
            <p className="font-heading text-2xl leading-none tracking-tight">Meridian</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Autonomous research desk · {modelName}
            </p>
          </div>
          <Button type="button" variant="outline" onClick={() => setSettingsOpen(true)}>
            <Settings />
            Model
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="max-h-64 overflow-y-auto border-b px-4 py-4 lg:max-h-none lg:border-r lg:border-b-0 lg:sticky lg:top-0 lg:h-[calc(100dvh-4.75rem)]">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-heading text-lg">Memory</h2>
            <span className="text-xs text-muted-foreground">{memory.length}</span>
          </div>
          {memoryError ? <p className="text-sm text-destructive">{memoryError}</p> : null}
          {memory.length === 0 && !memoryError ? (
            <p className="text-sm leading-6 text-muted-foreground">
              Finished briefs stay here. A later question can reuse one when the model
              decides the topics overlap.
            </p>
          ) : null}
          <ul className="space-y-2">
            {memory.map((item) => (
              <li key={item.id}>
                <div
                  className={`rounded-lg px-2 py-2 ring-1 ring-transparent hover:bg-muted ${
                    runId === item.id ? "bg-muted ring-border" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => void openRun(item.id)}
                  >
                    <span className="block text-sm leading-5 font-medium">{item.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()} · {item.confidence}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void removeRun(item.id)}
                  >
                    <Trash2 className="size-3" />
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="px-4 py-6 md:px-6">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void research();
            }}
          >
            <label htmlFor="question" className="font-heading text-2xl">
              What should I look into?
            </label>
            <Textarea
              id="question"
              value={query}
              placeholder="Ask for a topic, a comparison, or a decision you need to make."
              className="min-h-32 bg-card text-base"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void research();
                }
              }}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="rounded-full bg-muted px-3 py-1 text-left text-xs leading-5 text-muted-foreground hover:text-foreground"
                    onClick={() => setQuery(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
              <Button type="submit" size="lg" disabled={phase === "running" || query.trim().length < 3}>
                {phase === "running" ? <Loader2 className="animate-spin" /> : null}
                {phase === "running" ? "Researching" : "Research"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {phase === "running" && status && status.type === "status"
                ? status.message
                : "The model chooses the sources, reads them, drops duplicates, and writes the brief."}
            </p>
            {needsKey ? (
              <p className="text-sm">
                <button
                  type="button"
                  className="underline underline-offset-4"
                  onClick={() => setSettingsOpen(true)}
                >
                  Add a model key
                </button>{" "}
                before the first run, or set <span className="font-mono text-xs">LLM_API_KEY</span>.
              </p>
            ) : null}
          </form>

          {runId ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<a href={`/api/export/${runId}?format=md`} />}>
                Markdown
              </Button>
              <Button variant="outline" size="sm" render={<a href={`/api/export/${runId}?format=pdf`} />}>
                PDF
              </Button>
              <Button variant="outline" size="sm" render={<a href={`/api/export/${runId}?format=trace`} />}>
                Trace
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
              {/api key|model/i.test(error) ? (
                <button
                  type="button"
                  className="ml-2 underline"
                  onClick={() => setSettingsOpen(true)}
                >
                  Open model settings
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <TraceList events={events} />
            <section className="rounded-xl bg-card px-4 py-5 ring-1 ring-foreground/10 md:px-6">
              {brief ? (
                <BriefView brief={brief} plan={plan} query={activeQuery} />
              ) : (
                <EmptyDesk />
              )}
            </section>
          </div>
        </main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        value={settings}
        serverKey={Boolean(server?.hasServerKey)}
        onSave={saveSettings}
      />
    </div>
  );
}

function EmptyDesk() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-heading text-2xl">A brief lands here after a run.</h2>
        <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground">
          It will include key points, findings, the pages those points came from, and
          actions worth taking. Nothing on this desk is a prepared answer.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SOURCE_ORDER.map((source) => (
          <Badge key={source} variant="outline" className="h-auto py-1 whitespace-normal">
            {SOURCE_CATALOG[source].label}
          </Badge>
        ))}
      </div>
      <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
        The model picks from Wikipedia, OpenAlex, arXiv, Crossref, Hacker News,
        DuckDuckGo, and MDN. Pages are fetched live, then claims that cannot be
        quoted from the page are dropped.
      </p>
    </div>
  );
}
