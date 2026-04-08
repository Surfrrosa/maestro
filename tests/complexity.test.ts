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
  it('returns empty findings for clean code', () => {
    const ctx = makeContext({ 'src/app.ts': 'const x = 1;\n' });
    const findings = analyzeComplexity(ctx);
    expect(findings).toHaveLength(0);
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

  it('flags files over 500 lines as error', () => {
    const hugeFile = Array(550).fill('const x = 1;').join('\n');
    const ctx = makeContext({ 'src/huge.ts': hugeFile });
    const findings = analyzeComplexity(ctx);
    const fileSizeFinding = findings.find(f => f.rule === 'file-size');
    expect(fileSizeFinding?.severity).toBe('error');
  });

  it('flags deeply nested code', () => {
    const nested = `
function deep() {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            console.log('deep');
          }
        }
      }
    }
  }
}`;
    const ctx = makeContext({ 'src/nested.ts': nested });
    const findings = analyzeComplexity(ctx);
    expect(findings.some(f => f.rule === 'nesting-depth')).toBe(true);
  });

  it('does not flag object literals as nesting depth', () => {
    const code = `
function setup() {
  const config: Record<string, string> = {
    'src/api': 'API routes and handlers',
    'src/commands': 'CLI commands',
    'src/components': 'React components',
    'src/lib': 'Shared utilities',
  };
  return config;
}`;
    const ctx = makeContext({ 'src/config.ts': code });
    const findings = analyzeComplexity(ctx);
    expect(findings.filter(f => f.rule === 'nesting-depth')).toHaveLength(0);
  });

  it('does not flag nested object literals in function calls', () => {
    const code = `
describe('test', () => {
  it('works', () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: {
          chalk: '5.3.0',
        },
      }),
    });
  });
});`;
    const ctx = makeContext({ 'tests/example.test.ts': code });
    const findings = analyzeComplexity(ctx);
    expect(findings.filter(f => f.rule === 'nesting-depth')).toHaveLength(0);
  });

  it('flags deeply nested control flow', () => {
    const code = `
function scan(files: string[]) {
  for (const file of files) {
    try {
      for (let i = 0; i < 100; i++) {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            console.log('deep');
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
}`;
    const ctx = makeContext({ 'src/scanner.ts': code });
    const findings = analyzeComplexity(ctx);
    expect(findings.some(f => f.rule === 'nesting-depth')).toBe(true);
  });

  it('counts only control flow depth in mixed code', () => {
    const code = `
function process() {
  for (const item of items) {
    if (item.active) {
      if (item.type === 'special') {
        if (item.value > 10) {
          results.push({
            name: item.name,
            details: {
              score: item.value,
            },
          });
        }
      }
    }
  }
}`;
    const ctx = makeContext({ 'src/process.ts': code });
    const findings = analyzeComplexity(ctx);
    expect(findings.some(f => f.rule === 'nesting-depth')).toBe(true);
  });
});
