import { describe, it, expect } from 'vitest';
import { mkdtempSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  compareNodeVersion,
  checkNodeVersion,
  checkBinary,
  checkWriteAccess,
  checkPackageVersion,
  hasAnyFailure,
  runAllChecks,
  type CheckSection,
} from '../src/commands/doctor.js';

describe('compareNodeVersion', () => {
  it('accepts version above required major', () => {
    expect(compareNodeVersion('v22.11.0')).toBe(true);
  });

  it('accepts version at required major with sufficient minor', () => {
    expect(compareNodeVersion('v20.12.0')).toBe(true);
    expect(compareNodeVersion('v20.15.0')).toBe(true);
  });

  it('rejects version at required major with insufficient minor', () => {
    expect(compareNodeVersion('v20.11.0')).toBe(false);
    expect(compareNodeVersion('v20.0.0')).toBe(false);
  });

  it('rejects version below required major', () => {
    expect(compareNodeVersion('v18.20.4')).toBe(false);
    expect(compareNodeVersion('v16.0.0')).toBe(false);
  });

  it('handles version without v prefix', () => {
    expect(compareNodeVersion('22.11.0')).toBe(true);
    expect(compareNodeVersion('18.0.0')).toBe(false);
  });

  it('respects custom required version', () => {
    expect(compareNodeVersion('v18.0.0', 18, 0)).toBe(true);
    expect(compareNodeVersion('v17.9.0', 18, 0)).toBe(false);
  });

  it('returns false for malformed version strings', () => {
    expect(compareNodeVersion('unknown')).toBe(false);
    expect(compareNodeVersion('')).toBe(false);
  });
});

describe('checkNodeVersion', () => {
  it('returns a check result with the current process version', () => {
    const result = checkNodeVersion();
    expect(result.label).toBe('Node.js');
    expect(result.detail).toContain(process.version);
    // On modern CI/dev, Node is always >= 20.12
    expect(result.status).toBe('pass');
  });
});

describe('checkBinary', () => {
  it('returns pass for a binary that exists', async () => {
    const result = await checkBinary('node');
    expect(result.status).toBe('pass');
    expect(result.detail).toContain('reachable');
  });

  it('returns fail for a binary that does not exist', async () => {
    const result = await checkBinary('definitely-not-a-real-binary-xyz');
    expect(result.status).toBe('fail');
    expect(result.detail).toContain('not found on PATH');
    expect(result.fix).toBeDefined();
  });
});

describe('checkWriteAccess', () => {
  it('returns pass for a writable directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'doctor-write-'));
    try {
      const result = checkWriteAccess(tmp);
      expect(result.status).toBe('pass');
      expect(result.detail).toBe(tmp);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns fail for a read-only directory', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'doctor-ro-'));
    try {
      chmodSync(tmp, 0o555);
      const result = checkWriteAccess(tmp);
      expect(result.status).toBe('fail');
      expect(result.fix).toBeDefined();
    } finally {
      chmodSync(tmp, 0o755);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('checkPackageVersion', () => {
  it('returns a check result for maestro-dev package', () => {
    const result = checkPackageVersion();
    expect(result.label).toBe('maestro-dev');
    // status is pass when running from dist, warn when running from source (tsx)
    expect(['pass', 'warn']).toContain(result.status);
  });
});

describe('hasAnyFailure', () => {
  it('returns true when any check fails', () => {
    const sections: CheckSection[] = [
      { title: 'Env', checks: [{ label: 'a', status: 'pass' }, { label: 'b', status: 'fail' }] },
    ];
    expect(hasAnyFailure(sections)).toBe(true);
  });

  it('returns false when all checks pass or warn', () => {
    const sections: CheckSection[] = [
      { title: 'Env', checks: [{ label: 'a', status: 'pass' }, { label: 'b', status: 'warn' }] },
    ];
    expect(hasAnyFailure(sections)).toBe(false);
  });

  it('returns false for empty sections', () => {
    expect(hasAnyFailure([])).toBe(false);
    expect(hasAnyFailure([{ title: 'Env', checks: [] }])).toBe(false);
  });
});

describe('runAllChecks', () => {
  it('returns four sections in expected order', async () => {
    const sections = await runAllChecks();
    expect(sections).toHaveLength(4);
    expect(sections.map(s => s.title)).toEqual(['Environment', 'Connectivity', 'Filesystem', 'Installation']);
  });

  it('runs at least one check per section', async () => {
    const sections = await runAllChecks();
    for (const section of sections) {
      expect(section.checks.length).toBeGreaterThan(0);
    }
  });
});
