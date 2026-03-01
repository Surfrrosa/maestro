import { describe, it, expect } from 'vitest';
import { applyFixes } from '../src/commands/audit-fixer.js';

describe('audit-fixer', () => {
  it('applyFixes is exported and callable', () => {
    expect(typeof applyFixes).toBe('function');
  });
});
