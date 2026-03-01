import { describe, it, expect } from 'vitest';
import { runAuditChecks } from '../src/commands/audit-checks.js';

describe('audit-checks', () => {
  it('runAuditChecks is exported and callable', () => {
    expect(typeof runAuditChecks).toBe('function');
  });
});
