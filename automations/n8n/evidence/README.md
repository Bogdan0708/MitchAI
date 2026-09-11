# n8n execution evidence

This directory contains **execution evidence**, not just sanitised exports:
proof that two of the eight workflow files in `automations/n8n/` were
actually imported into a real n8n instance and run against synthetic
webhook payloads and a fixture-backed `mcp-server` (see
`automations/n8n/mock-mcp/`). This responds to audit finding 9, which
noted the previous "implementation evidence" claim rested only on a JSON
parse/sanitizer test, not an execution trace.

## Environment

- n8n image: `n8nio/n8n:latest`, resolved to **version 2.38.7** at capture
  time (2026-09-11). This is materially newer than the n8n the workflows
  were originally authored against (the repo's own README previously said
  "n8n 1.x"); see "Compatibility notes" below for what that surfaced.
- Postgres 16 (`postgres:16-alpine`) as n8n's backing DB, per
  `docker-compose.yml`.
- `mcp-server`: `automations/n8n/mock-mcp/server.js`, a zero-dependency
  Node HTTP server, run via the `n8n-demo` Compose profile.
- Brought up with:
  ```bash
  docker compose --profile n8n-demo up -d postgres mcp-server n8n
  ```
  (`POSTGRES_PASSWORD`, `N8N_USER`, `N8N_PASSWORD` set in `.env`.)

## daily-operations.json — real webhook, no substitution needed

This workflow's webhook registered normally. It was imported, activated,
and called directly over HTTP:

```bash
# Node IDs in the committed export are "REDACTED" by scripts/strip-credentials.mjs
# (privacy scrub for the public repo); n8n's workflow_entity/node schema requires
# unique, non-null ids, so a throwaway copy has fresh ids assigned before import:
node -e '
  const fs = require("fs"), { randomUUID } = require("crypto");
  const wf = JSON.parse(fs.readFileSync("daily-operations.json", "utf8"));
  wf.id = randomUUID();
  for (const n of wf.nodes) { n.id = randomUUID(); if (n.webhookId) n.webhookId = randomUUID(); }
  delete wf.versionId;
  fs.writeFileSync("daily-operations.import.json", JSON.stringify(wf, null, 2));
'
docker cp daily-operations.import.json hospitality-n8n:/tmp/daily-operations.import.json
docker exec hospitality-n8n n8n import:workflow --input=/tmp/daily-operations.import.json
docker exec hospitality-n8n n8n update:workflow --id=<id> --active=true
docker restart hospitality-n8n   # n8n only registers webhooks for active workflows on boot

# Success run
curl -X POST http://localhost:5679/webhook/daily-operations \
  -H 'Content-Type: application/json' \
  -d '{"operation_type":"daily_checklist","shift":"morning","day_of_week":"Tuesday","requested_by":"evidence-capture","location":"main-stall"}'
# -> HTTP 200, see daily-operations-run.json ("runs[0]")

# Failure run: mock-mcp returns 500 when the request body contains the
# literal marker FORCE_500_ERROR_TEST
curl -X POST http://localhost:5679/webhook/daily-operations \
  -H 'Content-Type: application/json' \
  -d '{"operation_type":"problem_solver","problem_description":"FORCE_500_ERROR_TEST","urgency":"High","requested_by":"evidence-capture"}'
# -> HTTP 500 {"message":"Error in workflow"}, see daily-operations-run.json ("runs[1]")
```

`daily-operations-run.json` holds both requests/responses. The success
response's `metadata.requested_by`/`metadata.location` echo the request
body verbatim — this only works because `Process Operations Request` now
reads `$input.item.json.body ?? $input.item.json` (the fix for finding
9's envelope bug). Before the fix, `input` was the raw webhook event
object (`{headers, params, query, body}`), so `input.requested_by` etc.
were `undefined`.

## multi-ai-parallel.json — manual-trigger substitution required

The committed export's `Webhook Trigger` node (`n8n-nodes-base.webhook`,
`typeVersion: 1`) did **not** register a normal production path under
n8n 2.38.7: `webhook_entity` stored an unexpected composite path
(`<workflowId>/webhook trigger/ai-request` instead of plain
`ai-request`), and POSTs to both the expected and the composite path
returned `404 webhook not registered`. This looks like a
version-compatibility quirk between this old typeVersion-1 export and
the current n8n webhook implementation, separate from the envelope bug —
noted here as a residual finding rather than silently worked around.

Per the task brief's stated fallback, a **manual-trigger copy** was used
instead, exactly as originally exported except:
- `Webhook Trigger`'s type was changed from `n8n-nodes-base.webhook` to
  `n8n-nodes-base.manualTrigger` (kept the same node name so existing
  connections stay valid).
- A new `Synthetic Webhook Payload` Code node was spliced in between the
  trigger and `Parse Request`, returning a fixed payload shaped exactly
  like a real n8n webhook event (`{ body: {...}, headers: {}, params: {},
  query: {} }`). (n8n's CLI `import:workflow` does not persist top-level
  `pinData`, so pinning data on the manual trigger itself does not
  survive import/execute — this Code-node splice was the reliable way to
  inject synthetic input.)

This workflow also does **not** call `mcp-server` at all — its three
provider nodes call `http://lm-studio:1234/...` (a local LM Studio
instance), an OpenAI node via an n8n credential, and
`https://api.anthropic.com/v1/messages` directly. None of those are part
of this repo's Compose stack, so a full success run isn't reproducible
without your own LM Studio instance and API keys.

```bash
docker cp multi-ai-parallel.manual.json hospitality-n8n:/tmp/multi-ai-parallel.manual.json
docker exec hospitality-n8n n8n import:workflow --input=/tmp/multi-ai-parallel.manual.json
docker exec -e N8N_RUNNERS_BROKER_PORT=5691 hospitality-n8n \
  n8n execute --id=<id> --rawOutput > multi-ai-parallel-execute.json
# (N8N_RUNNERS_BROKER_PORT overrides the CLI's task-broker port, which
# otherwise collides with the already-running server process's own
# broker on the container-internal port 5679.)
```

Result, distilled into `multi-ai-parallel-run.json`:
- `Parse Request` output: `prompt: "Suggest three specials for a rainy
  Tuesday"`, `parameters: {temperature: 0.6, max_tokens: 500}` — correctly
  read from the synthetic payload's `body`, not the `0.7`/`1000` fallback
  defaults that would appear if the fix's `.body` unwrap were missing or
  wrong. This is the direct evidence that the envelope fix works.
- `LM Studio` node: `executionStatus: "error"`,
  `"Credentials not found"` (`NodeOperationError`) — a genuine failure
  path, since this environment has neither the referenced HTTP header
  auth credential nor a reachable `lm-studio` host.
- n8n stopped the run after that first node error; `OpenAI GPT` and
  `Claude API` never executed (same class of problem: no credential /
  no live provider in this fixture-only environment).

## Compatibility notes (for the record, not fixed here)

- n8n 2.38.7 logs `Postgres 16 is outside the supported range and
  receives compatibility support only. Upgrade to Postgres 17 or newer`
  against the `postgres:16-alpine` image this repo's `docker-compose.yml`
  uses. Not addressed as part of this task (out of scope for C3); noted
  for whoever next touches the Compose file.
- The `Webhook Trigger` node's registration quirk described above
  (composite path instead of the static `path` parameter) reproduced
  consistently across three import attempts; it is specific to
  `multi-ai-parallel.json`'s old `typeVersion: 1` webhook node, since
  `daily-operations.json` (`typeVersion: 1.1`) registered its webhook
  normally.
