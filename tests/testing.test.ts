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
  it('returns empty findings when no tests exist', () => {
    const ctx = makeContext({ 'src/app.ts': 'export function main() {}' });
    const findings = analyzeTesting(ctx);
    expect(findings).toHaveLength(0);
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

  it('detects tested files via import tracing', () => {
    const ctx = makeContext({
      'src/utils.ts': 'export function helper() { return 1; }',
      'src/app.ts': 'export function main() {}',
      'tests/integration.test.ts': "import { helper } from '../src/utils.js';\ntest('works', () => { helper(); });",
    });
    const findings = analyzeTesting(ctx);
    // utils.ts has no matching test filename, but integration.test.ts imports it
    expect(findings.every(f => f.file !== 'src/utils.ts')).toBe(true);
  });

  it('combines filename matching and import tracing', () => {
    const ctx = makeContext({
      'src/app.ts': 'export function main() {}',
      'src/utils.ts': 'export function helper() { return 1; }',
      'src/config.ts': 'export const config = {};',
      'tests/app.test.ts': 'test("works", () => {})',
      'tests/integration.test.ts': "import { helper } from '../src/utils.js';\ntest('works', () => {});",
    });
    const findings = analyzeTesting(ctx);
    // app.ts matched by filename, utils.ts matched by import — only config.ts should be flagged
    const missingTest = findings.filter(f => f.rule === 'missing-test');
    expect(missingTest).toHaveLength(1);
    expect(missingTest[0].file).toBe('src/config.ts');
  });

  it('only counts direct imports, not transitive', () => {
    const ctx = makeContext({
      'src/api.ts': "import { db } from './db.js';\nexport function fetch() { return db(); }",
      'src/db.ts': 'export function db() { return []; }',
      'tests/api.test.ts': "import { fetch } from '../src/api.js';\ntest('works', () => { fetch(); });",
    });
    const findings = analyzeTesting(ctx);
    // api.ts is covered by import, db.ts is NOT (only transitively imported)
    expect(findings.some(f => f.rule === 'missing-test' && f.file === 'src/db.ts')).toBe(true);
  });
});
