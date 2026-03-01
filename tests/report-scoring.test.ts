import { describe, it, expect } from 'vitest';
import { countBySeverity, countByCategory, buildAttentionItems } from '../src/commands/report-scoring.js';

describe('report-scoring', () => {
  it('countBySeverity handles empty findings', () => {
    const counts = countBySeverity([]);
    expect(counts).toBeDefined();
    expect(counts.critical).toBe(0);
  });

  it('countByCategory handles empty findings', () => {
    const counts = countByCategory([]);
    expect(counts).toBeDefined();
    expect(counts.unused).toBe(0);
  });

  it('buildAttentionItems returns empty array when all inputs are empty', () => {
    const items = buildAttentionItems([], [], []);
    expect(items).toEqual([]);
  });
});
