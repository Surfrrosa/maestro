import { describe, it, expect } from 'vitest';
import { analyzeDeadCode } from '../src/analyzers/dead-code.js';
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

describe('analyzeDeadCode', () => {
  it('returns a findings array', () => {
    const ctx = makeContext({ 'src/app.ts': 'export const x = 1;\n' });
    const findings = analyzeDeadCode(ctx);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('flags files that are never imported', () => {
    const ctx = makeContext({
      'src/used.ts': 'import { helper } from "./helper.js";\nexport const x = 1;',
      'src/helper.ts': 'export function helper() {}',
      'src/orphan.ts': 'export function lonely() {}',
    });
    const findings = analyzeDeadCode(ctx);
    expect(findings.some(f => f.rule === 'unused-file' && f.file === 'src/orphan.ts')).toBe(true);
  });

  it('does not flag entry-point files', () => {
    const ctx = makeContext({
      'src/index.ts': 'export const x = 1;',
    });
    const findings = analyzeDeadCode(ctx);
    expect(findings.some(f => f.file === 'src/index.ts')).toBe(false);
  });
});
