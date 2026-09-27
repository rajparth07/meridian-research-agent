# Write-up — Assessment Option 1

## Domain and goal

Autonomous Research Agent. The goal is open-domain research: accept a question, collect information from external sources, remove duplicate and irrelevant material, and return a structured brief with key points, findings, references, and actionable insights.

The agent is not tied to one subject. The same loop handles a technical question, a product question, or a “what should we do” question. The model decides which of the available sources fit.

## Design decisions

The loop is a small sequence of model calls with tools around them, rather than a single prompt that is asked to “search and summarize.”

- **Source choice is a model decision.** The planner receives a catalog (Wikipedia, OpenAlex, arXiv, Crossref, Hacker News, DuckDuckGo, MDN) and returns the tasks it wants. Code does not keyword-match the question onto a source.
- **Gathering is parallel.** Selected tasks run together. One failed source does not cancel the others.
- **Reading is grounded.** The reader may only emit a claim with a quote that actually occurs in the fetched document. This is the main guard against a fluent but unsupported brief.
- **Distillation is a model step.** Duplicate and off-topic claims are merged or dropped by the model, not by a hand-written topic taxonomy. Exact URL duplicates are removed before that step so the model is not asked to read the same page twice.
- **The brief cannot invent citations.** After the model writes the brief, any source id that was not in the fetched set is stripped. A section that loses every citation is dropped. If that leaves the brief empty, the run fails and the model is asked once more.
- **Memory is prior research, not a script.** Saved briefs are shown to the planner. The model may name one to reuse. Its overview is then background for the new brief and is not cited as a fresh source.
- **Exports are the same object the desk shows.** Markdown and PDF are rendered from the saved run, including the source-selection note, so a reviewer can see why those sources were opened.

The desk streams each stage so a run is inspectable while it is happening. The trace download is the submission log for a real question.

## Assumptions

- The person running Meridian supplies an OpenAI-compatible model key (OpenAI, Groq, OpenRouter, or a local Ollama server). There is no hidden key and no fallback paragraph.
- External data comes from the public endpoints above at request time. There is no bundled corpus and no mock answer for a research question.
- English-language pages are the practical target. The PDF font drops characters outside Latin-1.
- One person uses the local memory file. It is not a multi-user store.
- A page that requires a login, or that only renders in a browser, will contribute little or nothing. The web adapter uses the readable text of the response.

## What is not a research result

`npm run check` includes one full loop driven by a stub model and a fixed sentence, so the pipeline can be tested without an API key. That path is not used by the desk. `docs/samples/live-source-gather.json` is a labeled log of live retrieval only. A brief for the submission form should be a Trace download from a real run.

## Limitations

- Quality tracks the model. A small local model may return plans or JSON that fail the schema. The call is retried once with the parse error, then the run stops.
- DuckDuckGo’s HTML results are an unofficial page and can change or block the client. When a result page cannot be read, the adapter keeps the search snippet if it is long enough.
- arXiv, OpenAlex, and Crossref are stronger for research topics than for breaking news. The planner is told that, and it can choose the web or Hacker News instead.
- The quote check is strict. A true paraphrase with no copied span is discarded. That misses some valid readings and keeps unsupported ones out.
- Memory has no embedding index. Reuse depends on the planner reading the short overviews of recent briefs.
- There is no human approval step. A research brief is not an irreversible action, so the run completes on its own.
- Rate limits on the public APIs or the model provider will surface as errors in the trace.
- This is a single-process local app. It is not deployed with authentication, quotas, or a job queue.

## Production readiness

It is ready to demonstrate the assessment goal: an agent that chooses sources, reads them, and writes a sourced brief with a visible trace. It is not ready as a shared research product. Before that it would need per-user memory, retries with backoff on the public APIs, a rendered-page fallback for script-only sites, and a review step when a brief will be sent outside the desk.
