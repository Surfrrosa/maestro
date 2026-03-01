import { describe, it, expect } from 'vitest';
import { inferProjectType, readPkg, extractDescription } from '../src/commands/scan-detectors.js';

describe('scan-detectors', () => {
  it('inferProjectType takes a cwd string and returns a string', () => {
    const type = inferProjectType('/tmp');
    expect(typeof type).toBe('string');
  });

  it('readPkg returns null for a directory without package.json', () => {
    const pkg = readPkg('/tmp');
    expect(pkg).toBeNull();
  });

  it('extractDescription returns a string', () => {
    const desc = extractDescription('/tmp');
    expect(typeof desc).toBe('string');
  });
});
