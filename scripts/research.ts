import { resolveLlmConfig } from "@/lib/agent/config";
import { runResearch } from "@/lib/agent/orchestrator";
import { loadEnv } from "./load-env";

async function main(): Promise<void> {
  loadEnv();

  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: npm run research -- "your question"');
    process.exit(1);
  }

  const llm = resolveLlmConfig();
  console.error(`Model: ${llm.model}`);

  for await (const event of runResearch({ query, llm })) {
    if (event.type === "status") console.error(`• ${event.message}`);
    else if (event.type === "plan") {
      console.error(`• Sources: ${event.plan.tasks.map((task) => task.source).join(", ")}`);
      console.error(`  ${event.plan.whyTheseSources}`);
    } else if (event.type === "gather_done") {
      console.error(
        event.error
          ? `• ${event.source} failed: ${event.error}`
          : `• ${event.source} returned ${event.count}`,
      );
    } else if (event.type === "brief") {
      console.log(`\n# ${event.brief.title}\n`);
      console.log(event.brief.overview);
      console.log("\nKey points:");
      for (const point of event.brief.keyPoints) {
        console.log(`- ${point.text} [${point.sourceIds.join(", ")}]`);
      }
    } else if (event.type === "saved") {
      console.error(`\nSaved ${event.id}`);
      console.error(`Markdown: /api/export/${event.id}?format=md`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
