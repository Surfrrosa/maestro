import { join } from 'node:path';
import { fileExists, readFile, writeFile } from './fs.js';

/**
 * Generate `.env.example` from `.env` by replacing each value with a
 * placeholder. No-op if `.env` is missing or `.env.example` already exists.
 *
 * Returns true if a file was written, false if skipped.
 */
export function writeEnvExampleIfMissing(cwd: string): boolean {
  if (!fileExists(join(cwd, '.env')) || fileExists(join(cwd, '.env.example'))) {
    return false;
  }
  const sanitized = readFile(join(cwd, '.env'))
    .split('\n')
    .map(line => {
      if (line.startsWith('#') || !line.includes('=')) return line;
      const eqIndex = line.indexOf('=');
      return `${line.substring(0, eqIndex)}=your_value_here`;
    })
    .join('\n');
  writeFile(join(cwd, '.env.example'), sanitized);
  return true;
}
