import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from '../src/analyzers/complexity.js';
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

describe('analyzeComplexity', () => {
  it('returns a findings array', () => {
    const ctx = makeContext({ 'src/app.ts': 'const x = 1;\n' });
    const findings = analyzeComplexity(ctx);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('flags large files over 300 lines', () => {
    const bigFile = Array(350).fill('const x = 1;').join('\n');
    const ctx = makeContext({ 'src/big.ts': bigFile });
    const findings = analyzeComplexity(ctx);
    expect(findings.some(f => f.rule === 'file-size')).toBe(true);
  });

  it('passes small files under 300 lines', () => {
    const smallFile = Array(50).fill('const x = 1;').join('\n');
    const ctx = makeContext({ 'src/small.ts': smallFile });
    const findings = analyzeComplexity(ctx);
    expect(findings.some(f => f.rule === 'file-size')).toBe(false);
  });
});
