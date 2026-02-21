import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';

export function analyzeErrorHandling(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const file of ctx.files) {
    const isTest = file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__') || file.startsWith('tests/');
    if (isTest) continue;

    const content = getContent(ctx, file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const nextLine = lines[i + 1] || '';

      if (ctx.stack === 'python') {
        // Bare except
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

        // except with pass only
        if (/^\s*except\b/.test(line) && /^\s*pass\s*$/.test(nextLine)) {
          // Check if the line after pass is dedented (end of except block)
          const thirdLine = lines[i + 2] || '';
          const exceptIndent = (line.match(/^\s*/) || [''])[0].length;
          const thirdIndent = thirdLine.trim() ? (thirdLine.match(/^\s*/) || [''])[0].length : exceptIndent;
          if (thirdIndent <= exceptIndent || !thirdLine.trim()) {
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
      } else {
        // Empty catch blocks: catch (e) { } or catch { }
        const catchMatch = line.match(/catch\s*(?:\([^)]*\))?\s*\{/);
        if (catchMatch) {
          // Check if the catch block is empty (closing brace on same line or next non-empty line)
          const afterCatch = line.substring(line.indexOf('{', line.indexOf('catch')) + 1);
          if (/^\s*\}\s*$/.test(afterCatch) || /^\s*$/.test(afterCatch) && /^\s*\}\s*$/.test(nextLine)) {
            // Check it's truly empty (no comment either)
            const blockContent = afterCatch.trim() === '}' ? '' : nextLine.trim();
            if (blockContent === '}' || blockContent === '') {
              findings.push({
                rule: 'empty-catch',
                category: 'error-handling',
                severity: 'warning',
                file, line: lineNum,
                message: 'Empty catch block swallows errors silently.',
                suggestion: 'At minimum, log the error or add a comment explaining why it is ignored.',
              });
            }
          }
        }

        // .then() without .catch()
        if (/\.then\s*\(/.test(line)) {
          // Look ahead a few lines for .catch
          let hasCatch = false;
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            if (/\.catch\s*\(/.test(lines[j])) {
              hasCatch = true;
              break;
            }
          }
          if (!hasCatch) {
            // Skip if inside a try block (approximate: check indentation context)
            let inTry = false;
            for (let j = Math.max(0, i - 10); j < i; j++) {
              if (/\btry\s*\{/.test(lines[j])) inTry = true;
              if (/\bcatch\s*/.test(lines[j])) inTry = false;
            }
            if (!inTry) {
              findings.push({
                rule: 'unhandled-promise',
                category: 'error-handling',
                severity: 'warning',
                file, line: lineNum,
                message: '.then() without .catch() -- unhandled promise rejection possible.',
                suggestion: 'Add .catch() handler or use async/await with try/catch.',
              });
            }
          }
        }
      }
    }
  }

  return findings;
}
