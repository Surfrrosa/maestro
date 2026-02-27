import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';

// Default thresholds -- overridable via .maestrorc.json quality.thresholds
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

    // File size check
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

    // Function length check
    const funcFindings = analyzeFunctionLengths(content, file, ctx.stack, maxFuncLines);
    findings.push(...funcFindings);

    // Nesting depth check
    const nestFindings = analyzeNestingDepth(content, file, ctx.stack, maxNesting);
    findings.push(...nestFindings);
  }

  return findings;
}

function analyzeFunctionLengths(content: string, file: string, stack: string, maxFuncLines: number): QualityFinding[] {
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
        funcStart = i;
        funcName = defMatch[2];
        funcIndent = defMatch[1].length;
      }
    }
    // Check last function
    if (funcStart >= 0) {
      const funcLength = lines.length - funcStart;
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
            funcStart = -1;
          }
        }
      }
    }
  }

  return findings;
}

function analyzeNestingDepth(content: string, file: string, stack: string, maxNesting: number): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const lines = content.split('\n');

  if (stack === 'python') {
    // Python: use indentation level. Report once per contiguous deep block.
    let inDeepBlock = false;
    let blockStartLine = -1;
    let blockMaxLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.trim()) continue;
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      const level = Math.floor(indent / 4); // Assume 4-space indentation

      if (level > maxNesting) {
        if (!inDeepBlock) {
          inDeepBlock = true;
          blockStartLine = i;
          blockMaxLevel = level;
        } else if (level > blockMaxLevel) {
          blockMaxLevel = level;
        }
      } else if (inDeepBlock) {
        // Exited deep block -- emit one finding
        findings.push({
          rule: 'nesting-depth',
          category: 'complexity',
          severity: blockMaxLevel > 6 ? 'error' : 'warning',
          file,
          line: blockStartLine + 1,
          message: `Nesting depth of ${blockMaxLevel} (max ${maxNesting}). Deeply nested code is hard to follow.`,
          suggestion: 'Extract inner logic into separate functions or use early returns.',
        });
        inDeepBlock = false;
      }
    }
    // Close any trailing deep block
    if (inDeepBlock) {
      findings.push({
        rule: 'nesting-depth',
        category: 'complexity',
        severity: blockMaxLevel > 6 ? 'error' : 'warning',
        file,
        line: blockStartLine + 1,
        message: `Nesting depth of ${blockMaxLevel} (max ${maxNesting}). Deeply nested code is hard to follow.`,
        suggestion: 'Extract inner logic into separate functions or use early returns.',
      });
    }
  } else {
    // TS/JS: count brace depth. Report once when depth first exceeds threshold.
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let inDeepBlock = false;
    let blockStartLine = -1;
    let blockMaxDepth = 0;

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

      if (lineMaxDepth > maxNesting) {
        if (!inDeepBlock) {
          inDeepBlock = true;
          blockStartLine = i;
          blockMaxDepth = lineMaxDepth;
        } else if (lineMaxDepth > blockMaxDepth) {
          blockMaxDepth = lineMaxDepth;
        }
      } else if (inDeepBlock) {
        // Exited deep block -- emit one finding
        findings.push({
          rule: 'nesting-depth',
          category: 'complexity',
          severity: blockMaxDepth > 6 ? 'error' : 'warning',
          file,
          line: blockStartLine + 1,
          message: `Nesting depth of ${blockMaxDepth} (max ${maxNesting}). Deeply nested code is hard to follow.`,
          suggestion: 'Extract inner logic into separate functions or use early returns.',
        });
        inDeepBlock = false;
      }
    }
    // Close any trailing deep block
    if (inDeepBlock) {
      findings.push({
        rule: 'nesting-depth',
        category: 'complexity',
        severity: blockMaxDepth > 6 ? 'error' : 'warning',
        file,
        line: blockStartLine + 1,
        message: `Nesting depth of ${blockMaxDepth} (max ${maxNesting}). Deeply nested code is hard to follow.`,
        suggestion: 'Extract inner logic into separate functions or use early returns.',
      });
    }
  }

  return findings;
}
