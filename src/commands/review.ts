import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { fileExists, readFile } from '../utils/fs.js';
import { header, PASS, FAIL, WARN, divider, successBanner, failBanner, palette } from '../utils/format.js';
import { SECRET_PATTERNS } from './security.js';

export interface ReviewFinding {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string[];
}

function getStagedFiles(cwd: string): string[] {
  try {
    const output = execSync('git diff --cached --name-only', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();
    if (!output) return [];
    return output.split('\n').filter(f => f.trim());
  } catch {
    return [];
  }
}

function getStagedDiff(cwd: string): string {
  try {
    return execSync('git diff --cached', {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    });
  } catch {
    return '';
  }
}

function getStagedFileContent(cwd: string, file: string): string {
  try {
    return execSync(`git show ":${file}"`, {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    });
  } catch {
    return '';
  }
}

function checkNewDeps(cwd: string, stagedFiles: string[]): ReviewFinding {
  if (!stagedFiles.includes('package.json') && !stagedFiles.includes('requirements.txt') && !stagedFiles.includes('pyproject.toml')) {
    return { check: 'New dependencies', status: 'pass', message: 'No dependency files modified' };
  }

  try {
    const diff = execSync('git diff --cached -- package.json requirements.txt pyproject.toml', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    });

    const added = diff.split('\n')
      .filter(l => l.startsWith('+') && !l.startsWith('+++'))
      .filter(l => /"[^"]+"\s*:/.test(l) || /^\+[a-zA-Z0-9-]+=/.test(l));

    if (added.length > 0) {
      return {
        check: 'New dependencies',
        status: 'warn',
        message: `${added.length} new dependency change(s) detected`,
        details: added.map(l => l.substring(1).trim()).slice(0, 5),
      };
    }
  } catch {
    // Skip
  }

  return { check: 'New dependencies', status: 'pass', message: 'No new dependencies added' };
}

function checkEnvVars(cwd: string, diff: string): ReviewFinding {
  const envRefs = diff.split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .filter(l => /process\.env\.[A-Z]|os\.environ|os\.getenv/.test(l));

  if (envRefs.length === 0) {
    return { check: 'Environment variables', status: 'pass', message: 'No new env vars introduced' };
  }

  const examplePath = join(cwd, '.env.example');
  if (!fileExists(examplePath)) {
    return {
      check: 'Environment variables',
      status: 'warn',
      message: `${envRefs.length} env var reference(s) but no .env.example exists`,
    };
  }

  return {
    check: 'Environment variables',
    status: 'warn',
    message: `${envRefs.length} env var reference(s) in staged changes -- verify .env.example is updated`,
  };
}

function checkSecrets(cwd: string, stagedFiles: string[]): ReviewFinding {
  const findings: string[] = [];

  for (const file of stagedFiles) {
    if (file === '.env' || file.endsWith('.lock') || file === 'package-lock.json') continue;
    const content = getStagedFileContent(cwd, file);
    if (!content) continue;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          if (/your[_-]?(?:key|token|secret|value)|changeme|placeholder|xxx+|TODO/i.test(line)) continue;
          findings.push(`${file}:${i + 1} -- ${pattern.name}`);
          break;
        }
      }
    }
  }

  if (findings.length > 0) {
    return {
      check: 'Hardcoded secrets',
      status: 'fail',
      message: `${findings.length} potential secret(s) detected`,
      details: findings.slice(0, 5),
    };
  }

  return { check: 'Hardcoded secrets', status: 'pass', message: 'No hardcoded secrets detected' };
}

function checkDebugStatements(diff: string): ReviewFinding {
  const debugLines = diff.split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .filter(l => {
      // Skip test files and CLI files in the diff header context
      return /console\.(log|debug|warn)\s*\(/.test(l) || /\bprint\s*\(/.test(l);
    });

  if (debugLines.length > 0) {
    return {
      check: 'Debug statements',
      status: 'warn',
      message: `${debugLines.length} debug statement(s) in staged changes`,
      details: debugLines.map(l => l.substring(1).trim()).slice(0, 5),
    };
  }

  return { check: 'Debug statements', status: 'pass', message: 'No debug statements in staged changes' };
}

function checkTestCoverage(stagedFiles: string[]): ReviewFinding {
  const sourceFiles = stagedFiles.filter(f =>
    /\.(ts|js|tsx|jsx|py)$/.test(f) &&
    !f.includes('test') && !f.includes('spec') &&
    f.startsWith('src/')
  );

  const testFiles = stagedFiles.filter(f =>
    f.includes('test') || f.includes('spec')
  );

  const newSourceFiles = sourceFiles.filter(f => {
    // Check if this is a new file (not a modification) by looking at the staging
    return true; // We can't easily tell new vs modified from file list alone
  });

  if (sourceFiles.length > 0 && testFiles.length === 0) {
    return {
      check: 'Test coverage',
      status: 'warn',
      message: `${sourceFiles.length} source file(s) modified but no test files staged`,
    };
  }

  return { check: 'Test coverage', status: 'pass', message: 'Test files included for source changes' };
}

function checkFileSize(cwd: string, stagedFiles: string[]): ReviewFinding {
  const largeFiles: string[] = [];

  for (const file of stagedFiles) {
    const content = getStagedFileContent(cwd, file);
    if (!content) continue;
    const lines = content.split('\n').length;
    if (lines > 300) {
      largeFiles.push(`${file} (${lines} lines)`);
    }
  }

  if (largeFiles.length > 0) {
    return {
      check: 'File size',
      status: 'warn',
      message: `${largeFiles.length} file(s) over 300 lines`,
      details: largeFiles.slice(0, 5),
    };
  }

  return { check: 'File size', status: 'pass', message: 'No oversized files' };
}

function checkTodos(diff: string): ReviewFinding {
  const todoLines = diff.split('\n')
    .filter(l => l.startsWith('+') && !l.startsWith('+++'))
    .filter(l => /\b(TODO|FIXME|HACK|XXX)\b/.test(l));

  if (todoLines.length > 0) {
    return {
      check: 'TODOs added',
      status: 'warn',
      message: `${todoLines.length} TODO/FIXME marker(s) in staged changes`,
      details: todoLines.map(l => l.substring(1).trim()).slice(0, 5),
    };
  }

  return { check: 'TODOs added', status: 'pass', message: 'No TODOs introduced' };
}

function checkLargeFiles(cwd: string, stagedFiles: string[]): ReviewFinding {
  const largeFiles: string[] = [];
  const MAX_SIZE = 500 * 1024; // 500KB

  for (const file of stagedFiles) {
    try {
      const fullPath = join(cwd, file);
      const stat = statSync(fullPath);
      if (stat.size > MAX_SIZE) {
        const sizeKB = Math.round(stat.size / 1024);
        largeFiles.push(`${file} (${sizeKB}KB)`);
      }
    } catch {
      // File might not exist on disk (deleted)
    }
  }

  if (largeFiles.length > 0) {
    return {
      check: 'Large files',
      status: 'warn',
      message: `${largeFiles.length} file(s) over 500KB`,
      details: largeFiles,
    };
  }

  return { check: 'Large files', status: 'pass', message: 'No large files (>500KB)' };
}

export function runReview(cwd: string): ReviewFinding[] {
  const stagedFiles = getStagedFiles(cwd);
  if (stagedFiles.length === 0) return [];

  const diff = getStagedDiff(cwd);

  return [
    checkNewDeps(cwd, stagedFiles),
    checkEnvVars(cwd, diff),
    checkSecrets(cwd, stagedFiles),
    checkDebugStatements(diff),
    checkTestCoverage(stagedFiles),
    checkFileSize(cwd, stagedFiles),
    checkTodos(diff),
    checkLargeFiles(cwd, stagedFiles),
  ];
}

export const reviewCommand = new Command('review')
  .description('Pre-commit code review: analyze staged changes for issues')
  .option('--json', 'Output findings as JSON')
  .option('--strict', 'Exit non-zero on warnings (for CI/hooks)')
  .action(async (options: { json?: boolean; strict?: boolean }) => {
    const cwd = process.cwd();
    const stagedFiles = getStagedFiles(cwd);

    if (stagedFiles.length === 0) {
      if (options.json) {
        console.log(JSON.stringify([], null, 2));
      } else {
        console.log(header('maestro review'));
        console.log(chalk.dim('  No staged files. Stage changes with git add first.\n'));
      }
      return;
    }

    const findings = runReview(cwd);

    if (options.json) {
      console.log(JSON.stringify(findings, null, 2));
      const hasFails = findings.some(f => f.status === 'fail');
      const hasWarns = findings.some(f => f.status === 'warn');
      if (hasFails || (options.strict && hasWarns)) {
        process.exit(1);
      }
      return;
    }

    console.log(header('maestro review'));
    console.log(chalk.dim(`  Reviewing ${stagedFiles.length} staged file(s)...\n`));

    for (const finding of findings) {
      const icon = finding.status === 'pass' ? PASS : finding.status === 'warn' ? WARN : FAIL;
      console.log(`  ${icon}  ${finding.message}`);
      if (finding.details) {
        for (const detail of finding.details) {
          console.log(chalk.dim(`        ${detail}`));
        }
      }
    }

    console.log('');
    const fails = findings.filter(f => f.status === 'fail').length;
    const warns = findings.filter(f => f.status === 'warn').length;

    if (fails > 0) {
      console.log(failBanner(`${fails} failure(s) found. Fix before committing.`));
      console.log('');
      process.exit(1);
    } else if (warns > 0) {
      console.log(chalk.hex(palette.WARN_C)(`  ${warns} warning(s). Review before committing.\n`));
      if (options.strict) process.exit(1);
    } else {
      console.log(successBanner('All checks passed. Ready to commit.'));
      console.log('');
    }
  });
