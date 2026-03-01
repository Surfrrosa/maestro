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

  it('includes function name in nesting finding message', () => {
    const code = `function processItems() {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          if (true) {
            return;
          }
        }
      }
    }
  }
}`;
    const findings = analyzeNestingDepth(code, 'src/app.ts', 'node', 4);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("in 'processItems'");
  });

  it('omits function name for top-level nesting', () => {
    const code = `if (true) {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          return;
        }
      }
    }
  }
}`;
    const findings = analyzeNestingDepth(code, 'src/app.ts', 'node', 4);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).not.toContain("in '");
  });

  it('includes function name in Python nesting findings', () => {
    const code = `def process_data():
    if True:
        if True:
            if True:
                if True:
                    if True:
                        pass`;
    const findings = analyzeNestingDepth(code, 'src/app.py', 'python', 4);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain("in 'process_data'");
  });
});
