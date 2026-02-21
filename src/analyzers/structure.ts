import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';
import { buildImportGraph } from './dead-code.js';
import { dirname, basename } from 'node:path';

export function analyzeStructure(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  detectCircularDeps(ctx, findings);
  checkDirectoryStructure(ctx, findings);

  return findings;
}

function detectCircularDeps(ctx: AnalyzerContext, findings: QualityFinding[]): void {
  const graph = buildImportGraph(ctx);
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const reported = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart);
      const cycleKey = [...cycle].sort().join(' -> ');
      if (!reported.has(cycleKey)) {
        reported.add(cycleKey);
        findings.push({
          rule: 'circular-dependency',
          category: 'structure',
          severity: 'warning',
          file: node,
          message: `Circular dependency: ${cycle.map(f => basename(f)).join(' -> ')} -> ${basename(node)}`,
          suggestion: 'Extract shared logic into a separate module to break the cycle.',
        });
      }
      return;
    }
    if (visited.has(node)) return;

    visited.add(node);
    inStack.add(node);

    const deps = graph.imports.get(node);
    if (deps) {
      for (const dep of deps) {
        dfs(dep, [...path, node]);
      }
    }

    inStack.delete(node);
  }

  for (const file of ctx.files) {
    if (!visited.has(file)) {
      dfs(file, []);
    }
  }
}

function checkDirectoryStructure(ctx: AnalyzerContext, findings: QualityFinding[]): void {
  // Check for flat source directory (too many files at one level)
  const dirCounts = new Map<string, number>();
  for (const file of ctx.files) {
    const dir = dirname(file);
    dirCounts.set(dir, (dirCounts.get(dir) || 0) + 1);
  }

  for (const [dir, count] of dirCounts) {
    if (count > 15 && dir !== '.') {
      findings.push({
        rule: 'flat-directory',
        category: 'structure',
        severity: 'info',
        file: dir,
        message: `Directory '${dir}' has ${count} source files. Consider organizing into subdirectories.`,
        suggestion: 'Group related files into subdirectories with index exports.',
      });
    }
  }

  // Check for source files at project root (should be in src/)
  const rootFiles = ctx.files.filter(f => !f.includes('/') && !f.startsWith('.'));
  const nonConfigRootFiles = rootFiles.filter(f => {
    const base = basename(f);
    return !/\.(config|setup|d)\.(ts|js)$/.test(base) && !['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js'].includes(base);
  });

  if (nonConfigRootFiles.length > 3) {
    findings.push({
      rule: 'root-source-files',
      category: 'structure',
      severity: 'info',
      file: '.',
      message: `${nonConfigRootFiles.length} source files at project root. Consider using a src/ directory.`,
      suggestion: 'Move source files into src/ for cleaner project structure.',
    });
  }
}
