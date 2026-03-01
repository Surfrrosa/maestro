import { describe, it, expect } from 'vitest';
import { analyzeErrorHandling } from '../src/analyzers/error-handling.js';
import type { AnalyzerContext } from '../src/analyzers/types.js';

function makeContext(files: Record<string, string>, stack: 'node' | 'python' = 'node'): AnalyzerContext {
  return {
    cwd: '/fake',
    files: Object.keys(files),
    fileContents: new Map(Object.entries(files)),
    stack,
    sourceExtensions: stack === 'python' ? ['py'] : ['ts', 'js'],
    config: { quality: { ignore: [] } },
    pathAliases: new Map(),
  };
}

describe('analyzeErrorHandling', () => {
  it('detects empty catch blocks', () => {
    const ctx = makeContext({
      'src/app.ts': 'try { doThing(); } catch (e) { }\n',
    });
    const findings = analyzeErrorHandling(ctx);
    expect(findings.some(f => f.rule === 'empty-catch')).toBe(true);
  });

  it('returns empty findings for proper error handling', () => {
    const ctx = makeContext({
      'src/app.ts': 'try { doThing(); } catch (e) { console.error(e); }\n',
    });
    const findings = analyzeErrorHandling(ctx);
    expect(findings.filter(f => f.rule === 'empty-catch')).toHaveLength(0);
  });

  it('skips test files', () => {
    const ctx = makeContext({
      'tests/app.test.ts': 'try { doThing(); } catch (e) { }\n',
    });
    const findings = analyzeErrorHandling(ctx);
    expect(findings).toHaveLength(0);
  });
});
