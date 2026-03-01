import { describe, it, expect } from 'vitest';
import { generateSessionLog } from '../src/templates/session-log.js';

describe('generateSessionLog', () => {
  it('generates session log containing the provided date', () => {
    const result = generateSessionLog('2026-03-01');
    expect(result).toContain('2026-03-01');
  });

  it('includes standard session log sections', () => {
    const result = generateSessionLog('2026-03-01');
    expect(result).toContain('Objectives');
    expect(result).toContain('Accomplished');
  });
});
