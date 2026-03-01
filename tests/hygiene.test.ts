import { describe, it, expect } from 'vitest';
import { analyzeHygiene } from '../src/analyzers/hygiene.js';
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

describe('analyzeHygiene', () => {
  it('detects console.log in source files', () => {
    const ctx = makeContext({
      'src/app.ts': 'console.log("debug");\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.some(f => f.rule === 'debug-statement')).toBe(true);
  });

  it('detects TODO comments', () => {
    const ctx = makeContext({
      'src/app.ts': '// TODO: fix this later\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.some(f => f.rule === 'tech-debt-marker')).toBe(true);
  });

  it('returns clean findings for well-written code', () => {
    const ctx = makeContext({
      'src/app.ts': 'export function greet(name: string) { return `Hello ${name}`; }\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
    expect(findings.filter(f => f.rule === 'tech-debt-marker')).toHaveLength(0);
  });
});
