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
npx maestro-dev init
```

## Commands

### `maestro init`

Scaffold a new AI-native project with interactive prompts.

```bash
maestro init
```

Generates a complete project structure:
- `CLAUDE.md` -- AI session instruction file (customized by project type)
- `docs/sessions/` -- Session log directory with first log and index
- `docs/ARCHITECTURE.md` -- System architecture template
- `docs/SECURITY_CHECKLIST.md` -- Security checklist (varies by project type)
- `.env.example` -- Environment variable template (varies by services)
- `.gitignore` -- Comprehensive ignore file (varies by stack)
- `README.md` -- Project readme with setup instructions

Supports 7 project types: Python API, Node API, Next.js, Static frontend, React Native, Data Pipeline, CLI Tool.

### `maestro audit`

Score an existing project against the AI-native development methodology.

```bash
maestro audit
```

Checks 12 criteria including CLAUDE.md quality, session log presence, dependency pinning, secret scanning, and security documentation. Outputs a score out of 100 with actionable recommendations.

```
  Score: 92/100

  PASS  CLAUDE.md exists
  PASS  CLAUDE.md has required sections
  PASS  Session logs present - 24 log(s)
  PASS  Session index maintained
  PASS  .env safety
  PASS  .gitignore comprehensive
  PASS  Dependency pinning
  PASS  README exists
  PASS  Architecture documented
  FAIL  Security checklist present - No security checklist found.
  PASS  No tracked secrets
  PASS  Tests present
```

Auto-fix gaps where possible:

```bash
maestro audit --fix
```

### `maestro session start`

Create a new dated session log from template.

```bash
maestro session start
```

Handles multiple sessions per day automatically (`_session_2.md`, `_session_3.md`).

### `maestro session end`

Close the current session with a summary and status.

```bash
maestro session end
```

Updates the session index in `docs/sessions/README.md`.

### `maestro voice`

Generate a brand voice document interactively.

```bash
maestro voice
```

Walks through audience, tone, banned phrases, formatting rules, and intellectual frameworks. Produces `docs/BRAND_VOICE.md`.

### `maestro design-system`

Generate a design system document interactively.

```bash
maestro design-system
```

Walks through colors, typography, and design principles. Produces `docs/DESIGN_SYSTEM.md` with CSS custom properties ready to paste into code.

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

You can read more about the approach in [All the Notes, None of the Music](https://shainapauley.com/writing/all-the-notes-none-of-the-music) and [232 Days of Cowboy Coding](https://shainapauley.com/writing/232-days-of-cowboy-coding).

## License

MIT
