import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';
import { FUNC_PATTERN, PYTHON_DEF_PATTERN, JS_KEYWORDS, isTestFile } from './patterns.js';

export function analyzeHygiene(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const file of ctx.files) {
    const isTest = isTestFile(file);
    const isCLI = file.includes('commands/') || file.includes('bin/') || file.includes('cli');
    const content = getContent(ctx, file);
    const lines = content.split('\n');
    const funcMap = buildFunctionMap(lines, ctx.stack);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const funcName = funcMap.get(lineNum);

      const debugFinding = checkDebugStatements(line, lineNum, file, isTest, isCLI, ctx.stack, funcName);
      if (debugFinding) findings.push(debugFinding);

      const debtFinding = checkTechDebtMarkers(line, lineNum, file, funcName);
      if (debtFinding) findings.push(debtFinding);

      const magicFinding = checkMagicNumbers(line, lineNum, file, isTest, funcName);
      if (magicFinding) findings.push(magicFinding);
    }
  }

  return findings;
}

function buildFunctionMap(lines: string[], stack: string): Map<number, string> {
  if (stack === 'python') return buildPythonFunctionMap(lines);
  return buildJsFunctionMap(lines);
}

function buildJsFunctionMap(lines: string[]): Map<number, string> {
  const funcMap = new Map<number, string>();
  let braceDepth = 0;
  let funcBraceStart = -1;
  let currentFunc = '';
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (funcBraceStart < 0 || braceDepth <= funcBraceStart) {
      const match = line.match(FUNC_PATTERN);
      if (match && line.includes('{')) {
        const name = match[1] || match[2] || match[3] || '';
        currentFunc = name && !JS_KEYWORDS.has(name) ? name : '';
        funcBraceStart = braceDepth;
      }
    }

    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inString) {
        if (ch === stringChar && line[j - 1] !== '\\') inString = false;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === '/' && line[j + 1] === '/') break;
      if (ch === '{') braceDepth++;
      if (ch === '}') {
        braceDepth--;
        if (funcBraceStart >= 0 && braceDepth <= funcBraceStart) {
          currentFunc = '';
          funcBraceStart = -1;
        }
      }
    }

    if (currentFunc) funcMap.set(i + 1, currentFunc);
  }

  return funcMap;
}

function buildPythonFunctionMap(lines: string[]): Map<number, string> {
  const funcMap = new Map<number, string>();
  let currentFunc = '';
  let funcIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) {
      if (currentFunc) funcMap.set(i + 1, currentFunc);
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length || 0;
    const defMatch = line.match(PYTHON_DEF_PATTERN);
    if (defMatch) {
      currentFunc = defMatch[2];
      funcIndent = defMatch[1].length;
    } else if (currentFunc && indent <= funcIndent) {
      currentFunc = '';
      funcIndent = -1;
    }
    if (currentFunc) funcMap.set(i + 1, currentFunc);
  }

  return funcMap;
}

function checkDebugStatements(line: string, lineNum: number, file: string, isTest: boolean, isCLI: boolean, stack: string, funcName?: string): QualityFinding | null {
  if (!isTest && !isCLI && /\bconsole\.(log|debug|info)\s*\(/.test(line)) {
    if (/(?:function|const|let|var)\s+(?:log|logger|debug|info)/.test(line)) return null;
    const method = line.match(/console\.(\w+)/)?.[1] || 'log';
    const context = funcName ? ` in '${funcName}'` : '';
    return {
      rule: 'debug-statement',
      category: 'hygiene',
      severity: 'warning',
      file, line: lineNum,
      message: `Debug statement: console.${method}()${context}`,
      suggestion: 'Remove debug logging or use a proper logging library.',
    };
  }

  if (!isTest && stack === 'python' && /\bprint\s*\(/.test(line)) {
    if (/^\s*#/.test(line)) return null;
    const context = funcName ? ` in '${funcName}'` : '';
    return {
      rule: 'debug-statement',
      category: 'hygiene',
      severity: 'warning',
      file, line: lineNum,
      message: `Debug print() statement${context}`,
      suggestion: 'Use logging module instead of print().',
    };
  }

  return null;
}

function checkTechDebtMarkers(line: string, lineNum: number, file: string, funcName?: string): QualityFinding | null {
  const todoMatch = line.match(/(?:\/\/|#|\/\*)\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/i);
  if (todoMatch) {
    const context = funcName ? ` in '${funcName}'` : '';
    return {
      rule: 'tech-debt-marker',
      category: 'hygiene',
      severity: 'info',
      file, line: lineNum,
      message: `${todoMatch[1].toUpperCase()}${context}: ${todoMatch[2].substring(0, 60) || '(no description)'}`,
      suggestion: 'Track in CLAUDE.md Known Technical Debt section.',
    };
  }
  return null;
}

function checkMagicNumbers(line: string, lineNum: number, file: string, isTest: boolean, funcName?: string): QualityFinding | null {
  if (isTest) return null;

  const magicMatch = line.match(/(?:===?|!==?|>=?|<=?|return)\s+(\d{3,})/);
  if (!magicMatch) return null;

  const num = parseInt(magicMatch[1]);
  const common = [100, 200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 500, 502, 503, 1000, 1024, 3000, 4000, 5000, 8000, 8080, 8443, 9090];
  if (common.includes(num) || /const|let|var|enum|type|interface/.test(line)) return null;

  const context = funcName ? ` in '${funcName}'` : '';
  return {
    rule: 'magic-number',
    category: 'hygiene',
    severity: 'info',
    file, line: lineNum,
    message: `Magic number ${num}${context}. Consider extracting to a named constant.`,
  };
}
