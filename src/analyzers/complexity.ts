import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';
import { analyzeFunctionLengths } from './complexity-function-length.js';
import { analyzeNestingDepth } from './complexity-nesting.js';

const DEFAULT_MAX_FILE_LINES = 300;
const DEFAULT_MAX_FUNCTION_LINES = 50;
const DEFAULT_MAX_NESTING_DEPTH = 4;

export function analyzeComplexity(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const thresholds = ctx.config.quality.thresholds;
  const maxFileLines = thresholds?.maxFileLines ?? DEFAULT_MAX_FILE_LINES;
  const maxFuncLines = thresholds?.maxFunctionLines ?? DEFAULT_MAX_FUNCTION_LINES;
  const maxNesting = thresholds?.maxNestingDepth ?? DEFAULT_MAX_NESTING_DEPTH;

  for (const file of ctx.files) {
    const content = getContent(ctx, file);
    const lines = content.split('\n');

    if (lines.length > maxFileLines) {
      findings.push({
        rule: 'file-size',
        category: 'complexity',
        severity: lines.length > 500 ? 'error' : 'warning',
        file,
        message: `File has ${lines.length} lines (max ${maxFileLines}). Consider splitting into smaller modules.`,
        suggestion: 'Extract related functions into separate files.',
      });
    }

    const funcFindings = analyzeFunctionLengths(content, file, ctx.stack, maxFuncLines);
    findings.push(...funcFindings);

    const nestFindings = analyzeNestingDepth(content, file, ctx.stack, maxNesting);
    findings.push(...nestFindings);
  }

  return findings;
}
