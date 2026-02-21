import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';

export function analyzeHygiene(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];

  for (const file of ctx.files) {
    const isTest = file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__') || file.startsWith('tests/');
    // CLI commands are expected to use console.log for output
    const isCLI = file.includes('commands/') || file.includes('bin/') || file.includes('cli');
    const content = getContent(ctx, file);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // console.log / console.debug / console.info in non-test, non-CLI files
      if (!isTest && !isCLI && /\bconsole\.(log|debug|info)\s*\(/.test(line)) {
        // Skip if it's a logging utility definition
        if (/(?:function|const|let|var)\s+(?:log|logger|debug|info)/.test(line)) continue;
        findings.push({
          rule: 'debug-statement',
          category: 'hygiene',
          severity: 'warning',
          file, line: lineNum,
          message: `Debug statement: console.${line.match(/console\.(\w+)/)?.[1] || 'log'}()`,
          suggestion: 'Remove debug logging or use a proper logging library.',
        });
      }

      // Python print() in non-test files
      if (!isTest && ctx.stack === 'python' && /\bprint\s*\(/.test(line)) {
        if (/^\s*#/.test(line)) continue; // Skip comments
        findings.push({
          rule: 'debug-statement',
          category: 'hygiene',
          severity: 'warning',
          file, line: lineNum,
          message: 'Debug print() statement',
          suggestion: 'Use logging module instead of print().',
        });
      }

      // TODO / FIXME / HACK / XXX
      const todoMatch = line.match(/(?:\/\/|#|\/\*)\s*(TODO|FIXME|HACK|XXX)\b:?\s*(.*)/i);
      if (todoMatch) {
        findings.push({
          rule: 'tech-debt-marker',
          category: 'hygiene',
          severity: 'info',
          file, line: lineNum,
          message: `${todoMatch[1].toUpperCase()}: ${todoMatch[2].substring(0, 60) || '(no description)'}`,
          suggestion: 'Track in CLAUDE.md Known Technical Debt section.',
        });
      }

      // Magic numbers (only for meaningful contexts, skip common patterns)
      if (!isTest) {
        const magicMatch = line.match(/(?:===?|!==?|>=?|<=?|return)\s+(\d{3,})/);
        if (magicMatch) {
          const num = parseInt(magicMatch[1]);
          // Skip HTTP status codes, common ports, common sizes
          const common = [100, 200, 201, 204, 301, 302, 304, 400, 401, 403, 404, 500, 502, 503, 1000, 1024, 3000, 4000, 5000, 8000, 8080, 8443, 9090];
          if (!common.includes(num) && !/const|let|var|enum|type|interface/.test(line)) {
            findings.push({
              rule: 'magic-number',
              category: 'hygiene',
              severity: 'info',
              file, line: lineNum,
              message: `Magic number ${num}. Consider extracting to a named constant.`,
            });
          }
        }
      }
    }
  }

  return findings;
}
