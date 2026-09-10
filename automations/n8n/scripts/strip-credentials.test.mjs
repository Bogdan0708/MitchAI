// automations/n8n/scripts/strip-credentials.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { stripWorkflow } from './strip-credentials.mjs';

test('removes credentials blocks and identifying ids', () => {
  const input = {
    id: 'abc', versionId: 'v1', meta: { instanceId: 'inst' },
    nodes: [{ name: 'Call Claude', webhookId: 'wh1', credentials: { anthropicApi: { id: '1', name: 'key' } },
              parameters: { headerValue: 'Bearer sk-live-123' } }],
  };
  const out = stripWorkflow(input);
  assert.equal(out.id, 'REDACTED');
  assert.equal(out.versionId, 'REDACTED');
  assert.equal(out.meta.instanceId, 'REDACTED');
  assert.equal(out.nodes[0].webhookId, 'REDACTED');
  assert.equal(out.nodes[0].credentials, undefined);
  assert.equal(out.nodes[0].parameters.headerValue, '');
  assert.equal(out.nodes[0].name, 'Call Claude');
});
