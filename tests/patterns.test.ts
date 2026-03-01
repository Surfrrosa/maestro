import { describe, it, expect } from 'vitest';
import { FUNC_PATTERN, PYTHON_DEF_PATTERN, JS_KEYWORDS, isTestFile } from '../src/analyzers/patterns.js';

describe('FUNC_PATTERN', () => {
  it('matches named function declarations', () => {
    const match = 'function processData() {'.match(FUNC_PATTERN);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('processData');
  });

  it('matches const arrow functions', () => {
    const match = 'const handler = async (req, res) => {'.match(FUNC_PATTERN);
    expect(match).not.toBeNull();
    expect(match![2]).toBe('handler');
  });

  it('matches method shorthand', () => {
    const match = 'render(props) {'.match(FUNC_PATTERN);
    expect(match).not.toBeNull();
    expect(match![3]).toBe('render');
  });
});

describe('PYTHON_DEF_PATTERN', () => {
  it('matches Python function definitions', () => {
    const match = '    def process_data(self):'.match(PYTHON_DEF_PATTERN);
    expect(match).not.toBeNull();
    expect(match![2]).toBe('process_data');
    expect(match![1]).toBe('    ');
  });

  it('matches async def', () => {
    const match = 'async def fetch():'.match(PYTHON_DEF_PATTERN);
    expect(match).not.toBeNull();
    expect(match![2]).toBe('fetch');
  });
});

describe('JS_KEYWORDS', () => {
  it('contains control flow keywords', () => {
    expect(JS_KEYWORDS.has('if')).toBe(true);
    expect(JS_KEYWORDS.has('for')).toBe(true);
    expect(JS_KEYWORDS.has('while')).toBe(true);
  });

  it('does not contain function-like identifiers', () => {
    expect(JS_KEYWORDS.has('render')).toBe(false);
    expect(JS_KEYWORDS.has('process')).toBe(false);
  });
});

describe('isTestFile', () => {
  it('detects .test. files', () => {
    expect(isTestFile('src/app.test.ts')).toBe(true);
  });

  it('detects .spec. files', () => {
    expect(isTestFile('src/app.spec.js')).toBe(true);
  });

  it('detects tests/ directory', () => {
    expect(isTestFile('tests/app.ts')).toBe(true);
  });

  it('detects test/ directory', () => {
    expect(isTestFile('test/app.ts')).toBe(true);
  });

  it('detects __tests__/ directory', () => {
    expect(isTestFile('src/__tests__/app.ts')).toBe(true);
  });

  it('returns false for source files', () => {
    expect(isTestFile('src/app.ts')).toBe(false);
  });
});
