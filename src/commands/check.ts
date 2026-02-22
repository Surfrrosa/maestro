import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileExists, readFile } from '../utils/fs.js';
import { PASS, FAIL, WARN, header, successBanner, failBanner, hint, palette } from '../utils/format.js';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
  blocking: boolean;
}

function checkClaudeMd(cwd: string): CheckResult {
  if (!fileExists(join(cwd, 'CLAUDE.md'))) {
    return { name: 'CLAUDE.md exists', status: 'fail', detail: 'No CLAUDE.md found. Run maestro init or maestro scan.', blocking: true };
  }
  return { name: 'CLAUDE.md exists', status: 'pass', detail: '', blocking: true };
}

function checkLatestSession(cwd: string): CheckResult {
  const sessionsDir = join(cwd, 'docs', 'sessions');
  if (!existsSync(sessionsDir)) {
    return { name: 'Session logs present', status: 'fail', detail: 'No docs/sessions/ directory.', blocking: true };
  }
  const logs = readdirSync(sessionsDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}_session/.test(f) && f.endsWith('.md'))
    .sort()
    .reverse();
  if (logs.length === 0) {
    return { name: 'Session logs present', status: 'fail', detail: 'No session logs found.', blocking: true };
  }
  return { name: 'Session logs present', status: 'pass', detail: `Latest: ${logs[0]}`, blocking: true };
}

function checkBlockers(cwd: string): CheckResult {
  const sessionsDir = join(cwd, 'docs', 'sessions');
  if (!existsSync(sessionsDir)) {
    return { name: 'No blockers', status: 'pass', detail: '', blocking: false };
  }
  const logs = readdirSync(sessionsDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}_session/.test(f) && f.endsWith('.md'))
    .sort()
    .reverse();
  if (logs.length === 0) {
    return { name: 'No blockers', status: 'pass', detail: '', blocking: false };
  }

  const content = readFile(join(sessionsDir, logs[0]));

  // Check for blocked status
  if (content.includes('## Status: Blocked')) {
    return { name: 'Last session status', status: 'warn', detail: 'Last session ended with Blocked status.', blocking: false };
  }

  // Check for known issues
  const issuesMatch = content.match(/## Known Issues Discovered\n([\s\S]*?)(?=\n## |$)/);
  if (issuesMatch) {
    const issues = issuesMatch[1].trim().split('\n').filter(l => l.trim() && l.trim() !== '-');
    if (issues.length > 0) {
      return {
        name: 'Open issues from last session',
        status: 'warn',
        detail: `${issues.length} issue(s): ${issues[0].replace(/^-\s*/, '').substring(0, 60)}${issues.length > 1 ? '...' : ''}`,
        blocking: false,
      };
    }
  }

  return { name: 'No blockers', status: 'pass', detail: '', blocking: false };
}

function checkHealth(cwd: string): CheckResult {
  const issues: string[] = [];
  if (fileExists(join(cwd, '.env')) && !fileExists(join(cwd, '.env.example'))) {
    issues.push('.env without .env.example');
  }
  if (!fileExists(join(cwd, '.gitignore'))) {
    issues.push('missing .gitignore');
  }
  if (!fileExists(join(cwd, 'README.md'))) {
    issues.push('missing README.md');
  }
  if (issues.length > 0) {
    return { name: 'Project health', status: 'warn', detail: issues.join(', '), blocking: false };
  }
  return { name: 'Project health', status: 'pass', detail: '', blocking: false };
}

export function runChecks(cwd: string): CheckResult[] {
  return [
    checkClaudeMd(cwd),
    checkLatestSession(cwd),
    checkBlockers(cwd),
    checkHealth(cwd),
  ];
}

export const checkCommand = new Command('check')
  .description('Pre-session check: verify context is loaded and no blockers exist')
  .option('--hook', 'Hook mode: exit 0/1 with terse output')
  .action(async (options: { hook?: boolean }) => {
    const cwd = process.cwd();
    const results = runChecks(cwd);

    const hasBlocking = results.some(r => r.status === 'fail' && r.blocking);
    const hasWarnings = results.some(r => r.status === 'warn');

    if (options.hook) {
      if (hasBlocking) {
        const blockers = results.filter(r => r.status === 'fail' && r.blocking);
        for (const b of blockers) {
          console.log(`FAIL: ${b.name} - ${b.detail}`);
        }
        process.exit(1);
      }
      if (hasWarnings) {
        const warnings = results.filter(r => r.status === 'warn');
        for (const w of warnings) {
          console.log(`WARN: ${w.name} - ${w.detail}`);
        }
      }
      console.log('OK');
      process.exit(0);
    }

    console.log(header('maestro check'));
    for (const result of results) {
      const icon = result.status === 'pass' ? PASS : result.status === 'warn' ? WARN : FAIL;
      const detail = result.detail ? chalk.dim(` - ${result.detail}`) : '';
      console.log(`  ${icon}  ${result.name}${detail}`);
    }
    console.log('');

    if (hasBlocking) {
      console.log(failBanner('Session blocked. Fix the failures above before starting work.'));
      console.log(hint('maestro scan'));
    } else if (hasWarnings) {
      console.log(chalk.hex(palette.WARN_C)('  Warnings found. Review before starting work.\n'));
    } else {
      console.log(successBanner('Ready to work.'));
      console.log('');
    }
  });
