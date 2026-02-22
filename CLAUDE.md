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

## Domain Rules

<!-- Add project-specific rules here. These are non-negotiable constraints. Examples: -->
<!-- - NEVER guess data. Always verify computationally. -->
<!-- - All API responses must include error codes. -->
<!-- - CSS must use the design system variables in docs/DESIGN_SYSTEM.md. -->
<!-- - This module should never import from that module. -->

## Known Technical Debt

<!-- Track technical debt explicitly. Keep this current. Example: -->
<!-- ### Duplicated template code (Medium) -->
<!-- Pages share boilerplate that should be extracted. -->
<!-- Files affected: src/pages/*.html -->
<!-- Estimated effort: 4-6 hours -->

## Dependencies

All dependencies must be pinned to exact versions. No `^` or `~` prefixes.

When adding a dependency:
1. Verify it's necessary (don't add libraries for one-time operations)
2. Pin the exact version
3. Document why it was added if non-obvious
