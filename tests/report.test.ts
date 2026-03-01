import { describe, it, expect } from 'vitest';
import { countBySeverity, countByCategory } from '../src/commands/report-scoring.js';

describe('report-scoring exports', () => {
  it('countBySeverity returns counts object for empty array', () => {
    const counts = countBySeverity([]);
    expect(counts).toBeDefined();
    expect(counts.critical).toBe(0);
    expect(counts.high).toBe(0);
    expect(counts.medium).toBe(0);
    expect(counts.low).toBe(0);
  });

  it('countByCategory returns counts object for empty array', () => {
    const counts = countByCategory([]);
    expect(counts).toBeDefined();
    expect(counts.unused).toBe(0);
    expect(counts.phantom).toBe(0);
    expect(counts.license).toBe(0);
  });
});
