import type { QualityFinding, AnalyzerContext } from './types.js';
import { basename, dirname } from 'node:path';

type NamingConvention = 'kebab' | 'camel' | 'snake' | 'pascal' | 'unknown';

export function analyzeConsistency(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  checkFileNaming(ctx, findings);

  return findings;
}

function detectNamingConvention(fileName: string): NamingConvention {
  const name = fileName.replace(/\.(ts|tsx|js|jsx|py|test|spec)(\.|$)/g, '');
  if (!name || name === 'index') return 'unknown';

  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(name)) return 'kebab';
  if (/^[a-z][a-zA-Z0-9]*$/.test(name) && /[A-Z]/.test(name)) return 'camel';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'pascal';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(name)) return 'snake';
  return 'unknown';
}

function findDominantConvention(conventions: NamingConvention[]): { dominant: string; dominantCount: number; outlierCount: number; total: number } | null {
  let kebabCount = 0;
  let camelCount = 0;
  let pascalCount = 0;
  let snakeCount = 0;

  for (const conv of conventions) {
    if (conv === 'kebab') kebabCount++;
    else if (conv === 'camel') camelCount++;
    else if (conv === 'pascal') pascalCount++;
    else if (conv === 'snake') snakeCount++;
  }

  const total = kebabCount + camelCount + pascalCount + snakeCount;
  if (total < 3) return null;

  const counts = [
    { convention: 'kebab-case', count: kebabCount },
    { convention: 'camelCase', count: camelCount },
    { convention: 'PascalCase', count: pascalCount },
    { convention: 'snake_case', count: snakeCount },
  ].sort((a, b) => b.count - a.count);

  const dominant = counts[0];
  const outlierCount = counts.filter(c => c.count > 0 && c.convention !== dominant.convention)
    .reduce((s, c) => s + c.count, 0);

  if (dominant.count === 0 || outlierCount === 0) return null;
  if (dominant.count / total <= 0.6) return null;

  return { dominant: dominant.convention, dominantCount: dominant.count, outlierCount, total };
}

function checkFileNaming(ctx: AnalyzerContext, findings: QualityFinding[]): void {
  const dirFiles = new Map<string, string[]>();
  for (const file of ctx.files) {
    const dir = dirname(file);
    if (!dirFiles.has(dir)) dirFiles.set(dir, []);
    dirFiles.get(dir)!.push(basename(file));
  }

  for (const [dir, files] of dirFiles) {
    if (files.length < 2) continue;

    const conventions = files.map(f => detectNamingConvention(f));
    const result = findDominantConvention(conventions);
    if (!result) continue;

    findings.push({
      rule: 'inconsistent-file-naming',
      category: 'consistency',
      severity: 'info',
      file: dir,
      message: `Mixed file naming in '${dir}': ${result.dominantCount} ${result.dominant} vs ${result.outlierCount} other(s).`,
      suggestion: `Standardize on ${result.dominant} for consistency.`,
    });
  }
}
