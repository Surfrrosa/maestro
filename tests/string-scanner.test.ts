import { describe, it, expect } from 'vitest';
import { createScannerState, scanBracesInLine, maskStringsOnly } from '../src/utils/string-scanner.js';

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

describe('maskStringsOnly', () => {
  it('blanks single-quoted string contents', () => {
    const s = createScannerState();
    expect(maskStringsOnly("const x = 'hello';", s)).toBe("const x = '     ';");
  });

  it('blanks double-quoted string contents', () => {
    const s = createScannerState();
    expect(maskStringsOnly('const x = "hello";', s)).toBe('const x = "     ";');
  });

  it('blanks template literal contents', () => {
    const s = createScannerState();
    expect(maskStringsOnly('const t = `abc`;', s)).toBe('const t = `   `;');
  });

  it('handles escaped quotes inside strings', () => {
    const s = createScannerState();
    expect(maskStringsOnly("const x = 'don\\'t';", s)).toBe("const x = '      ';");
  });

  it('leaves non-string code untouched', () => {
    const s = createScannerState();
    expect(maskStringsOnly('const x = 42;', s)).toBe('const x = 42;');
  });

  it('leaves line comments untouched so // TODO detection still works', () => {
    const s = createScannerState();
    expect(maskStringsOnly('const x = 1; // TODO: fix', s)).toBe('const x = 1; // TODO: fix');
  });

  it('persists template literal across lines via state', () => {
    const s = createScannerState();
    const l1 = maskStringsOnly('const t = `foo', s);
    expect(l1).toBe('const t = `   ');
    expect(s.inString).toBe(true);
    const l2 = maskStringsOnly('bar`;', s);
    expect(l2).toBe('   `;');
    expect(s.inString).toBe(false);
  });

  it('preserves column positions for regex match.index', () => {
    const s = createScannerState();
    const line = 'const s = "console.log(x)"; console.log("real");';
    const masked = maskStringsOnly(line, s);
    // Real console.log at column 28 should still match at column 28
    const match = masked.match(/console\.log/);
    expect(match?.index).toBe(28);
  });
});
