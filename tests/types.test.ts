import { describe, it, expect } from 'vitest';
import type { AnalyzerContext, QualityFinding, MaestroConfig } from '../src/analyzers/types.js';

describe('analyzer types', () => {
  it('QualityFinding type compiles and works at runtime', () => {
    const finding: QualityFinding = {
      rule: 'test',
      category: 'testing',
      severity: 'info',
      file: 'test.ts',
      message: 'test message',
    };
    expect(finding.rule).toBe('test');
    expect(finding.category).toBe('testing');
    expect(finding.severity).toBe('info');
  });

  it('MaestroConfig type compiles and works at runtime', () => {
    const config: MaestroConfig = {
      quality: {
        ignore: ['node_modules'],
      },
    };
    expect(config.quality.ignore).toEqual(['node_modules']);
  });
});
