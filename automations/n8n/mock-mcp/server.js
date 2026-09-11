#!/usr/bin/env node
// Zero-dependency mock of the `mcp-server` host that the shipped n8n
// workflow exports call (http://mcp-server:3000/...). It is NOT a real
// MCP server or AI provider — it exists purely so the workflows can be
// imported and *executed* against synthetic, fixture-shaped responses,
// for reproducibility evidence (see automations/n8n/evidence/README.md).
//
// Routes (derived from the httpRequest nodes in the six workflow exports
// that call http://mcp-server:3000/...):
//   POST /claude                     (daily-operations, customer-feedback)
//   POST /tools/parallel-ai-query    (menu-innovation, business-strategy, social-media)
//   POST /llm/parallel               (parallel-ai-consensus)
//
// Failure-path testing: if the incoming JSON body contains the literal
// string "FORCE_500_ERROR_TEST" anywhere (e.g. embedded in a prompt), the
// mock responds 500 with a JSON error body instead of the normal fixture,
// so the calling workflow's error branch/output can be captured.
'use strict';

const http = require('node:http');

const PORT = process.env.MOCK_MCP_PORT || 3000;
const ERROR_TRIGGER = 'FORCE_500_ERROR_TEST';

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        // Non-JSON (e.g. form-encoded) body; hand back the raw string so
        // the error-trigger check below still works, and route handlers
        // that don't need structured fields keep working.
        resolve({ __raw: raw });
      }
    });
  });
}

function shouldSimulateError(body) {
  try {
    return JSON.stringify(body).includes(ERROR_TRIGGER);
  } catch {
    return false;
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

// Fixture text shaped to satisfy parallel-ai-consensus's confidence/theme
// heuristics (mentions numbers, cost/revenue words, "traditional"/
// "Romanian", and is >100 chars) as well as being generically plausible
// output for the menu/strategy/social/ops/feedback prompts.
const FIXTURE_TEXT =
  'Recommend leaning into 3 traditional Romanian ingredients (cabbage, ' +
  'paprika, sour cream) for the new item. Estimated cost per portion is ' +
  '8-10 RON with a target price of 25 RON, giving a healthy margin. This ' +
  'is a synthetic fixture response from automations/n8n/mock-mcp, not a ' +
  'real model output.';

function claudeFixture() {
  return { response: FIXTURE_TEXT, model: 'claude-mock-sonnet' };
}

function parallelAiQueryFixture() {
  return {
    results: [{ response: FIXTURE_TEXT, model: 'claude-mock-sonnet' }],
  };
}

function llmParallelFixture(body) {
  const now = new Date().toISOString();
  const providers = Array.isArray(body.providers) && body.providers.length
    ? body.providers
    : ['anthropic', 'openai'];
  const results = providers.map((provider) => ({
    provider,
    model: provider === 'anthropic' ? 'claude-mock-sonnet' : 'gpt-mock-4',
    response: FIXTURE_TEXT,
    usage: { total_tokens: 180 },
  }));
  return {
    request_id: `mock_${Date.now()}`,
    prompt: body.prompt || body.question || '',
    timestamp: now,
    results,
    summary: {
      total_providers: results.length,
      successful: results.length,
      failed: 0,
      total_tokens: results.length * 180,
      response_time_ms: 42,
    },
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST') {
    return sendJson(res, 404, { error: 'not_found', path: req.url });
  }

  const body = await readBody(req);

  if (shouldSimulateError(body)) {
    return sendJson(res, 500, {
      error: 'mock_mcp_simulated_failure',
      message: `Synthetic 500 from mock-mcp for ${req.url} (triggered by ${ERROR_TRIGGER} marker)`,
    });
  }

  const url = req.url.split('?')[0];

  if (url === '/claude') {
    return sendJson(res, 200, claudeFixture());
  }
  if (url === '/tools/parallel-ai-query') {
    return sendJson(res, 200, parallelAiQueryFixture());
  }
  if (url === '/llm/parallel') {
    return sendJson(res, 200, llmParallelFixture(body));
  }

  return sendJson(res, 404, { error: 'not_found', path: req.url });
});

server.listen(PORT, () => {
  console.log(`mock-mcp listening on :${PORT}`);
});
