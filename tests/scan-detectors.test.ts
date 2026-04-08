import { describe, it, expect } from 'vitest';
import { inferProjectType, readPkg, extractDescription } from '../src/commands/scan-detectors.js';

describe('scan-detectors', () => {
  it('inferProjectType returns a project type string for any directory', () => {
    const type = inferProjectType('/tmp');
    expect(type.length).toBeGreaterThan(0);
  });

  it('readPkg returns null for a directory without package.json', () => {
    const pkg = readPkg('/tmp');
    expect(pkg).toBeNull();
  });

  it('extractDescription returns placeholder for directory without manifest', () => {
    const desc = extractDescription('/tmp');
    expect(desc).toContain('no description found');
  });
});
