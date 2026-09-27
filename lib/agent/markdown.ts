import { SOURCE_CATALOG, type ResearchRun } from "@/lib/agent/types";

export function briefToMarkdown(run: ResearchRun): string {
  const lines: string[] = [
    `# ${run.brief.title}`,
    "",
    `**Question:** ${run.query}`,
    "",
    `**Confidence:** ${run.brief.confidence}`,
    "",
    `**Generated:** ${run.createdAt}`,
    "",
    "## Overview",
    "",
    run.brief.overview,
    "",
    "## Key points",
    "",
    ...run.brief.keyPoints.map(
      (point, index) =>
        `${index + 1}. ${point.text} ${cite(point.sourceIds)}`,
    ),
    "",
    "## Findings",
    "",
  ];

  for (const finding of run.brief.findings) {
    lines.push(`### ${finding.heading}`, "", `${finding.detail} ${cite(finding.sourceIds)}`, "");
  }

  lines.push("## Actionable insights", "");
  if (run.brief.actionableInsights.length === 0) {
    lines.push("None drawn from the sources.", "");
  } else {
    for (const insight of run.brief.actionableInsights) {
      lines.push(`- ${insight.text} ${cite(insight.sourceIds)}`);
    }
    lines.push("");
  }

  lines.push("## Gaps", "");
  if (run.brief.gaps.length === 0) {
    lines.push("The model did not flag a specific gap.", "");
  } else {
    for (const gap of run.brief.gaps) lines.push(`- ${gap}`);
    lines.push("");
  }

  lines.push("## References", "");
  for (const reference of run.brief.references) {
    const meta = [
      SOURCE_CATALOG[reference.source].label,
      reference.published,
      reference.authors?.slice(0, 3).join(", "),
      reference.cited ? "cited" : "consulted",
    ]
      .filter(Boolean)
      .join(" · ");
    lines.push(`- [${reference.id}] [${reference.title}](${reference.url}) — ${meta}`);
  }

  lines.push(
    "",
    "## How this was researched",
    "",
    run.plan.whyTheseSources,
    "",
    `Refined question: ${run.plan.refinedQuestion}`,
    "",
  );
  for (const task of run.plan.tasks) {
    lines.push(`- **${task.source}** \`${task.query}\` — ${task.purpose}`);
  }
  lines.push("");
  return lines.join("\n");
}

function cite(ids: string[]): string {
  return ids.map((id) => `[${id}]`).join("");
}
