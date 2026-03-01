# maestro - Architecture

AI-native development scaffolding CLI that generates project infrastructure and runs health analysis.

## System Overview

```
bin/maestro.ts          CLI entry point (Commander)
  |
  +-- src/commands/     Command handlers (one per subcommand)
  |     +-- *-checks.ts   Analysis logic (split from handlers)
  |     +-- *-scanner.ts   Scanning logic (split from handlers)
  |     +-- *-fixer.ts     Auto-fix logic (split from handlers)
  |
  +-- src/analyzers/    Quality analysis engine
  |     +-- index.ts       Orchestrator: runs all analyzers, scores results
  |     +-- context.ts     Builds file list and shared context
  |     +-- complexity.ts  File size, function length, nesting depth
  |     +-- dead-code.ts   Import graph, unused file detection
  |     +-- structure.ts   Circular deps, flat directories
  |     +-- hygiene.ts     Debug statements, TODOs, magic numbers
  |     +-- consistency.ts File naming conventions
  |     +-- testing.ts     Test coverage by file
  |     +-- error-handling.ts  Empty catch blocks, bare excepts
  |
  +-- src/templates/    Scaffolding templates (pure functions)
  |     +-- claude-md.ts   CLAUDE.md generator
  |     +-- session-log.ts Session log template
  |     +-- security.ts    Security checklist template
  |     +-- ...
  |
  +-- src/utils/        Shared utilities
        +-- fs.ts          File I/O, stack detection
        +-- format.ts      Terminal formatting, color palette
        +-- config.ts      .maestrorc.json loading
        +-- sessions.ts    Session log parsing
```

## Data Flow

### Quality Analysis Pipeline

1. `buildContext()` globs source files, detects stack (node/python), loads config
2. Seven analyzers run independently, each receiving the same `AnalyzerContext`
3. Each analyzer returns `QualityFinding[]` with rule, severity, file, message
4. `scoreCategory()` converts findings to scores: error=-5, warning=-2, info=-0.5
5. Category scores are weighted (complexity 25%, dead-code 15%, structure 15%, hygiene 15%, consistency 10%, testing 10%, error-handling 10%) and combined into an overall grade

### Command Architecture

Commands follow a consistent pattern:
- **Handler file** (`audit.ts`): CLI setup, user interaction, output rendering
- **Logic file** (`audit-checks.ts`): Pure analysis functions, no I/O formatting
- **Fixer file** (`audit-fixer.ts`): Auto-fix operations (where applicable)

This separation allows the analysis logic to be tested independently and reused by the report command.

## Key Design Decisions

- **Text scanning over AST parsing**: Analyzers use regex patterns instead of language-specific ASTs. Trades precision for zero dependencies and multi-language support.
- **Brace-stack heuristic for nesting**: `isControlFlowBrace()` distinguishes control flow `{` from object literal `{` by inspecting the preceding token (`)`, `=>`, keywords).
- **Category weight system**: Quality scores are weighted to reflect relative importance. Complexity (25%) matters more than consistency (10%).
- **Import resolution via filename**: Dead code detection resolves `.js` imports to `.ts` files and handles path aliases from tsconfig.json.

## Configuration

`.maestrorc.json` or `maestro` key in `package.json`:

```json
{
  "quality": {
    "ignore": ["generated/**"],
    "thresholds": {
      "maxFileLines": 300,
      "maxFunctionLines": 50,
      "maxNestingDepth": 4
    }
  }
}
```
