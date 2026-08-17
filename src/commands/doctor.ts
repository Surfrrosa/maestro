import { Command } from 'commander';
import chalk from 'chalk';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { get } from 'node:https';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileP = promisify(execFile);

export type CheckStatus = 'pass' | 'fail' | 'warn';

export interface CheckResult {
  label: string;
  status: CheckStatus;
  detail?: string;
  fix?: string;
}

export interface CheckSection {
  title: string;
  checks: CheckResult[];
}

const REQUIRED_NODE_MAJOR = 20;
const REQUIRED_NODE_MINOR = 12;

export function compareNodeVersion(actual: string, requiredMajor = REQUIRED_NODE_MAJOR, requiredMinor = REQUIRED_NODE_MINOR): boolean {
  const match = actual.match(/^v?(\d+)\.(\d+)/);
  if (!match) return false;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  if (major > requiredMajor) return true;
  if (major < requiredMajor) return false;
  return minor >= requiredMinor;
}

export function checkNodeVersion(): CheckResult {
  const actual = process.version;
  const ok = compareNodeVersion(actual);
  if (ok) {
    return { label: 'Node.js', status: 'pass', detail: `${actual} (>= ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}.0 required)` };
  }
  return {
    label: 'Node.js',
    status: 'fail',
    detail: `${actual} (>= ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}.0 required)`,
    fix: `nvm install ${REQUIRED_NODE_MAJOR} && nvm use ${REQUIRED_NODE_MAJOR}`,
  };
}

export async function checkBinary(bin: string, versionArg = '--version'): Promise<CheckResult> {
  try {
    const { stdout } = await execFileP(bin, [versionArg], { timeout: 5000 });
    const match = stdout.match(/(\d+\.\d+\.\d+[\w.-]*)/);
    const version = match ? match[1] : stdout.trim().split('\n')[0];
    return { label: bin, status: 'pass', detail: `${version} reachable` };
  } catch {
    return {
      label: bin,
      status: 'fail',
      detail: 'not found on PATH',
      fix: `install ${bin} and ensure it's on your PATH`,
    };
  }
}

export function checkNpmRegistry(): Promise<CheckResult> {
  return new Promise((resolvePromise) => {
    const req = get('https://registry.npmjs.org/', { timeout: 5000 }, (res) => {
      const status = res.statusCode ?? 0;
      res.resume();
      if (status >= 200 && status < 400) {
        resolvePromise({ label: 'registry.npmjs.org', status: 'pass', detail: `reachable (HTTP ${status})` });
      } else {
        resolvePromise({
          label: 'registry.npmjs.org',
          status: 'warn',
          detail: `unexpected HTTP ${status}`,
          fix: 'check network / proxy settings',
        });
      }
    });
    req.on('timeout', () => {
      req.destroy();
      resolvePromise({
        label: 'registry.npmjs.org',
        status: 'fail',
        detail: 'timed out after 5s',
        fix: 'check network / firewall / proxy settings',
      });
    });
    req.on('error', (err) => {
      resolvePromise({
        label: 'registry.npmjs.org',
        status: 'fail',
        detail: err.message,
        fix: 'check network / firewall / proxy settings',
      });
    });
  });
}

export function checkWriteAccess(cwd: string = process.cwd()): CheckResult {
  let tmp: string | null = null;
  try {
    tmp = mkdtempSync(join(cwd, '.maestro-doctor-'));
    writeFileSync(join(tmp, 'probe'), '');
    return { label: 'Write access', status: 'pass', detail: cwd };
  } catch (err) {
    return {
      label: 'Write access',
      status: 'fail',
      detail: `${cwd} — ${(err as Error).message}`,
      fix: 'check filesystem permissions on the current directory',
    };
  } finally {
    if (tmp) {
      try { rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}

export async function checkMaestroOnPath(): Promise<CheckResult> {
  const which = process.platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileP(which, ['maestro'], { timeout: 5000 });
    const path = stdout.trim().split('\n')[0];
    return { label: 'maestro on PATH', status: 'pass', detail: path };
  } catch {
    return {
      label: 'maestro on PATH',
      status: 'warn',
      detail: 'not found (running via `node dist/bin/maestro.js`?)',
      fix: 'npm install -g maestro-dev',
    };
  }
}

export function checkPackageVersion(): CheckResult {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(here, '../../package.json'),
      resolve(here, '../../../package.json'),
    ];
    for (const p of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(p, 'utf-8'));
        if (pkg.name === 'maestro-dev') {
          return { label: 'maestro-dev', status: 'pass', detail: `v${pkg.version}` };
        }
      } catch { /* try next */ }
    }
    return { label: 'maestro-dev', status: 'warn', detail: 'package version not detectable' };
  } catch {
    return { label: 'maestro-dev', status: 'warn', detail: 'package version not detectable' };
  }
}

export async function runAllChecks(cwd: string = process.cwd()): Promise<CheckSection[]> {
  const [nodeCheck, npmCheck, gitCheck, registryCheck, writeCheck, pathCheck, versionCheck] = await Promise.all([
    Promise.resolve(checkNodeVersion()),
    checkBinary('npm'),
    checkBinary('git'),
    checkNpmRegistry(),
    Promise.resolve(checkWriteAccess(cwd)),
    checkMaestroOnPath(),
    Promise.resolve(checkPackageVersion()),
  ]);

  return [
    { title: 'Environment', checks: [nodeCheck, npmCheck, gitCheck] },
    { title: 'Connectivity', checks: [registryCheck] },
    { title: 'Filesystem', checks: [writeCheck, pathCheck] },
    { title: 'Installation', checks: [versionCheck] },
  ];
}

export function hasAnyFailure(sections: CheckSection[]): boolean {
  return sections.some(s => s.checks.some(c => c.status === 'fail'));
}

async function renderReport(sections: CheckSection[]): Promise<void> {
  const { commandHeader, SYM, palette } = await import('../utils/format.js');
  console.log(commandHeader('doctor'));

  for (const section of sections) {
    console.log(`  ${chalk.hex(palette.ACCENT)('•')} ${chalk.bold.white(section.title)}`);
    for (const check of section.checks) {
      const sym = check.status === 'pass' ? SYM.pass : check.status === 'fail' ? SYM.fail : SYM.warn;
      const label = check.status === 'fail' ? chalk.hex(palette.FAIL_C)('FAIL') : check.status === 'warn' ? chalk.hex(palette.WARN_C)('WARN') : chalk.hex(palette.PASS_C)('PASS');
      const detail = check.detail ? chalk.dim(` ${check.detail}`) : '';
      console.log(`    ${sym} ${label}  ${check.label}${detail}`);
      if (check.fix && check.status !== 'pass') {
        console.log(`         ${chalk.hex(palette.INFO_C)('Fix:')} ${chalk.dim(check.fix)}`);
      }
    }
    console.log('');
  }

  const anyFail = hasAnyFailure(sections);
  if (anyFail) {
    console.log(`  ${chalk.hex(palette.FAIL_C)('~')} One or more checks failed. Address the fixes above and re-run.`);
  } else {
    console.log(`  ${chalk.hex(palette.PASS_C)('~')} All checks passed.`);
  }
}

export const doctorCommand = new Command('doctor')
  .description('Check the environment maestro needs to run (Node version, npm/git availability, network, permissions)')
  .action(async () => {
    const sections = await runAllChecks();
    await renderReport(sections);
    if (hasAnyFailure(sections)) process.exit(1);
  });
