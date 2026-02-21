import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';

const MAX_FILE_LINES = 300;
const MAX_FUNCTION_LINES = 50;
const MAX_NESTING_DEPTH = 4;

export function analyzeComplexity(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const file of ctx.files) {
    const content = getContent(ctx, file);
    const lines = content.split('\n');

    // File size check
    if (lines.length > MAX_FILE_LINES) {
      findings.push({
        rule: 'file-size',
        category: 'complexity',
        severity: lines.length > 500 ? 'error' : 'warning',
        file,
        message: `File has ${lines.length} lines (max ${MAX_FILE_LINES}). Consider splitting into smaller modules.`,
        suggestion: 'Extract related functions into separate files.',
      });
    }

    // Function length check
    const funcFindings = analyzeFunctionLengths(content, file, ctx.stack);
    findings.push(...funcFindings);

    // Nesting depth check
    const nestFindings = analyzeNestingDepth(content, file, ctx.stack);
    findings.push(...nestFindings);
  }

  return findings;
}

function analyzeFunctionLengths(content: string, file: string, stack: string): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');

  if (stack === 'python') {
    // Python: track def/async def with indentation
    let funcStart = -1;
    let funcName = '';
    let funcIndent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+(\w+)/);

      if (defMatch) {
        // Close previous function if we're at same or lower indent
        if (funcStart >= 0 && defMatch[1].length <= funcIndent) {
          const funcLength = i - funcStart;
          if (funcLength > MAX_FUNCTION_LINES) {
            findings.push({
              rule: 'function-length',
              category: 'complexity',
              severity: funcLength > 100 ? 'error' : 'warning',
              file,
              line: funcStart + 1,
              message: `Function '${funcName}' is ${funcLength} lines (max ${MAX_FUNCTION_LINES}).`,
              suggestion: 'Break into smaller functions with single responsibilities.',
            });
          }
        }
        funcStart = i;
        funcName = defMatch[2];
        funcIndent = defMatch[1].length;
      }
    }
    // Check last function
    if (funcStart >= 0) {
      const funcLength = lines.length - funcStart;
      if (funcLength > MAX_FUNCTION_LINES) {
        findings.push({
          rule: 'function-length',
          category: 'complexity',
          severity: funcLength > 100 ? 'error' : 'warning',
          file,
          line: funcStart + 1,
          message: `Function '${funcName}' is ${funcLength} lines (max ${MAX_FUNCTION_LINES}).`,
          suggestion: 'Break into smaller functions with single responsibilities.',
        });
      }
    }
  } else {
    // TS/JS: track functions via brace counting
    const funcPattern = /(?:(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*\([^)]*\)\s*(?::\s*\w[^{]*)?\s*\{)/;
    let braceDepth = 0;
    let funcStart = -1;
    let funcName = '';
    let funcBraceStart = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Simple function detection at top level or method level
      if (funcStart < 0 || braceDepth <= funcBraceStart) {
        const match = line.match(funcPattern);
        if (match && line.includes('{')) {
          funcStart = i;
          funcName = match[1] || match[2] || match[3] || 'anonymous';
          funcBraceStart = braceDepth;
        }
      }

      // Count braces (simplified -- skip strings/comments)
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
        if (ch === '/' && line[j + 1] === '/') break; // Line comment
        if (ch === '{') braceDepth++;
        if (ch === '}') {
          braceDepth--;
          if (funcStart >= 0 && braceDepth <= funcBraceStart) {
            const funcLength = i - funcStart + 1;
            if (funcLength > MAX_FUNCTION_LINES) {
              findings.push({
                rule: 'function-length',
                category: 'complexity',
                severity: funcLength > 100 ? 'error' : 'warning',
                file,
                line: funcStart + 1,
                message: `Function '${funcName}' is ${funcLength} lines (max ${MAX_FUNCTION_LINES}).`,
                suggestion: 'Break into smaller functions with single responsibilities.',
              });
            }
            funcStart = -1;
          }
        }
      }
    }
  }

  return findings;
}

function analyzeNestingDepth(content: string, file: string, stack: string): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');
  const reported = new Set<number>(); // Don't report same nesting block multiple times

  if (stack === 'python') {
    // Python: use indentation level
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const level = Math.floor(indent / 4); // Assume 4-space indentation
      if (level > MAX_NESTING_DEPTH) {
        const blockStart = Math.floor(i / 10) * 10; // Group nearby lines
        if (!reported.has(blockStart)) {
          reported.add(blockStart);
          findings.push({
            rule: 'nesting-depth',
            category: 'complexity',
            severity: level > 6 ? 'error' : 'warning',
            file,
            line: i + 1,
            message: `Nesting depth of ${level} (max ${MAX_NESTING_DEPTH}). Deeply nested code is hard to follow.`,
            suggestion: 'Extract inner logic into separate functions or use early returns.',
          });
        }
      }
    }
  } else {
    // TS/JS: count brace depth
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let lineMaxDepth = depth;

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
          depth++;
          if (depth > lineMaxDepth) lineMaxDepth = depth;
        }
        if (ch === '}') depth--;
      }

      if (lineMaxDepth > MAX_NESTING_DEPTH) {
        const blockStart = Math.floor(i / 10) * 10;
        if (!reported.has(blockStart)) {
          reported.add(blockStart);
          findings.push({
            rule: 'nesting-depth',
            category: 'complexity',
            severity: lineMaxDepth > 6 ? 'error' : 'warning',
            file,
            line: i + 1,
            message: `Nesting depth of ${lineMaxDepth} (max ${MAX_NESTING_DEPTH}). Deeply nested code is hard to follow.`,
            suggestion: 'Extract inner logic into separate functions or use early returns.',
          });
        }
      }
    }
  }

  return findings;
}
