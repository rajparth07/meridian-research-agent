# Submission checklist

Use this when filling the assessment form. Do not invent the phone number or the hours.

| Field | What to enter |
| --- | --- |
| Full name | Parth Raj |
| Email address | parthraj9310@gmail.com |
| Phone number | Your phone number |
| Role | Agentic AI Engineer Intern |
| GitHub repo / code link | The GitHub repository created from this project |
| Upload code | This repository, if the form asks for a zip and you are not using GitHub |
| Architecture diagram | `docs/architecture.svg` (or `docs/architecture.png` if the form rejects SVG) |
| Sample run transcripts / logs | A Trace JSON downloaded from a finished run, plus `docs/samples/live-source-gather.json` |
| Write-up | `docs/WRITEUP.md` |
| Domain / goal | Assessment Option 1 — Autonomous Research Agent. Open-domain research: the agent accepts a question, chooses live public sources, and writes a structured brief. |
| Assumptions or mock data | Live public sources only (Wikipedia, OpenAlex, arXiv, Crossref, Hacker News, DuckDuckGo, MDN). No mock corpus and no canned answers. An OpenAI-compatible model key is required for the reasoning steps. `npm run check` uses a stub model only to test the pipeline; that path is not the desk. |
| Total time spent | The hours you actually spent |
| Confirmation | I confirm |

Option 2 and Option 3 fields (test traces, precision/recall, monitoring report) are for the other assessments. Leave them empty.

## Files to upload

- Architecture: `docs/architecture.svg`
- Retrieval log: `docs/samples/live-source-gather.json`
- Design write-up: `docs/WRITEUP.md`
- After one real question in the desk: the Trace download (`/api/export/<id>?format=trace`)

## Before you submit

1. `npm install`
2. Put your model key in `.env.local` or in the Model dialog.
3. `npm run dev` and run one question you care about.
4. Download Markdown or PDF and the Trace.
5. Publish the repository. The commits in this project are authored by Parth Raj so the contributor list stays yours.
