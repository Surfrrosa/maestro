import { describe, it, expect } from 'vitest';
import { analyzeTesting } from '../src/analyzers/testing.js';
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

describe('analyzeTesting', () => {
  it('returns a findings array', () => {
    const ctx = makeContext({ 'src/app.ts': 'export function main() {}' });
    const findings = analyzeTesting(ctx);
    expect(Array.isArray(findings)).toBe(true);
  });

  it('flags source files without tests when project has some tests', () => {
    const ctx = makeContext({
      'src/app.ts': 'export function main() {}',
      'src/utils.ts': 'export function helper() {}',
      'tests/app.test.ts': 'test("works", () => {})',
    });
    const findings = analyzeTesting(ctx);
    expect(findings.some(f => f.rule === 'missing-test' && f.file === 'src/utils.ts')).toBe(true);
  });

  it('does not flag when no tests exist at all', () => {
    const ctx = makeContext({
      'src/app.ts': 'export function main() {}',
    });
    const findings = analyzeTesting(ctx);
    expect(findings).toHaveLength(0);
  });
});
