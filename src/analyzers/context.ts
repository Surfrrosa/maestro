import { glob } from 'glob';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { detectStack } from '../utils/fs.js';
import { loadConfig } from '../utils/config.js';
import type { AnalyzerContext } from './types.js';

function loadPathAliases(cwd: string): Map<string, string> {
  const aliases = new Map<string, string>();
  try {
    const raw = JSON.parse(readFileSync(join(cwd, 'tsconfig.json'), 'utf-8'));
    const paths = raw.compilerOptions?.paths as Record<string, string[]> | undefined;
    if (!paths) return aliases;
    for (const [alias, targets] of Object.entries(paths)) {
      if (targets.length > 0) {
        // "@/*" -> "./src/*"  =>  "@/" -> "src/"
        const prefix = alias.replace(/\*$/, '');
        const target = targets[0].replace(/^\.\//, '').replace(/\*$/, '');
        aliases.set(prefix, target);
      }
    }
  } catch { /* no tsconfig or invalid */ }
  return aliases;
}

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
    pathAliases: loadPathAliases(cwd),
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
