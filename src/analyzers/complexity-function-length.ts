import type { QualityFinding } from './types.js';

export function analyzeFunctionLengths(content: string, file: string, stack: string, maxFuncLines: number): QualityFinding[] {
  if (stack === 'python') {
    return analyzePythonFunctionLengths(content, file, maxFuncLines);
  }
  return analyzeJsFunctionLengths(content, file, maxFuncLines);
}

function pushFuncLengthFinding(findings: QualityFinding[], file: string, funcName: string, funcLength: number, funcStart: number, maxFuncLines: number): void {
  if (funcLength > maxFuncLines) {
    findings.push({
      rule: 'function-length',
      category: 'complexity',
      severity: funcLength > 100 ? 'error' : 'warning',
      file,
      line: funcStart + 1,
      message: `Function '${funcName}' is ${funcLength} lines (max ${maxFuncLines}).`,
      suggestion: 'Break into smaller functions with single responsibilities.',
    });
  }
}

function analyzePythonFunctionLengths(content: string, file: string, maxFuncLines: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  let funcStart = -1;
  let funcName = '';
  let funcIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+(\w+)/);

    if (defMatch) {
      if (funcStart >= 0 && defMatch[1].length <= funcIndent) {
        pushFuncLengthFinding(findings, file, funcName, i - funcStart, funcStart, maxFuncLines);
      }
      funcStart = i;
      funcName = defMatch[2];
      funcIndent = defMatch[1].length;
    }
  }
  if (funcStart >= 0) {
    pushFuncLengthFinding(findings, file, funcName, lines.length - funcStart, funcStart, maxFuncLines);
  }

  return findings;
}

function analyzeJsFunctionLengths(content: string, file: string, maxFuncLines: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  const funcPattern = /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{)/;
  let braceDepth = 0;
  let funcStart = -1;
  let funcName = '';
  let funcBraceStart = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (funcStart < 0 || braceDepth <= funcBraceStart) {
      const match = line.match(funcPattern);
      if (match && line.includes('{')) {
        funcStart = i;
        funcName = match[1] || match[2] || match[3] || 'anonymous';
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
        if (funcStart >= 0 && braceDepth <= funcBraceStart) {
          pushFuncLengthFinding(findings, file, funcName, i - funcStart + 1, funcStart, maxFuncLines);
          funcStart = -1;
        }
      }
    }
  }

  return findings;
}
