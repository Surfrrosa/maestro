import { describe, it, expect } from 'vitest';
import { analyzeConsistency } from '../src/analyzers/consistency.js';
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

describe('analyzeConsistency', () => {
  it('returns empty findings for single file', () => {
    const ctx = makeContext({ 'src/app.ts': 'const x = 1;\n' });
    const findings = analyzeConsistency(ctx);
    expect(findings).toHaveLength(0);
  });

  it('detects mixed file naming conventions', () => {
    const ctx = makeContext({
      'src/my-component.ts': 'export const a = 1;',
      'src/another-file.ts': 'export const b = 2;',
      'src/third-thing.ts': 'export const c = 3;',
      'src/myHelper.ts': 'export const d = 4;',
    });
    const findings = analyzeConsistency(ctx);
    expect(findings.some(f => f.rule === 'inconsistent-file-naming')).toBe(true);
  });

  it('passes when all files use the same naming convention', () => {
    const ctx = makeContext({
      'src/my-component.ts': 'export const a = 1;',
      'src/another-file.ts': 'export const b = 2;',
      'src/third-thing.ts': 'export const c = 3;',
      'src/fourth-item.ts': 'export const d = 4;',
    });
    const findings = analyzeConsistency(ctx);
    expect(findings.filter(f => f.rule === 'inconsistent-file-naming')).toHaveLength(0);
  });
});
