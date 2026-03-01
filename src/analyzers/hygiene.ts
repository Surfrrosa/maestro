import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';

export function analyzeHygiene(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const file of ctx.files) {
    const isTest = file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__') || file.startsWith('tests/');
    const isCLI = file.includes('commands/') || file.includes('bin/') || file.includes('cli');
    const content = getContent(ctx, file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      const debugFinding = checkDebugStatements(line, lineNum, file, isTest, isCLI, ctx.stack);
      if (debugFinding) findings.push(debugFinding);

      const debtFinding = checkTechDebtMarkers(line, lineNum, file);
      if (debtFinding) findings.push(debtFinding);

      const magicFinding = checkMagicNumbers(line, lineNum, file, isTest);
      if (magicFinding) findings.push(magicFinding);
    }
  }

  return findings;
}

function checkDebugStatements(line: string, lineNum: number, file: string, isTest: boolean, isCLI: boolean, stack: string): QualityFinding | null {
  if (!isTest && !isCLI && /\bconsole\.(log|debug|info)\s*\(/.test(line)) {
    if (/(?:function|const|let|var)\s+(?:log|logger|debug|info)/.test(line)) return null;
    return {
      rule: 'debug-statement',
      category: 'hygiene',
      severity: 'warning',
      file, line: lineNum,
      message: `Debug statement: console.${line.match(/console\.(\w+)/)?.[1] || 'log'}()`,
      suggestion: 'Remove debug logging or use a proper logging library.',
    };
  }

  if (!isTest && stack === 'python' && /\bprint\s*\(/.test(line)) {
    if (/^\s*#/.test(line)) return null;
    return {
      rule: 'debug-statement',
      category: 'hygiene',
      severity: 'warning',
      file, line: lineNum,
      message: 'Debug print() statement',
      suggestion: 'Use logging module instead of print().',
    };
  }

  return null;
}

function checkTechDebtMarkers(line: string, lineNum: number, file: string): QualityFinding | null {
  const todoMatch = line.match(/(?:\/\/|#|\/\*)\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/i);
  if (todoMatch) {
    return {
      rule: 'tech-debt-marker',
      category: 'hygiene',
      severity: 'info',
      file, line: lineNum,
      message: `${todoMatch[1].toUpperCase()}: ${todoMatch[2].substring(0, 60) || '(no description)'}`,
      suggestion: 'Track in CLAUDE.md Known Technical Debt section.',
    };
  }
  return null;
}

function checkMagicNumbers(line: string, lineNum: number, file: string, isTest: boolean): QualityFinding | null {
  if (isTest) return null;

  const magicMatch = line.match(/(?:===?|!==?|>=?|<=?|return)\s+(\d{3,})/);
  if (!magicMatch) return null;

  const num = parseInt(magicMatch[1]);
  const common = [100, 200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 500, 502, 503, 1000, 1024, 3000, 4000, 5000, 8000, 8080, 8443, 9090];
  if (common.includes(num) || /const|let|var|enum|type|interface/.test(line)) return null;

  return {
    rule: 'magic-number',
    category: 'hygiene',
    severity: 'info',
    file, line: lineNum,
    message: `Magic number ${num}. Consider extracting to a named constant.`,
  };
}
