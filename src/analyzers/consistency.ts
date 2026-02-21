import type { QualityFinding, AnalyzerContext } from './types.js';
import { basename, dirname } from 'node:path';

export function analyzeConsistency(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  checkFileNaming(ctx, findings);

  return findings;
}

function checkFileNaming(ctx: AnalyzerContext, findings: QualityFinding[]): void {
  // Group files by directory
  const dirFiles = new Map<string, string[]>();
  for (const file of ctx.files) {
    const dir = dirname(file);
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir)!.push(basename(file));
  }

  for (const [dir, files] of dirFiles) {
    if (files.length < 2) continue;

    // Detect naming conventions used
    let kebabCount = 0;
    let camelCount = 0;
    let pascalCount = 0;
    let snakeCount = 0;

    for (const file of files) {
      const name = file.replace(/\.(ts|tsx|js|jsx|py|test|spec)(\.|$)/g, '');
      if (!name || name === 'index') continue;

      if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) kebabCount++;
      else if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) camelCount++;
      else if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) pascalCount++;
      else if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) snakeCount++;
    }

    const total = kebabCount + camelCount + pascalCount + snakeCount;
    if (total < 3) continue; // Not enough files to judge

    // Find dominant convention
    const counts = [
      { convention: 'kebab-case', count: kebabCount },
      { convention: 'camelCase', count: camelCount },
      { convention: 'PascalCase', count: pascalCount },
      { convention: 'snake_case', count: snakeCount },
    ].sort((a, b) => b.count - a.count);

    const dominant = counts[0];
    const minority = counts.filter(c => c.count > 0 && c.convention !== dominant.convention);

    if (dominant.count > 0 && minority.length > 0) {
      const outlierCount = minority.reduce((s, c) => s + c.count, 0);
      // Only flag if there's a clear dominant pattern (>60% of files)
      if (dominant.count / total > 0.6 && outlierCount > 0) {
        findings.push({
          rule: 'inconsistent-file-naming',
          category: 'consistency',
          severity: 'info',
          file: dir,
          message: `Mixed file naming in '${dir}': ${dominant.count} ${dominant.convention} vs ${outlierCount} other(s).`,
          suggestion: `Standardize on ${dominant.convention} for consistency.`,
        });
      }
    }
  }
}
