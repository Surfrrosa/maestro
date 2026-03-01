import { describe, it, expect } from 'vitest';
import { analyzeFunctionLengths } from '../src/analyzers/complexity-function-length.js';

describe('analyzeFunctionLengths', () => {
  it('returns empty findings for a short function', () => {
    const code = `function greet(name: string) {
  return 'Hello ' + name;
}`;
    const findings = analyzeFunctionLengths(code, 'src/app.ts', 'node', 50);
    expect(findings).toHaveLength(0);
  });

  it('flags a function exceeding the max line threshold', () => {
    const lines = ['function big() {'];
    for (let i = 0; i < 60; i++) {
      lines.push(`  const x${i} = ${i};`);
    }
    lines.push('}');
    const code = lines.join('\n');
    const findings = analyzeFunctionLengths(code, 'src/big.ts', 'node', 50);
    expect(findings.some(f => f.rule === 'function-length')).toBe(true);
  });
});
