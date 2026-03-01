import { describe, it, expect } from 'vitest';
import { generateSessionIndex, appendSessionEntry } from '../src/templates/session-index.js';

describe('generateSessionIndex', () => {
  it('generates session index containing Session Logs', () => {
    const result = generateSessionIndex('test');
    expect(result).toContain('Session Logs');
  });
});

describe('appendSessionEntry', () => {
  it('appends a new session entry to existing content', () => {
    const existing = generateSessionIndex('test');
    const result = appendSessionEntry(existing, '2026-03-01', 'Complete', 'Initial setup');
    expect(result).toContain('2026-03-01');
    expect(result).toContain('Initial setup');
  });
});
