# Meridian

Meridian is an autonomous research agent for Assessment Option 1. You give it a question. A language model decides which public sources to open, those sources are read in parallel, duplicate and unquoted material is removed, and the model writes a brief with key points, findings, references, and actions.

The brief is not a template. If the model cannot ground a claim in text that was actually fetched, that claim is dropped. If nothing usable comes back, the run stops with an error instead of inventing an answer.

## What you need

- Node.js 20 or newer
- An OpenAI-compatible chat completions API

Any of these work:

| Provider | Base URL | Example model |
| --- | --- | --- |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| Ollama (local) | `http://127.0.0.1:11434/v1` | `llama3.1` |

Ollama accepts any non-empty key. Use `ollama`.

## Install

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set `LLM_API_KEY`. You can also leave the file empty and paste the key in the Model dialog after the app starts. A key typed in the browser stays in `localStorage` and is not written into research memory.

## Run the desk

```bash
npm run dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

Type a question and press Research. The trace shows the plan, each source, how many duplicates were removed, and how many claims survived. When the brief is saved you can download Markdown, PDF, or the full trace.

Earlier briefs stay in the Memory column. On a later question the model sees their titles and overviews and may reuse one as background.

## Run from the terminal

```bash
npm run research -- "What is retrieval-augmented generation, and when does it help?"
```

The saved brief is in `data/memory.json`. With the desk running, download it from `/api/export/<id>?format=md`, `format=pdf`, or `format=trace`.

## Check the wiring

```bash
npm run check
```

This checks URL safety, duplicate removal, the source parsers, a full agent loop driven by a stub model, and live calls to Wikipedia and OpenAlex. The stub loop is a test of the pipeline. It is not a research result.

```bash
npm run sample
```

Writes `docs/samples/live-source-gather.json`, a labeled log of live retrieval for one query.

## How a run works

1. **Recall.** Recent briefs are loaded from `data/memory.json`.
2. **Plan.** The model picks sources and writes a search query for each. It does not answer the question at this step.
3. **Gather.** The chosen sources are fetched at the same time. Repeated URLs are removed.
4. **Read.** The model extracts claims. A claim is kept only when its quote appears in the fetched text.
5. **Distill.** The model merges claims that say the same thing and drops the rest.
6. **Brief.** The model writes key points, findings, actions, and gaps. Citations that do not match a fetched document are removed.
7. **Remember.** The brief, plan, documents, and trace are stored.

Sources the model can choose:

- Wikipedia
- OpenAlex
- arXiv
- Crossref
- Hacker News
- DuckDuckGo (open web)
- MDN

Private network addresses are not fetched.

## Project layout

```
app/api/research/route.ts     streaming run
app/api/memory/               saved briefs
app/api/export/[id]/route.ts  markdown, pdf, trace
lib/agent/                    plan, read, distill, brief, memory
lib/sources/                  live source adapters
components/                   research desk
docs/                         diagram, write-up, sample gather
```

## Production build

```bash
npm run build
npm start
```

`npm start` serves the production build on port 3847.
