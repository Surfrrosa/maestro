import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MaestroConfig } from '../analyzers/types.js';

const DEFAULT_CONFIG: MaestroConfig = {
  quality: { ignore: [] },
};

export function loadConfig(cwd: string): MaestroConfig {
  // .maestrorc.json takes priority
  try {
    const raw = readFileSync(join(cwd, '.maestrorc.json'), 'utf-8');
    return mergeConfig(JSON.parse(raw));
  } catch { /* not found or invalid */ }

  // Fall back to "maestro" key in package.json
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf-8'));
    if (pkg.maestro) return mergeConfig(pkg.maestro);
  } catch { /* not found or invalid */ }

  return DEFAULT_CONFIG;
}

function mergeConfig(raw: Record<string, unknown>): MaestroConfig {
  const quality = raw.quality as Record<string, unknown> | undefined;
  const ignore = Array.isArray(quality?.ignore) ? quality.ignore.filter((p): p is string => typeof p === 'string') : [];
  return { quality: { ignore } };
}
