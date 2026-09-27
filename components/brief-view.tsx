import { Badge } from "@/components/ui/badge";
import { SOURCE_CATALOG, type ResearchBrief, type ResearchPlan } from "@/lib/agent/types";

export function BriefView({
  brief,
  plan,
  query,
}: {
  brief: ResearchBrief;
  plan: ResearchPlan | null;
  query: string;
}) {
  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={brief.confidence === "low" ? "outline" : "secondary"}>
            Confidence {brief.confidence}
          </Badge>
          <span className="text-xs tracking-wide text-muted-foreground uppercase">
            Research brief
          </span>
        </div>
        <h2 className="font-heading text-3xl leading-tight font-medium text-balance">
          {brief.title}
        </h2>
        <p className="text-sm text-muted-foreground">{query}</p>
      </header>

      <section className="space-y-2">
        <h3 className="font-heading text-xl">Overview</h3>
        <p className="max-w-3xl text-[15px] leading-7">{brief.overview}</p>
      </section>

      <section className="space-y-3">
        <h3 className="font-heading text-xl">Key points</h3>
        <ol className="space-y-3">
          {brief.keyPoints.map((point, index) => (
            <li key={`${point.text}-${index}`} className="flex gap-3 text-[15px] leading-6">
              <span className="mt-0.5 font-mono text-xs text-muted-foreground">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                {point.text} <Citations ids={point.sourceIds} />
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h3 className="font-heading text-xl">Findings</h3>
        {brief.findings.map((finding) => (
          <div key={finding.heading} className="space-y-1 border-t border-border pt-3">
            <h4 className="font-medium">{finding.heading}</h4>
            <p className="max-w-3xl text-[15px] leading-7 text-foreground/90">
              {finding.detail} <Citations ids={finding.sourceIds} />
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl bg-accent/70 px-4 py-4">
        <h3 className="font-heading text-xl">Actionable insights</h3>
        {brief.actionableInsights.length === 0 ? (
          <p className="text-sm text-muted-foreground">None drawn from the sources.</p>
        ) : (
          <ul className="space-y-2">
            {brief.actionableInsights.map((insight) => (
              <li key={insight.text} className="text-[15px] leading-6">
                {insight.text} <Citations ids={insight.sourceIds} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-heading text-xl">Gaps</h3>
        {brief.gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No specific gap was flagged.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-[15px] leading-6">
            {brief.gaps.map((gap) => (
              <li key={gap}>{gap}</li>
            ))}
          </ul>
        )}
      </section>

      {plan ? (
        <section className="space-y-2">
          <h3 className="font-heading text-xl">Why these sources</h3>
          <p className="max-w-3xl text-[15px] leading-7">{plan.whyTheseSources}</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {plan.tasks.map((task) => (
              <li key={`${task.source}-${task.query}`}>
                <span className="text-foreground">{SOURCE_CATALOG[task.source].label}</span>
                {" · "}
                {task.query}
                {" — "}
                {task.purpose}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="font-heading text-xl">References</h3>
        <ol className="space-y-3">
          {brief.references.map((reference) => (
            <li id={`ref-${reference.id}`} key={reference.id} className="text-sm leading-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-muted-foreground">{reference.id}</span>
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  {reference.title}
                </a>
                <Badge variant={reference.cited ? "secondary" : "outline"}>
                  {reference.cited ? "Cited" : "Consulted"}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {SOURCE_CATALOG[reference.source].label}
                {reference.published ? ` · ${reference.published}` : ""}
                {reference.authors?.length
                  ? ` · ${reference.authors.slice(0, 3).join(", ")}`
                  : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function Citations({ ids }: { ids: string[] }) {
  return (
    <span className="whitespace-nowrap">
      {ids.map((id) => (
        <a
          key={id}
          href={`#ref-${id}`}
          className="ml-1 font-mono text-[11px] text-primary underline-offset-2 hover:underline"
        >
          {id}
        </a>
      ))}
    </span>
  );
}
