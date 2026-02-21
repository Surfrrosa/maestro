import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runDepsAnalysis } from '../src/commands/deps.js';

const TEST_DIR = join(process.cwd(), '.test-deps-project');

function setupProject(files: Record<string, string>) {
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(TEST_DIR, path);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

describe('deps analyzer', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('detects unused dependency', async () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { chalk: '5.3.0', 'never-used-pkg': '1.0.0' },
      }),
      'src/app.ts': 'import chalk from "chalk";\nconsole.log(chalk.green("hi"));\n',
    });
    const findings = await runDepsAnalysis(TEST_DIR);
    expect(findings.some(f => f.category === 'unused' && f.name === 'never-used-pkg')).toBe(true);
  });

  it('detects phantom dependency', async () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { chalk: '5.3.0' },
      }),
      'src/app.ts': 'import chalk from "chalk";\nimport express from "express";\n',
    });
    const findings = await runDepsAnalysis(TEST_DIR);
    expect(findings.some(f => f.category === 'phantom' && f.name === 'express')).toBe(true);
  });

  it('does not flag Node built-ins', async () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { chalk: '5.3.0' },
      }),
      'src/app.ts': 'import { readFileSync } from "node:fs";\nimport path from "path";\nimport chalk from "chalk";\n',
    });
    const findings = await runDepsAnalysis(TEST_DIR);
    expect(findings.filter(f => f.name === 'fs' || f.name === 'path' || f.name === 'node:fs')).toHaveLength(0);
  });

  it('handles scoped packages', async () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { '@inquirer/prompts': '7.0.0' },
      }),
      'src/app.ts': 'import { input } from "@inquirer/prompts";\n',
    });
    const findings = await runDepsAnalysis(TEST_DIR);
    expect(findings.filter(f => f.name === '@inquirer/prompts')).toHaveLength(0);
  });

  it('skips @types packages', async () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: {},
        devDependencies: { '@types/node': '22.0.0' },
      }),
      'src/app.ts': 'const x = 1;\n',
    });
    const findings = await runDepsAnalysis(TEST_DIR);
    expect(findings.filter(f => f.name === '@types/node')).toHaveLength(0);
  });

  it('clean project has no findings', async () => {
    setupProject({
      'package.json': JSON.stringify({
        dependencies: { chalk: '5.3.0' },
      }),
      'src/app.ts': 'import chalk from "chalk";\nexport const hi = chalk.green("hi");\n',
    });
    const findings = await runDepsAnalysis(TEST_DIR);
    expect(findings).toHaveLength(0);
  });
});
