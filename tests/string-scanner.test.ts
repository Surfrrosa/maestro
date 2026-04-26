import { describe, it, expect } from 'vitest';
import { createScannerState, scanBracesInLine } from '../src/utils/string-scanner.js';

function countBraces(line: string, state = createScannerState()) {
  let open = 0, close = 0;
  scanBracesInLine(line, state, () => { open++; }, () => { close++; });
  return { open, close, state };
}

describe('scanBracesInLine', () => {
  it('counts braces outside of strings and comments', () => {
    expect(countBraces('function f() { return { a: 1 }; }')).toMatchObject({ open: 2, close: 2 });
  });

  it('ignores braces inside double-quoted strings', () => {
    expect(countBraces('const s = "hello { world }";')).toMatchObject({ open: 0, close: 0 });
  });

  it('ignores braces inside single-quoted strings', () => {
    expect(countBraces(`const s = '{ }';`)).toMatchObject({ open: 0, close: 0 });
  });

  it('ignores braces after a // line comment', () => {
    expect(countBraces('const x = 1; // { unused }')).toMatchObject({ open: 0, close: 0 });
  });

  it('preserves string state across lines for unterminated template literals', () => {
    const state = createScannerState();
    countBraces('const s = `unterminated {', state);
    expect(state.inString).toBe(true);
    const second = countBraces('still in string }`; const o = {};', state);
    expect(second).toMatchObject({ open: 1, close: 1 });
    expect(state.inString).toBe(false);
  });

  it('handles escaped quotes inside strings', () => {
    expect(countBraces(`const s = "a\\"b{"; const x = {};`)).toMatchObject({ open: 1, close: 1 });
  });
});
