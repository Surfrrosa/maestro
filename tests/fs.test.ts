import { describe, it, expect } from 'vitest';
import { fileExists, detectStack, today } from '../src/utils/fs.js';

describe('fs utilities', () => {
  it('fileExists returns false for nonexistent path', () => {
    expect(fileExists('/definitely/not/a/real/path')).toBe(false);
  });

  it('detectStack returns unknown for a random dir', () => {
    expect(detectStack('/tmp')).toBe('unknown');
  });

  it('today returns YYYY-MM-DD format', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
