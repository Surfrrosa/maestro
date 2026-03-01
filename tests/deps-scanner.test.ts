import { describe, it, expect } from 'vitest';
import { NODE_BUILTINS, PYTHON_STDLIB, PERMISSIVE, GPL_FAMILY } from '../src/commands/deps-scanner.js';

describe('deps-scanner', () => {
  it('NODE_BUILTINS contains fs', () => {
    expect(NODE_BUILTINS.has('fs')).toBe(true);
  });

  it('NODE_BUILTINS contains node:fs prefix form', () => {
    expect(NODE_BUILTINS.has('node:fs')).toBe(true);
  });

  it('PYTHON_STDLIB contains os', () => {
    expect(PYTHON_STDLIB.has('os')).toBe(true);
  });

  it('PERMISSIVE includes MIT', () => {
    expect(PERMISSIVE).toContain('MIT');
  });

  it('GPL_FAMILY includes GPL-3.0', () => {
    expect(GPL_FAMILY).toContain('GPL-3.0');
  });
});
