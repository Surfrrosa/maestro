# maestro

AI-native development fails without process. Not because the tools are bad, but because the tools are fast -- fast enough to produce a bigger pile of undirected output than any human can review.

## Session Protocol

**Before starting any work, read the latest session log in `docs/sessions/`.**

Write a session log before ending every session. Format: `docs/sessions/YYYY-MM-DD_session.md`

## Key Files

| File | Purpose |
|------|---------|
| CLAUDE.md | This file. Project instructions for AI sessions. |
| docs/sessions/ | Session logs for continuity between sessions |
| docs/ | Documentation |
| package.json | Dependencies and scripts |
| src/analyzers/index.ts | Module entry point |
| src/commands/ | CLI commands |
| src/utils/ | Utility functions |
| tests/ | Test suite |
| tsconfig.json | TypeScript configuration |

## Running

```bash
npm run dev -- tsup --watch
```

```bash
npm run build
```

```bash
npm test
```

## Before Writing New Code

Before adding a helper, analyzer, command, or template, search for
existing ones first:

- `rg "<symbol>" src/` for similar names or near-duplicates
  (e.g. `formatDate` vs `formatDateString`)
- Look in `src/utils/` for shared helpers (`fs.ts`, `format.ts`,
  `string-scanner.ts`, `sanitize-env.ts`, `config.ts`, `sessions.ts`)
- Look in `src/analyzers/` for analyzer patterns; analyzers share an
  `AnalyzerContext` interface — extend that rather than re-globbing
- For state-machine-style scanning, `src/utils/string-scanner.ts`
  already handles strings/comments — extend it, don't reimplement
- Test files map 1:1 to source files by name. Don't create a util that
  would clash with an existing filename in another directory

Don't add a new file for a one-off variant of an existing pattern.
If you're about to copy-paste a file and tweak two values, extract a
helper instead.

## Domain Rules

- Commands in `src/commands/` must be split into handler (CLI wiring) + logic (testable functions). The handler file owns the Commander definition; the logic file exports pure functions.
- All filesystem access in commands should use `readFile`/`fileExists` from `src/utils/fs.ts`, not bare `readFileSync`/`existsSync`.
- Analyzers receive an `AnalyzerContext` and return `QualityFinding[]`. They must not write to stdout or exit.
- Test files must map 1:1 to source files by name (e.g., `audit-checks.test.ts` tests `audit-checks.ts`). The testing analyzer uses filename matching for coverage detection.
- No `^` or `~` in dependency versions. Pin exact.

## Known Technical Debt

### Testing analyzer coverage detection (Medium)
Matches test coverage by filename pattern, not by tracing imports. A test file that covers multiple modules gives credit to none of them unless the name matches. `quality.test.ts` tested 7 modules but none got credit.
Files affected: `src/analyzers/testing.ts`

### Security scanner bypasses AnalyzerContext (Low)
Runs its own glob calls independently instead of sharing the file list already built by `buildContext()`. Results in 3-4 redundant filesystem traversals per scan.
Files affected: `src/commands/security-scanner.ts`

### TypeScript 7 blocked on tsup ecosystem (Low, deferred)
`tsup` 8.x bundles `rollup-plugin-dts@6.1.1` which uses a TS API removed in TypeScript 7 (`useCaseSensitiveFileNames`). PR #49 CI fails during build. Deferred via `@dependabot ignore this major version`. Revisit when tsup 9.x ships or a resolution override for `rollup-plugin-dts` becomes viable.

### Chalk 6 defer — would force Node 22 minimum (Low, deferred)
`chalk@6.0.0` requires Node.js 22 as a hard peer. Adopting it would bump maestro's own `engines.node` from `>=20.12.0` to `>=22.0.0`, breaking installs for users still on Node 20 (LTS through April 2026). PR #48 deferred via `@dependabot ignore this major version`. Revisit after Node 20 EOL (April 2026) or when there's a concrete user need for chalk 6 features (extended underline styles).

### esbuild dev-server vuln — accepted risk (Low)
`esbuild@0.27.3` (transitive via tsup) has an advisory (GHSA-g7r4-m6w7-qqqr) for arbitrary file read via the dev server on Windows. Not fixable via `npm audit fix` (deeply pinned in tsup 8.x). Accepted because: (a) dev-only dependency, not shipped to end users; (b) Windows-only; (c) requires running `esbuild --serve` which maestro doesn't do. Revisit if tsup 9.x ships with a newer esbuild.

## Dependencies

All dependencies must be pinned to exact versions. No `^` or `~` prefixes.

When adding a dependency:
1. Verify it's necessary (don't add libraries for one-time operations)
2. Pin the exact version
3. Document why it was added if non-obvious

### CI Node version (lockfile gotcha)

`.github/workflows/maestro.yml` pins `actions/setup-node` with `node-version: '22'`. Local environments may be on a newer Node (e.g., 24).

This causes `package-lock.json` drift when running `npm install` or `npm audit fix` locally — the lockfile resolves optional/peer deps (notably `@emnapi/core`, `@emnapi/runtime`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`) differently between Node versions. CI then fails `npm ci` with "Missing: X from lock file."

**Fix:** Regenerate the lockfile under Node 22.

```bash
source ~/.nvm/nvm.sh
nvm exec 22 npm install
```

(Direct `nvm use 22` then `npm install` may not work inside subshells — `nvm exec 22 <cmd>` is more reliable.)

Caught mid-session 2026-06-09 during the maestro audit PR. ~15 minutes burned diagnosing the version mismatch before realizing.
