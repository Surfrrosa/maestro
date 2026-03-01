import { describe, it, expect } from 'vitest';
import { analyzeStructure } from '../src/analyzers/structure.js';
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

describe('analyzeStructure', () => {
  it('returns an array', () => {
    const ctx = makeContext({ 'src/app.ts': 'export const x = 1;\n' });
    const findings = analyzeStructure(ctx);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('flags flat directories with many files', () => {
    const files: Record<string, string> = {};
    for (let i = 0; i < 20; i++) {
      files[`src/file${i}.ts`] = `export const x${i} = ${i};`;
    }
    const ctx = makeContext(files);
    const findings = analyzeStructure(ctx);
    expect(findings.some(f => f.rule === 'flat-directory')).toBe(true);
  });
});
