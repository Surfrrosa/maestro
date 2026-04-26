import type { QualityFinding } from './types.js';
import { FUNC_PATTERN, PYTHON_DEF_PATTERN, JS_KEYWORDS } from './patterns.js';
import { type ScannerState, scanBracesInLine } from '../utils/string-scanner.js';

function isControlFlowBrace(line: string, braceIndex: number): boolean {
  const left = line.substring(0, braceIndex).trimEnd();
  if (left.length === 0) return false;

  const lastChar = left[left.length - 1];

  if (lastChar === ')') return true;

  if (left.length >= 2 && left[left.length - 2] === '=' && lastChar === '>') return true;

  if (/(?:^|[^a-zA-Z0-9_$])(else|try|finally|do|catch)\s*$/.test(left)) return true;

  return false;
}

function pushNestingFinding(findings: QualityFinding[], file: string, maxDepth: number, maxNesting: number, startLine: number, funcName?: string): void {
  const context = funcName ? ` in '${funcName}'` : '';
  findings.push({
    rule: 'nesting-depth',
    category: 'complexity',
    severity: maxDepth > 6 ? 'error' : 'warning',
    file,
    line: startLine + 1,
    message: `Nesting depth of ${maxDepth}${context} (max ${maxNesting}). Deeply nested code is hard to follow.`,
    suggestion: 'Extract inner logic into separate functions or use early returns.',
  });
}

export function analyzeNestingDepth(content: string, file: string, stack: string, maxNesting: number): QualityFinding[] {
  if (stack === 'python') {
    return analyzePythonNesting(content, file, maxNesting);
  }
  return analyzeJsNesting(content, file, maxNesting);
}

interface BraceState extends ScannerState {
  braceStack: boolean[];
  controlDepth: number;
  currentFuncName?: string;
  funcBraceStart: number;
}

function scanLineCharacters(line: string, state: BraceState): number {
  let lineMaxDepth = state.controlDepth;
  scanBracesInLine(
    line,
    state,
    (col) => {
      const isControl = isControlFlowBrace(line, col);
      state.braceStack.push(isControl);
      if (isControl) {
        state.controlDepth++;
        if (state.controlDepth > lineMaxDepth) lineMaxDepth = state.controlDepth;
      }
    },
    () => {
      const wasControl = state.braceStack.pop();
      if (wasControl) state.controlDepth--;
      if (state.funcBraceStart >= 0 && state.braceStack.length <= state.funcBraceStart) {
        state.currentFuncName = undefined;
        state.funcBraceStart = -1;
      }
    },
  );
  return lineMaxDepth;
}

function analyzePythonNesting(content: string, file: string, maxNesting: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  let inDeepBlock = false;
  let blockStartLine = -1;
  let blockMaxLevel = 0;
  let blockFuncName: string | undefined;
  let currentFuncName: string | undefined;
  let funcIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^(\s*)/)?.[1].length || 0;
    const level = Math.floor(indent / 4);

    const defMatch = line.match(PYTHON_DEF_PATTERN);
    if (defMatch) {
      currentFuncName = defMatch[2];
      funcIndent = defMatch[1].length;
    } else if (currentFuncName && indent <= funcIndent) {
      currentFuncName = undefined;
      funcIndent = -1;
    }

    if (level > maxNesting) {
      if (!inDeepBlock) {
        inDeepBlock = true;
        blockStartLine = i;
        blockMaxLevel = level;
        blockFuncName = currentFuncName;
      } else if (level > blockMaxLevel) {
        blockMaxLevel = level;
      }
    } else if (inDeepBlock) {
      pushNestingFinding(findings, file, blockMaxLevel, maxNesting, blockStartLine, blockFuncName);
      inDeepBlock = false;
    }
  }
  if (inDeepBlock) {
    pushNestingFinding(findings, file, blockMaxLevel, maxNesting, blockStartLine, blockFuncName);
  }

  return findings;
}

function analyzeJsNesting(content: string, file: string, maxNesting: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  const state: BraceState = {
    braceStack: [],
    controlDepth: 0,
    inString: false,
    stringChar: '',
    funcBraceStart: -1,
  };
  let inDeepBlock = false;
  let blockStartLine = -1;
  let blockMaxDepth = 0;
  let blockFuncName: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (state.funcBraceStart < 0 || state.braceStack.length <= state.funcBraceStart) {
      const match = line.match(FUNC_PATTERN);
      if (match && line.includes('{')) {
        const name = match[1] || match[2] || match[3];
        state.currentFuncName = name && !JS_KEYWORDS.has(name) ? name : undefined;
        state.funcBraceStart = state.braceStack.length;
      }
    }

    const lineMaxDepth = scanLineCharacters(line, state);

    if (lineMaxDepth > maxNesting) {
      if (!inDeepBlock) {
        inDeepBlock = true;
        blockStartLine = i;
        blockMaxDepth = lineMaxDepth;
        blockFuncName = state.currentFuncName;
      } else if (lineMaxDepth > blockMaxDepth) {
        blockMaxDepth = lineMaxDepth;
      }
    } else if (inDeepBlock) {
      pushNestingFinding(findings, file, blockMaxDepth, maxNesting, blockStartLine, blockFuncName);
      inDeepBlock = false;
    }
  }
  if (inDeepBlock) {
    pushNestingFinding(findings, file, blockMaxDepth, maxNesting, blockStartLine, blockFuncName);
  }

  return findings;
}
