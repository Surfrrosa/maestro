import { describe, it, expect, afterEach } from 'vitest';
import { NODE_BUILTINS, PYTHON_STDLIB, PERMISSIVE, GPL_FAMILY, runDepsAnalysis } from '../src/commands/deps-scanner.js';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

describe('workspace-scoped deps analysis', () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('does not flag workspace deps as unused when used within that workspace', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-deps-'));

    // Root package.json with express
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'monorepo-root',
      dependencies: { express: '4.21.0', cors: '2.8.5' },
    }));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'server.ts'), "import express from 'express';\nimport cors from 'cors';\n");

    // App workspace with next + react
    mkdirSync(join(tempDir, 'app', 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'package.json'), JSON.stringify({
      name: 'app',
      dependencies: { next: '14.0.0', react: '18.2.0' },
    }));
    writeFileSync(join(tempDir, 'app', 'src', 'page.tsx'), "import Image from 'next/image';\nimport React from 'react';\n");

    const findings = await runDepsAnalysis(tempDir);
    const unusedNext = findings.find(f => f.category === 'unused' && f.name === 'next');
    const unusedReact = findings.find(f => f.category === 'unused' && f.name === 'react');
    expect(unusedNext).toBeUndefined();
    expect(unusedReact).toBeUndefined();
  });

  it('does not flag root deps as unused when used in root source files', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-deps-'));

    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'monorepo-root',
      dependencies: { express: '4.21.0' },
    }));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'server.ts'), "import express from 'express';\n");

    mkdirSync(join(tempDir, 'app'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'package.json'), JSON.stringify({
      name: 'app',
      dependencies: { next: '14.0.0' },
    }));
    mkdirSync(join(tempDir, 'app', 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'src', 'page.tsx'), "import next from 'next';\n");

    const findings = await runDepsAnalysis(tempDir);
    const unusedExpress = findings.find(f => f.category === 'unused' && f.name === 'express');
    expect(unusedExpress).toBeUndefined();
  });

  it('still flags genuinely unused deps within a workspace', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-deps-'));

    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'root',
      dependencies: { express: '4.21.0' },
    }));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'server.ts'), "import express from 'express';\n");

    mkdirSync(join(tempDir, 'app', 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'app', 'package.json'), JSON.stringify({
      name: 'app',
      dependencies: { next: '14.0.0', 'unused-lib': '1.0.0' },
    }));
    writeFileSync(join(tempDir, 'app', 'src', 'page.tsx'), "import next from 'next';\n");

    const findings = await runDepsAnalysis(tempDir);
    const unusedLib = findings.find(f => f.category === 'unused' && f.name === 'unused-lib');
    expect(unusedLib).toBeDefined();
    expect(unusedLib!.detail).toContain('[app]');
  });

  it('handles hoisted deps without false phantom findings', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-deps-'));

    // Root declares lodash (hoisted)
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'root',
      dependencies: { lodash: '4.17.21' },
    }));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), "import lodash from 'lodash';\n");

    // Workspace uses lodash (hoisted from root)
    mkdirSync(join(tempDir, 'lib', 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'lib', 'package.json'), JSON.stringify({
      name: 'lib',
      dependencies: {},
    }));
    writeFileSync(join(tempDir, 'lib', 'src', 'utils.ts'), "import _ from 'lodash';\n");

    const findings = await runDepsAnalysis(tempDir);
    const phantomLodash = findings.find(f => f.category === 'phantom' && f.name === 'lodash');
    expect(phantomLodash).toBeUndefined();
  });

  it('single-package project uses existing behavior', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-deps-'));

    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
      name: 'single-pkg',
      dependencies: { express: '4.21.0', 'unused-pkg': '1.0.0' },
    }));
    mkdirSync(join(tempDir, 'src'), { recursive: true });
    writeFileSync(join(tempDir, 'src', 'index.ts'), "import express from 'express';\n");

    const findings = await runDepsAnalysis(tempDir);
    const unusedPkg = findings.find(f => f.category === 'unused' && f.name === 'unused-pkg');
    expect(unusedPkg).toBeDefined();
    // Single-package: no workspace prefix
    expect(unusedPkg!.detail).not.toContain('[');
  });
});
