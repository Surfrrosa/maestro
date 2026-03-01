import { describe, it, expect } from 'vitest';
import { SECRET_PATTERNS, runSecurityScan } from '../src/commands/security-scanner.js';

describe('security-scanner', () => {
  it('SECRET_PATTERNS has entries', () => {
    expect(SECRET_PATTERNS.length).toBeGreaterThan(0);
  });

  it('each pattern has regex and name', () => {
    for (const pattern of SECRET_PATTERNS) {
      expect(pattern.regex).toBeInstanceOf(RegExp);
      expect(typeof pattern.name).toBe('string');
    }
  });

  it('runSecurityScan is a function', () => {
    expect(typeof runSecurityScan).toBe('function');
  });
});
