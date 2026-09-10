// automations/n8n/scripts/strip-credentials.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const ID_KEYS = new Set(['id', 'versionId', 'webhookId', 'instanceId']);
const SECRET = /^(sk-|AIza|Bearer )/;

export function stripWorkflow(value) {
  if (Array.isArray(value)) return value.map(stripWorkflow);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'credentials') continue;
      if (ID_KEYS.has(k)) { out[k] = 'REDACTED'; continue; }
      out[k] = stripWorkflow(v);
    }
    return out;
  }
  if (typeof value === 'string' && SECRET.test(value)) return '';
  return value;
}

if (process.argv[1] && process.argv[1].endsWith('strip-credentials.mjs') && process.argv.length > 3) {
  const [src, dst] = process.argv.slice(2);
  writeFileSync(dst, JSON.stringify(stripWorkflow(JSON.parse(readFileSync(src, 'utf8'))), null, 2) + '\n');
}
