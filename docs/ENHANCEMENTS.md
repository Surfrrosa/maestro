# Future Enhancements

Ideas for improving maestro's analysis quality and usefulness, captured for future sessions.

## Contextual Function Length Thresholds

Template string builders (generating markdown, HTML, config files) have different readability profiles than logic functions. A 60-line template builder that's a sequence of string concatenations is easier to follow than a 40-line function with branching logic. Consider per-pattern thresholds:

- Default: 50 lines (current)
- Template/generator functions: 80 lines
- Configuration via `.maestrorc.json` `thresholds.functionLength` as object or number

## Per-Rule Ignore Patterns

Allow users to suppress specific rules for specific file patterns in `.maestrorc.json`:

```json
{
  "quality": {
    "rules": {
      "tech-debt-marker": { "ignore": ["tests/**"] },
      "magic-number": { "ignore": ["src/constants.ts"] }
    }
  }
}
```

This would reduce noise from known-acceptable patterns without disabling rules globally.

## Shared Function-Tracking Utility

The function-name tracking pattern (regex + brace-depth state machine) is now duplicated across `complexity-nesting.ts`, `complexity-function-length.ts`, and `hygiene.ts`. Extract a shared `buildFunctionMap(lines, stack)` utility to `src/analyzers/function-scope.ts` that all analyzers can import. This reduces maintenance burden and ensures consistent behavior.

## Weighted Test Coverage by File Complexity

Current test coverage treats all source files equally. A 200-line file with complex branching is more important to test than a 20-line config helper. Weight the coverage score by file complexity (line count, cyclomatic complexity, or number of exports) so that untested complex files penalize the score more.

## Re-Export Detection in Import Graph

The dead-code analyzer's import graph doesn't track re-exports (`export { foo } from './bar'`). Files that only re-export are falsely flagged as unused when the re-exporting barrel file is the one being imported. Detecting re-export patterns and threading them through the graph would reduce false positives.
