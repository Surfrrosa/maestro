import type { QualityFinding } from './types.js';

function isControlFlowBrace(line: string, braceIndex: number): boolean {
  const left = line.substring(0, braceIndex).trimEnd();
  if (left.length === 0) return false;

  const lastChar = left[left.length - 1];

  if (lastChar === ')') return true;

  if (left.length >= 2 && left[left.length - 2] === '=' && lastChar === '>') return true;

  if (/(?:^|[^a-zA-Z0-9_$])(else|try|finally|do|catch)\s*$/.test(left)) return true;

  return false;
}

function pushNestingFinding(findings: QualityFinding[], file: string, maxDepth: number, maxNesting: number, startLine: number): void {
  findings.push({
    rule: 'nesting-depth',
    category: 'complexity',
    severity: maxDepth > 6 ? 'error' : 'warning',
    file,
    line: startLine + 1,
    message: `Nesting depth of ${maxDepth} (max ${maxNesting}). Deeply nested code is hard to follow.`,
    suggestion: 'Extract inner logic into separate functions or use early returns.',
  });
}

export function analyzeNestingDepth(content: string, file: string, stack: string, maxNesting: number): QualityFinding[] {
  if (stack === 'python') {
    return analyzePythonNesting(content, file, maxNesting);
  }
  return analyzeJsNesting(content, file, maxNesting);
}

function analyzePythonNesting(content: string, file: string, maxNesting: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  let inDeepBlock = false;
  let blockStartLine = -1;
  let blockMaxLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const indent = line.match(/^(\s*)/)?.[1].length || 0;
    const level = Math.floor(indent / 4);

    if (level > maxNesting) {
      if (!inDeepBlock) {
        inDeepBlock = true;
        blockStartLine = i;
        blockMaxLevel = level;
      } else if (level > blockMaxLevel) {
        blockMaxLevel = level;
      }
    } else if (inDeepBlock) {
      pushNestingFinding(findings, file, blockMaxLevel, maxNesting, blockStartLine);
      inDeepBlock = false;
    }
  }
  if (inDeepBlock) {
    pushNestingFinding(findings, file, blockMaxLevel, maxNesting, blockStartLine);
  }

  return findings;
}

function analyzeJsNesting(content: string, file: string, maxNesting: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  const braceStack: boolean[] = [];
  let controlDepth = 0;
  let inString = false;
  let stringChar = '';
  let inDeepBlock = false;
  let blockStartLine = -1;
  let blockMaxDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let lineMaxDepth = controlDepth;

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
      if (ch === '{') {
        const isControl = isControlFlowBrace(line, j);
        braceStack.push(isControl);
        if (isControl) {
          controlDepth++;
          if (controlDepth > lineMaxDepth) lineMaxDepth = controlDepth;
        }
      }
      if (ch === '}') {
        const wasControl = braceStack.pop();
        if (wasControl) controlDepth--;
      }
    }

    if (lineMaxDepth > maxNesting) {
      if (!inDeepBlock) {
        inDeepBlock = true;
        blockStartLine = i;
        blockMaxDepth = lineMaxDepth;
      } else if (lineMaxDepth > blockMaxDepth) {
        blockMaxDepth = lineMaxDepth;
      }
    } else if (inDeepBlock) {
      pushNestingFinding(findings, file, blockMaxDepth, maxNesting, blockStartLine);
      inDeepBlock = false;
    }
  }
  if (inDeepBlock) {
    pushNestingFinding(findings, file, blockMaxDepth, maxNesting, blockStartLine);
  }

  return findings;
}
