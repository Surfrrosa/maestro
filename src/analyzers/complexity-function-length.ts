import type { QualityFinding } from './types.js';
import { FUNC_PATTERN, PYTHON_DEF_PATTERN } from './patterns.js';
import { createScannerState, scanBracesInLine } from '../utils/string-scanner.js';

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
    const defMatch = line.match(PYTHON_DEF_PATTERN);

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
  const scanner = createScannerState();
  let braceDepth = 0;
  let funcStart = -1;
  let funcName = '';
  let funcBraceStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (funcStart < 0 || braceDepth <= funcBraceStart) {
      const match = line.match(FUNC_PATTERN);
      if (match && line.includes('{')) {
        funcStart = i;
        funcName = match[1] || match[2] || match[3] || 'anonymous';
        funcBraceStart = braceDepth;
      }
    }

    scanBracesInLine(
      line,
      scanner,
      () => { braceDepth++; },
      () => {
        braceDepth--;
        if (funcStart >= 0 && braceDepth <= funcBraceStart) {
          pushFuncLengthFinding(findings, file, funcName, i - funcStart + 1, funcStart, maxFuncLines);
          funcStart = -1;
        }
      },
    );
  }

  return findings;
}
