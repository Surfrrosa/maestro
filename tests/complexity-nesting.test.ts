import { describe, it, expect } from 'vitest';
import { analyzeNestingDepth } from '../src/analyzers/complexity-nesting.js';

describe('analyzeNestingDepth', () => {
  it('returns empty findings for shallow code', () => {
    const code = `function simple() {
  if (true) {
    return 1;
  }
}`;
    const findings = analyzeNestingDepth(code, 'src/app.ts', 'node', 4);
    expect(findings).toHaveLength(0);
  });

  it('flags deeply nested control flow', () => {
    const code = `function deep() {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            console.log('deep');
          }
        }
      }
    }
  }
}`;
    const findings = analyzeNestingDepth(code, 'src/nested.ts', 'node', 4);
    expect(findings.some(f => f.rule === 'nesting-depth')).toBe(true);
  });
});
