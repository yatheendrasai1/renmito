# Renmito Intelligence Service

A lightweight FastAPI microservice that provides AI capabilities to the Renmito backend. It accepts structured requests from the Node/Express backend, calls Google Gemini, and returns structured responses.

## Overview

The Intelligence service sits between the Renmito backend and the Gemini API. It handles three distinct AI tasks:

- **Log parsing** — converts a user's free-text diary entry into structured `TimeLog` items
- **Chat (Renni)** — answers questions about the user's day or creates logs from conversational input
- **Food insight** — analyses food-related prompts and returns a plain-text analysis

```
Angular Frontend
      │
      ▼
Node/Express Backend  ──(X-IC-Secret)──▶  Intelligence Service  ──▶  Gemini API
```

---

## Quick Start

```bash
cd intelligence
pip install -r requirements.txt

# Copy and fill in your env
cp .env.example .env   # set GEMINI_API_KEY (passed per-request) and IC_INTERNAL_SECRET

uvicorn app.main:app --reload --port 8000
```

Health check:
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `IC_INTERNAL_SECRET` | Recommended | Shared secret the Node backend sends as `X-IC-Secret`. Leave empty to skip auth in local dev. |
| `PORT` | Production | Port for the Procfile `uvicorn` process. |

> The Gemini API key is **not** stored server-side — it is passed in each request body as `apiKey` so each user authenticates with their own key.

---

## Authentication

All three endpoints require the `X-IC-Secret` header to match the `IC_INTERNAL_SECRET` env var. Requests without it (or with the wrong value) receive `401 Unauthorized`.

When `IC_INTERNAL_SECRET` is unset the check is skipped — useful for local development.

---

## API Reference

### `POST /parse-log`

Parses a free-text user input into one or more structured `TimeLog` entries.

**Request**

```json
{
  "apiKey": "<Gemini API key>",
  "date": "2026-05-28",
  "userInput": "woke up at 7, had standup 9-9:30, deep work till noon",
  "logTypes": [
    { "id": "abc123", "name": "Wake Up", "domain": "health" },
    { "id": "def456", "name": "Meeting", "domain": "work" }
  ],
  "promptTemplate": null
}
```

`promptTemplate` is optional — if provided it overrides the default `prompts/parse_log.txt` template.

**Response** — array of `ParsedLogItem`

```json
[
  {
    "logTypeId": "abc123",
    "logTypeName": "Wake Up",
    "domain": "health",
    "entryType": "point",
    "pointTime": "07:00",
    "startTime": null,
    "endTime": null,
    "title": "Wake Up",
    "priority": null,
    "ticketId": null,
    "satisfactoryScore": null,
    "collaborators": null,
    "crucialPerson": null
  }
]
```

| Field | Type | Description |
|---|---|---|
| `entryType` | `"point" \| "range"` | Point logs have `pointTime`; range logs have `startTime` + `endTime` |
| `priority` | `"High" \| "Medium" \| "Low" \| null` | Only populated if the user mentioned it |
| `ticketId` | `string \| null` | Ticket identifier if mentioned |
| `satisfactoryScore` | `int (1–10) \| null` | Self-reported satisfaction if mentioned |
| `collaborators` | `string[] \| null` | Names of collaborators if mentioned |
| `crucialPerson` | `"Yes" \| "No" \| "Shared" \| null` | Whether a specific person was key |

---

### `POST /chat`

Conversational interface for Renni, Renmito's AI assistant. Returns either a plain-text answer or a set of log items to create.

**Request**

```json
{
  "apiKey": "<Gemini API key>",
  "date": "2026-05-28",
  "message": "Log a 30-minute run I did this morning",
  "logTypes": [...],
  "logsContext": "<serialised summary of today's existing logs>",
  "promptTemplate": null
}
```

**Response**

```json
{ "type": "answer", "text": "You've had a productive morning!", "logs": null }
```
or
```json
{ "type": "logs", "text": null, "logs": [ { ...ParsedLogItem } ] }
```

When `type` is `"logs"` the backend creates those `TimeLog` entries. When it is `"answer"` the text is displayed to the user.

---

### `POST /food-insight`

Passes a system prompt and user prompt directly to Gemini and returns the raw text analysis. Used for food-related AI features.

**Request**

```json
{
  "apiKey": "<Gemini API key>",
  "systemPrompt": "You are a nutrition expert...",
  "userPrompt": "I had oats, banana, and black coffee for breakfast."
}
```

**Response**

```json
{ "analysis": "Your breakfast provides roughly 400 kcal..." }
```

---

## Architecture

### Layers

```
routes/          HTTP handlers — validate input, delegate to services, map errors
services/        Business logic
  parse_service      build prompt → call Gemini → extract JSON → resolve log types
  chat_service       build prompt → call Gemini → return answer or parsed logs
  food_insight_service  concatenate prompts → call Gemini → return text
  gemini_client      async HTTP to Gemini 2.5 Flash Lite, error normalisation
  prompt_library     load & interpolate {{placeholder}} templates from prompts/
  ai_utils           JSON extraction + repair, log-type fuzzy matching
schemas/         Pydantic models for request/response validation
core/            Config (pydantic-settings) and auth middleware
prompts/         Prompt template .txt files (parse_log.txt, chat_renni.txt, …)
```

### Gemini model

All calls use `gemini-2.5-flash-lite` with:
- `maxOutputTokens: 8192`
- `temperature: 0.1` — low temperature keeps JSON output deterministic

### JSON repair

Gemini responses are sometimes truncated at `MAX_TOKENS`. `ai_utils.extract_json` strips markdown fences, finds the JSON block, and — on parse failure — attempts structural repair by walking bracket depth to find the last coherent position, then closing any open arrays/objects. If repair fails, a `502 PARSE_ERROR` is raised with a user-friendly message.

### Log-type resolution

Gemini returns `logTypeId` and `logTypeName` strings. `resolve_log_type` fuzzy-matches these against the caller-supplied `logTypes` list in priority order:
1. Exact `id` match
2. Exact name match (case-insensitive)
3. Substring name match

If nothing matches, a `422 UNRECOGNISED_TYPE` error is returned.

---

## Error Codes

| Code | Status | Meaning |
|---|---|---|
| `GEMINI_API_ERROR` | 502 / 429 / 503 | Gemini returned an error or was unreachable |
| `PARSE_ERROR` | 502 | Gemini returned output that couldn't be parsed as JSON |
| `UNRECOGNISED_TYPE` | 422 | A log type in the AI response didn't match any provided type |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Deployment

The service is deployed as a separate Heroku-style process alongside the main Node backend. The `Procfile` starts it with:

```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

The Node backend communicates with it using the `IC_INTERNAL_SECRET` shared header. The intelligence service URL is configured in the Node environment.

---

## Adding a New Endpoint

1. Add a Pydantic request/response schema in `app/schemas/`
2. Write the service logic in `app/services/`
3. Add a prompt template to `prompts/` if needed
4. Create a route in `app/routes/` using `verify_internal_secret` as a dependency
5. Register the router in `app/main.py`
