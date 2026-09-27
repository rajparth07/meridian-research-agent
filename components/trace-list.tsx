import { ScrollArea } from "@/components/ui/scroll-area";
import { SOURCE_CATALOG, type AgentEvent } from "@/lib/agent/types";

export type DeskEvent = AgentEvent | { type: "error"; message: string; at: string };

export function TraceList({ events }: { events: DeskEvent[] }) {
  return (
    <div className="flex h-full min-h-80 flex-col rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="border-b px-4 py-3">
        <h2 className="font-heading text-lg">Agent trace</h2>
        <p className="text-xs text-muted-foreground">Plan, retrieval, and what was kept.</p>
      </div>
      <ScrollArea className="h-80 xl:h-[calc(100dvh-14rem)]">
        <ol className="space-y-3 px-4 py-4">
          {events.length === 0 ? (
            <li className="text-sm leading-6 text-muted-foreground">
              The trace appears once a run starts. It shows which sources the model
              picked, what came back, and how many claims survived distillation.
            </li>
          ) : (
            events.map((event, index) => (
              <li key={`${event.at}-${event.type}-${index}`} className="text-sm leading-5">
                <div className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                  {event.at.slice(11, 19)} · {labelFor(event)}
                </div>
                <p className={event.type === "error" ? "text-destructive" : ""}>
                  {bodyFor(event)}
                </p>
              </li>
            ))
          )}
        </ol>
      </ScrollArea>
    </div>
  );
}

function labelFor(event: DeskEvent): string {
  switch (event.type) {
    case "gather_start":
    case "gather_done":
      return SOURCE_CATALOG[event.source].label;
    case "error":
      return "Stopped";
    default:
      return event.type.replaceAll("_", " ");
  }
}

function bodyFor(event: DeskEvent): string {
  switch (event.type) {
    case "status":
      return event.message;
    case "plan":
      return `${event.plan.whyTheseSources} Tasks: ${event.plan.tasks
        .map((task) => `${SOURCE_CATALOG[task.source].label} “${task.query}”`)
        .join("; ")}.`;
    case "gather_start":
      return `Searching “${event.query}”.`;
    case "gather_done":
      return event.error
        ? event.error
        : `${event.count} document${event.count === 1 ? "" : "s"} for “${event.query}”.`;
    case "documents":
      return `${event.count} unique documents. ${event.droppedDuplicates} duplicates removed.`;
    case "read_done":
      return `${event.claims} grounded claim${event.claims === 1 ? "" : "s"}.`;
    case "distill_done":
      return `${event.before} claims merged into ${event.after}.`;
    case "brief":
      return `Brief ready: ${event.brief.title}.`;
    case "saved":
      return "Saved to memory.";
    case "error":
      return event.message;
  }
}
