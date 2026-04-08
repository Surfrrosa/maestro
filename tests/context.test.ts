import { describe, it, expect } from 'vitest';
import { getContent } from '../src/analyzers/context.js';
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

describe('getContent', () => {
  it('returns cached content from fileContents map', () => {
    const ctx = makeContext({ 'src/app.ts': 'const x = 42;\n' });
    const content = getContent(ctx, 'src/app.ts');
    expect(content).toBe('const x = 42;\n');
  });

  it('returns empty string for files not on disk when cwd is fake', () => {
    const ctx = makeContext({});
    const content = getContent(ctx, 'src/missing.ts');
    expect(content).toBe('');
  });

  it('reads from the live fileContents map', () => {
    const ctx = makeContext({ 'src/app.ts': 'hello' });
    getContent(ctx, 'src/app.ts');
    ctx.fileContents.set('src/app.ts', 'modified');
    const content = getContent(ctx, 'src/app.ts');
    expect(content).toBe('modified');
  });
});
