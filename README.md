# Maestro

AI-native development fails without process. Not because the tools are bad, but because the tools are fast -- fast enough to produce a bigger pile of undirected output than any human can review.

Maestro is a CLI that scaffolds the process. It generates the instruction files, session logs, brand voice documents, design systems, and security checklists that keep AI-assisted development coherent across sessions, repos, and teams.

Built by [@shainapauley](https://shainapauley.com), who shipped 10 products across 14 repositories using this methodology over 232 days of AI-native development. [Read more about the approach.](https://shainapauley.com/writing/all-the-notes-none-of-the-music)

## Install

```bash
npm install -g maestro-dev
```

Or run without installing:

```bash
npx maestro-dev scan
```

## Quick Start

Already have a project? Scan it:

```bash
cd your-project
maestro scan
```

Maestro reads your codebase and generates a populated `CLAUDE.md`, session log structure, security checklist, and `.env.example` based on what you've actually built. No empty templates.

Starting fresh? Scaffold from scratch:

```bash
maestro init
```

Either way, check your score:

```bash
maestro audit
```

## Commands

### `maestro scan`

**The primary command.** Reads an existing codebase and generates populated docs from what's actually there.

```bash
maestro scan
```

Detects your stack, maps key files, extracts run commands, identifies your AI provider and database, and generates:

- `CLAUDE.md` -- populated with real file paths, real run commands, and real project context
- `docs/sessions/` -- session log directory with first log and index
- `docs/SECURITY_CHECKLIST.md` -- security checklist matched to your project type
- `.env.example` -- generated from your existing `.env` with values redacted

```
  maestro scan

  Scanning floatless...

  Stack: node (api-node)
  Key files: 14 detected
  Run commands: 3 found
  AI provider: none
  Database: postgres
  Deploy target: local
  Dependencies: 22

  + CLAUDE.md (populated from codebase scan)
  + docs/sessions/README.md
  + docs/sessions/2026-02-21_session.md
  + docs/SECURITY_CHECKLIST.md
  + .env.example (generated from .env, values redacted)

  Scan complete.
```

### `maestro audit`

Score your project against 12 weighted checks. Get a score out of 100 with actionable recommendations.

```bash
maestro audit
```

```
  Score: 92/100

  PASS  CLAUDE.md exists [15pts]
  PASS  CLAUDE.md has content [10pts]
  PASS  Session logs present [10pts] - 24 log(s)
  PASS  Session index maintained [5pts]
  PASS  .env safety [10pts]
  PASS  .gitignore comprehensive [5pts]
  PASS  Dependency pinning [10pts]
  PASS  README exists [5pts]
  PASS  Architecture documented [10pts]
  FAIL  Security checklist present [10pts] - No security checklist found.
  PASS  No tracked secrets [5pts]
  PASS  Tests present [5pts]
```

Auto-fix gaps:

```bash
maestro audit --fix
```

Generate a badge for your README:

```bash
maestro audit --badge
# Output: ![Maestro Score](https://img.shields.io/badge/maestro-92%2F100-brightgreen)
```

Use in CI with a minimum threshold:

```bash
maestro audit --ci 60
# Exits non-zero if score < 60
```

### `maestro audit-all`

Score every repo in a directory at once.

```bash
maestro audit-all ~/projects
```

```
  Repository         Score
  ------------------  -----
  synestrology        92/100
  portfolio           85/100
  absurdity-index     78/100
  prompt2story        42/100
  floatless           33/100
  enlighten           25/100

  Average             59/100

  6 repos scanned.
```

### `maestro init`

Interactive scaffolding for new projects. Supports 7 project types: Python API, Node API, Next.js, Static frontend, React Native, Data Pipeline, CLI Tool.

```bash
maestro init
```

### `maestro session start` / `maestro session end`

Session log lifecycle. `start` creates a new dated log. `end` auto-detects git changes, populates the "Files Modified" section, prompts for a summary, and updates the session index.

```bash
maestro session start
# ... do your work ...
maestro session end
```

Handles multiple sessions per day automatically (`_session_2.md`, `_session_3.md`).

### `maestro voice`

Interactive brand voice document generator. Walks through audience, tone, banned phrases, formatting rules, and intellectual frameworks.

```bash
maestro voice
```

### `maestro design-system`

Interactive design system generator. Colors, typography, design principles. Outputs CSS custom properties ready to paste into code.

```bash
maestro design-system
```

## CI Integration

Add Maestro to your CI pipeline to enforce project health standards:

```yaml
# .github/workflows/maestro-audit.yml
name: Maestro Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm install -g maestro-dev
      - run: maestro audit --ci 60
```

See [examples/github-action.yml](examples/github-action.yml) for a full example.

## Why this exists

When you work with AI tools like Claude Code, every session starts fresh. The AI doesn't remember your naming conventions, your architecture decisions, your security requirements, or what you built yesterday.

Most developers compensate through tribal knowledge and familiarity. That doesn't work when your collaborator's memory resets every session.

Maestro generates the documentation layer that keeps AI-assisted development coherent:

- **CLAUDE.md** files give every session the same starting context
- **Session logs** prevent duplicate work and preserve decision history
- **Brand voice docs** keep generated copy consistent
- **Design system docs** keep generated UI consistent
- **Security checklists** prevent the "ship fast, worry later" pattern

These are standard software development best practices. The difference is that humans can compensate without them. AI can't.

## The methodology

This tool packages a development methodology built across 535+ co-authored commits:

1. **Project instructions at startup** prevent guessing and enforce consistent patterns
2. **Small, focused files** limit context requirements when modifications occur
3. **Session documentation** prevents repeating work or contradicting previous decisions
4. **Verification over trust** -- test outputs, don't assume correctness
5. **Security and dependencies as ongoing maintenance**, not afterthoughts

Read more: [All the Notes, None of the Music](https://shainapauley.com/writing/all-the-notes-none-of-the-music) | [232 Days of Cowboy Coding](https://shainapauley.com/writing/232-days-of-cowboy-coding)

## License

MIT
