import { glob } from 'glob';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { detectStack } from '../utils/fs.js';
import { loadConfig } from '../utils/config.js';
import type { AnalyzerContext } from './types.js';

export async function buildContext(cwd: string): Promise<AnalyzerContext> {
  const stack = detectStack(cwd);
  const sourceExtensions = stack === 'python'
    ? ['py']
    : stack === 'node'
    ? ['ts', 'tsx', 'js', 'jsx']
    : ['ts', 'tsx', 'js', 'jsx', 'py'];

  const pattern = `**/*.{${sourceExtensions.join(',')}}`;
  const files = await glob(pattern, {
    cwd,
    ignore: [
      '**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**',
      '**/.git/**', '**/__pycache__/**', '**/coverage/**', '**/.expo/**',
      '*.min.js', '*.bundle.js', '*.d.ts',
    ],
    maxDepth: 8,
  });

  return {
    cwd,
    files,
    fileContents: new Map(),
    stack,
    sourceExtensions,
    config: loadConfig(cwd),
  };
}

export function getContent(ctx: AnalyzerContext, file: string): string {
  if (!ctx.fileContents.has(file)) {
    try {
      ctx.fileContents.set(file, readFileSync(join(ctx.cwd, file), 'utf-8'));
    } catch {
      ctx.fileContents.set(file, '');
    }
  }
  return ctx.fileContents.get(file)!;
}
