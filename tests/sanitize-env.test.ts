import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeEnvExampleIfMissing } from '../src/utils/sanitize-env.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'maestro-sanitize-env-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('writeEnvExampleIfMissing', () => {
  it('returns false when .env is missing', () => {
    expect(writeEnvExampleIfMissing(tmp)).toBe(false);
    expect(existsSync(join(tmp, '.env.example'))).toBe(false);
  });

  it('returns false when .env.example already exists', () => {
    writeFileSync(join(tmp, '.env'), 'API_KEY=secret');
    writeFileSync(join(tmp, '.env.example'), 'API_KEY=existing');
    expect(writeEnvExampleIfMissing(tmp)).toBe(false);
    expect(readFileSync(join(tmp, '.env.example'), 'utf-8')).toBe('API_KEY=existing');
  });

  it('replaces values with placeholder', () => {
    writeFileSync(join(tmp, '.env'), 'API_KEY=secret123\nDB_URL=postgres://x');
    expect(writeEnvExampleIfMissing(tmp)).toBe(true);
    const out = readFileSync(join(tmp, '.env.example'), 'utf-8');
    expect(out).toBe('API_KEY=your_value_here\nDB_URL=your_value_here');
  });

  it('preserves comment lines and blank lines', () => {
    writeFileSync(join(tmp, '.env'), '# comment\n\nKEY=value');
    writeEnvExampleIfMissing(tmp);
    expect(readFileSync(join(tmp, '.env.example'), 'utf-8'))
      .toBe('# comment\n\nKEY=your_value_here');
  });
});
