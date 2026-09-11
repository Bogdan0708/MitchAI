# Security policy

## Dependency audit gate

`.github/workflows/security.yml` runs `npm audit --audit-level=high --omit=dev`
for both the backend (repo root) and `frontend/`. A high or critical
production-dependency finding fails the workflow. A separate,
non-blocking `--audit-level=moderate` step runs for visibility only.

## Residual findings (2026-09-11)

Both trees currently audit clean at `--audit-level=high --omit=dev`
(0 high, 0 critical, prod and full). Three moderate findings remain in the
backend and are accepted for now because fixing them requires a major
version bump of a direct dependency, which is out of scope for the
dependency-triage pass that closed out the high/critical backlog:

| Package | Advisory | Severity | Fix | Rationale for deferring |
|---|---|---|---|---|
| `qs` (via `express@4.x`) | [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | moderate | `express@5.x` (major) | Express 5 changes routing/middleware signatures; needs a dedicated migration + regression pass, not a drive-by dependency bump. |
| `uuid` | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | moderate | `uuid@14.x` (major) | `uuid@14` drops CJS `require()` support used across `src/`; needs an import-style migration. |

Both are moderate (not high/critical), so they do not trip the enforced
gate. Track them as follow-up work; re-run `npm audit --omit=dev` after
either migration lands and remove the corresponding row here.

Frontend: 0 findings at any severity after upgrading `next` to `16.3.5`
and `eslint`/`eslint-config-next` to the `9.x`/`16.x` line (both required
for the `next`/`eslint-config-next` critical and high findings to clear).

## Known follow-up: frontend lint baseline

Upgrading `eslint-config-next` to `16.x` (required to close a high-severity
`@next/eslint-plugin-next`/`glob` finding) also switched on ESLint's flat
config and wired the Next.js plugin correctly for the first time — the
previous `next lint` invocation silently no-op'd ("The Next.js plugin was
not detected in your ESLint configuration"). Running `npm run lint` for
real now surfaces ~88 pre-existing findings in `frontend/src` (mostly
`react/no-unescaped-entities` and React Compiler-era `react-hooks/*`
rules such as `set-state-in-effect`). These are pre-existing application
code issues, not dependency vulnerabilities, and are out of scope for the
dependency-security pass that added this file. `next build` is unaffected
and passes. Tracked as a separate app-code cleanup task.
