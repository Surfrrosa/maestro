import { describe, it, expect } from 'vitest';
import { SECRET_PATTERNS, runSecurityScan, scanLineForSecret, isTestFile } from '../src/commands/security-scanner.js';

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

describe('isTestFile', () => {
  it('recognizes __tests__ directory', () => {
    expect(isTestFile('__tests__/setup.ts')).toBe(true);
  });

  it('recognizes nested __tests__ directory', () => {
    expect(isTestFile('src/__tests__/helpers/mock.ts')).toBe(true);
  });

  it('recognizes tests/ directory', () => {
    expect(isTestFile('tests/helpers/stripe-mock.ts')).toBe(true);
  });

  it('recognizes __mocks__ directory', () => {
    expect(isTestFile('__mocks__/resend.js')).toBe(true);
  });

  it('recognizes .test. files', () => {
    expect(isTestFile('src/utils/auth.test.ts')).toBe(true);
  });

  it('recognizes .spec. files', () => {
    expect(isTestFile('src/utils/auth.spec.ts')).toBe(true);
  });

  it('does not flag regular source files', () => {
    expect(isTestFile('src/utils/auth.ts')).toBe(false);
  });

  it('does not flag files with test in the name but not as extension', () => {
    expect(isTestFile('src/testing-utils.ts')).toBe(false);
  });
});

describe('scanLineForSecret', () => {
  it('skips lines with mock_ prefix in value', () => {
    expect(scanLineForSecret(
      "const api_key = 'mock_stripe_key_for_testing_only';",
      'src/config.ts', 1,
    )).toBeNull();
  });

  it('skips lines with test_ prefix in value', () => {
    expect(scanLineForSecret(
      "process.env.STRIPE_SECRET_KEY = 'test_key_abc123def456';",
      'src/config.ts', 1,
    )).toBeNull();
  });

  it('skips lines with fake_ prefix in value', () => {
    expect(scanLineForSecret(
      "const api_key = 'fake_abcdefghijklmnop';",
      'src/config.ts', 1,
    )).toBeNull();
  });

  it('skips lines with dummy_ prefix in value', () => {
    expect(scanLineForSecret(
      "const secret_key = 'dummy_secret_1234567890abcdef';",
      'src/config.ts', 1,
    )).toBeNull();
  });

  it('skips files in test directories', () => {
    expect(scanLineForSecret(
      "process.env.STRIPE_SECRET_KEY = 'sk_live_abcdefghijklmnopqrs';",
      '__tests__/setup.ts', 1,
    )).toBeNull();
  });

  it('skips .env files', () => {
    expect(scanLineForSecret(
      "STRIPE_SECRET_KEY=sk_live_abcdefghijklmnopqrs",
      '.env', 1,
    )).toBeNull();
  });

  it('still flags real-looking API keys in source files', () => {
    const result = scanLineForSecret(
      "const api_key = 'sk-ant-abc123def456ghi789jkl012mno345pqr';",
      'src/config.ts', 1,
    );
    expect(result).not.toBeNull();
    expect(result!.severity).toBe('critical');
  });

  it('still flags hardcoded passwords in source files', () => {
    const result = scanLineForSecret(
      "const password = 'SuperSecret123!';",
      'src/db.ts', 5,
    );
    expect(result).not.toBeNull();
    expect(result!.category).toBe('secrets');
  });
});
