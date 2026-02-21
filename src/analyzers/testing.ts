import type { QualityFinding, AnalyzerContext } from './types.js';
import { basename, dirname } from 'node:path';

export function analyzeTesting(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  // Build set of test files
  const testFiles = new Set(
    ctx.files.filter(f =>
      f.includes('.test.') || f.includes('.spec.') ||
      f.includes('__tests__/') || f.startsWith('tests/') || f.startsWith('test/')
    )
  );

  // Build set of source files that should have tests
  const sourceFiles = ctx.files.filter(f => {
    if (testFiles.has(f)) return false;
    const base = basename(f);
    // Skip index/barrel files, configs, type definitions
    if (/^index\.(ts|js|tsx|jsx|py)$/.test(base)) return false;
    if (/\.(config|setup|d)\.(ts|js)$/.test(base)) return false;
    if (base.endsWith('.d.ts')) return false;
    // Skip if not in a src/ or lib/ or app/ directory
    if (!f.startsWith('src/') && !f.startsWith('lib/') && !f.startsWith('app/')) return false;
    return true;
  });

  if (sourceFiles.length === 0) return findings;

  // For each source file, check if a corresponding test file exists
  const untestedFiles: string[] = [];
  for (const srcFile of sourceFiles) {
    const baseName = basename(srcFile).replace(/\.(ts|tsx|js|jsx|py)$/, '');
    const hasTest = ctx.files.some(f => {
      const testBase = basename(f);
      return testBase.includes(`${baseName}.test.`) ||
        testBase.includes(`${baseName}.spec.`) ||
        testBase.includes(`test_${baseName}.`) ||
        testBase === `${baseName}_test.py`;
    });

    if (!hasTest) {
      untestedFiles.push(srcFile);
    }
  }

  // Only report if there are some tests already (project cares about testing)
  if (testFiles.size > 0 && untestedFiles.length > 0) {
    const coverage = Math.round(((sourceFiles.length - untestedFiles.length) / sourceFiles.length) * 100);

    // Report the gap summary
    if (coverage < 50) {
      findings.push({
        rule: 'low-test-coverage',
        category: 'testing',
        severity: 'warning',
        file: '.',
        message: `Test coverage: ${coverage}% (${sourceFiles.length - untestedFiles.length}/${sourceFiles.length} source files have tests).`,
        suggestion: 'Add tests for untested source files.',
      });
    }

    // Report individual untested files (limit to worst offenders)
    for (const file of untestedFiles.slice(0, 10)) {
      findings.push({
        rule: 'missing-test',
        category: 'testing',
        severity: 'info',
        file,
        message: `No test file found for ${file}.`,
        suggestion: `Create a test file to cover this module.`,
      });
    }
  }

  return findings;
}
