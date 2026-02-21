import type { QualityReport, QualityCategory, CategoryScore, QualityFinding } from './types.js';
import { buildContext } from './context.js';
import { analyzeComplexity } from './complexity.js';
import { analyzeDeadCode } from './dead-code.js';
import { analyzeStructure } from './structure.js';
import { analyzeHygiene } from './hygiene.js';
import { analyzeConsistency } from './consistency.js';
import { analyzeTesting } from './testing.js';
import { analyzeErrorHandling } from './error-handling.js';

const CATEGORY_WEIGHTS: Record<QualityCategory, number> = {
  complexity: 25,
  'dead-code': 15,
  structure: 15,
  hygiene: 15,
  consistency: 10,
  testing: 10,
  'error-handling': 10,
};

function scoreCategory(category: QualityCategory, findings: QualityFinding[]): CategoryScore {
  const weight = CATEGORY_WEIGHTS[category];
  let deductions = 0;
  for (const f of findings) {
    if (f.severity === 'error') deductions += 5;
    else if (f.severity === 'warning') deductions += 2;
    else deductions += 0.5;
  }
  deductions = Math.min(deductions, weight);
  const score = Math.round(((weight - deductions) / weight) * 100);

  return { category, score, findings, maxDeductions: weight, deductions };
}

function computeGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export async function runQualityAnalysis(cwd: string): Promise<QualityReport> {
  const ctx = await buildContext(cwd);

  const analyzerResults: Array<[QualityCategory, QualityFinding[]]> = [
    ['complexity', analyzeComplexity(ctx)],
    ['dead-code', analyzeDeadCode(ctx)],
    ['structure', analyzeStructure(ctx)],
    ['hygiene', analyzeHygiene(ctx)],
    ['consistency', analyzeConsistency(ctx)],
    ['testing', analyzeTesting(ctx)],
    ['error-handling', analyzeErrorHandling(ctx)],
  ];

  const categories = analyzerResults.map(([cat, findings]) => scoreCategory(cat, findings));

  const totalWeight = Object.values(CATEGORY_WEIGHTS).reduce((a, b) => a + b, 0);
  const weightedScore = categories.reduce((sum, c) => {
    const weight = CATEGORY_WEIGHTS[c.category];
    return sum + (c.score * weight / 100);
  }, 0);
  const overallScore = Math.round((weightedScore / totalWeight) * 100);

  const totalFindings = categories.reduce((sum, c) => sum + c.findings.length, 0);
  const fixableCount = categories.reduce((sum, c) =>
    sum + c.findings.filter(f => f.rule === 'debug-statement').length, 0);

  return {
    categories,
    overallScore,
    grade: computeGrade(overallScore),
    totalFindings,
    fixableCount,
  };
}
