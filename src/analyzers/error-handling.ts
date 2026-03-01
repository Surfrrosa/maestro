import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';

export function analyzeErrorHandling(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const file of ctx.files) {
    const isTest = file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__') || file.startsWith('tests/');
    if (isTest) continue;

    const content = getContent(ctx, file);
    const lines = content.split('\n');

    if (ctx.stack === 'python') {
      findings.push(...analyzePythonErrors(lines, file));
    } else {
      findings.push(...analyzeJsErrors(lines, file));
    }
  }

  return findings;
}

function analyzePythonErrors(lines: string[], file: string): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const nextLine = lines[i + 1] || '';

    if (/^\s*except\s*:/.test(line) && !/except\s+\w/.test(line)) {
      findings.push({
        rule: 'bare-except',
        category: 'error-handling',
        severity: 'warning',
        file, line: lineNum,
        message: 'Bare except catches all exceptions including SystemExit and KeyboardInterrupt.',
        suggestion: 'Use except Exception: instead.',
      });
    }

    if (isEmptyExceptBlock(line, nextLine, lines[i + 2] || '')) {
      findings.push({
        rule: 'empty-except',
        category: 'error-handling',
        severity: 'warning',
        file, line: lineNum,
        message: 'Except block contains only pass. Errors are silently swallowed.',
        suggestion: 'At minimum, log the error or add a comment explaining why it is ignored.',
      });
    }
  }

  return findings;
}

function isEmptyExceptBlock(line: string, nextLine: string, thirdLine: string): boolean {
  if (!/^\s*except\b/.test(line) || !/^\s*pass\s*$/.test(nextLine)) return false;
  const exceptIndent = (line.match(/^\s*/) || [''])[0].length;
  const thirdIndent = thirdLine.trim() ? (thirdLine.match(/^\s*/) || [''])[0].length : exceptIndent;
  return thirdIndent <= exceptIndent || !thirdLine.trim();
}

function analyzeJsErrors(lines: string[], file: string): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const nextLine = lines[i + 1] || '';

    if (isEmptyCatchBlock(line, nextLine)) {
      findings.push({
        rule: 'empty-catch',
        category: 'error-handling',
        severity: 'warning',
        file, line: lineNum,
        message: 'Empty catch block swallows errors silently.',
        suggestion: 'At minimum, log the error or add a comment explaining why it is ignored.',
      });
    }

    const promiseFinding = findUnhandledPromise(lines, i, file);
    if (promiseFinding) findings.push(promiseFinding);
  }

  return findings;
}

function isEmptyCatchBlock(line: string, nextLine: string): boolean {
  const catchMatch = line.match(/catch\s*(?:\([^)]*\))?\s*\{/);
  if (!catchMatch) return false;

  const afterCatch = line.substring(line.indexOf('{', line.indexOf('catch')) + 1);
  if (/^\s*\}\s*$/.test(afterCatch) || /^\s*$/.test(afterCatch) && /^\s*\}\s*$/.test(nextLine)) {
    const blockContent = afterCatch.trim() === '}' ? '' : nextLine.trim();
    return blockContent === '}' || blockContent === '';
  }
  return false;
}

function findUnhandledPromise(lines: string[], i: number, file: string): QualityFinding | null {
  const line = lines[i];
  if (!/\.then\s*\(/.test(line)) return null;

  let hasCatch = false;
  for (let j = i; j < Math.min(i + 5, lines.length); j++) {
    if (/\.catch\s*\(/.test(lines[j])) {
      hasCatch = true;
      break;
    }
  }
  if (hasCatch) return null;

  let inTry = false;
  for (let j = Math.max(0, i - 10); j < i; j++) {
    if (/\btry\s*\{/.test(lines[j])) inTry = true;
    if (/\bcatch\s*/.test(lines[j])) inTry = false;
  }
  if (inTry) return null;

  return {
    rule: 'unhandled-promise',
    category: 'error-handling',
    severity: 'warning',
    file, line: i + 1,
    message: '.then() without .catch() -- unhandled promise rejection possible.',
    suggestion: 'Add .catch() handler or use async/await with try/catch.',
  };
}
