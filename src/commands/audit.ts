import { Command } from 'commander';
import chalk from 'chalk';
import { join, basename } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { PASS, FAIL, header, info, scoreBar, section, SYM, palette, hint, successBanner } from '../utils/format.js';
import { copyToClipboard } from '../utils/fs.js';
import { runAuditChecks, type AuditCheck } from './audit-checks.js';
import { applyFixes } from './audit-fixer.js';

export { runAuditChecks, type AuditCheck } from './audit-checks.js';
export { applyFixes } from './audit-fixer.js';

export function generateBadge(score: number): string {
  const color = score >= 80 ? 'brightgreen' : score >= 60 ? 'yellow' : score >= 40 ? 'orange' : 'red';
  return `![Maestro Score](https://img.shields.io/badge/maestro-${score}%2F100-${color})`;
}

export const auditCommand = new Command('audit')
  .description('Audit a project against AI-native development methodology')
  .option('--fix', 'Auto-fix gaps where possible')
  .option('--clipboard', 'Copy findings to clipboard for Claude Code')
  .option('--ci <threshold>', 'Exit non-zero if score is below threshold (for CI pipelines)', parseInt)
  .option('--badge', 'Output a shields.io badge for your README')
  .action(async (options: { fix?: boolean; clipboard?: boolean; ci?: number; badge?: boolean }) => {
    const cwd = process.cwd();
    const projectName = basename(cwd);
    const { checks, score } = await runAuditChecks(cwd);

    if (options.badge) {
      console.log(`\n  ${generateBadge(score)}\n`);
      return;
    }

    console.log(header('maestro audit'));
    console.log(info(`Project: ${projectName}`));
    console.log(`\n${scoreBar(score)}\n`);

    for (const check of checks) {
      const icon = check.passed ? PASS : FAIL;
      const weight = chalk.dim(`[${check.weight}pts]`);
      const detail = check.detail ? chalk.dim(` - ${check.detail}`) : '';
      console.log(`  ${icon}  ${check.name} ${weight}${detail}`);
    }

    renderRecommendations(checks);
    handleClipboard(options, checks, projectName, score);
    handleFix(options, cwd, checks);
    handleCi(options, score);

    console.log('');
  });

function renderRecommendations(checks: AuditCheck[]): void {
  const failed = checks.filter(c => !c.passed);
  if (failed.length === 0) return;
  console.log(section('Recommendations'));
  for (const check of failed) {
    if (check.detail) {
      console.log(`  ${SYM.arrow} ${check.detail}`);
    }
  }
}

function handleClipboard(
  options: { clipboard?: boolean },
  checks: AuditCheck[],
  projectName: string,
  score: number,
): void {
  const failed = checks.filter(c => !c.passed);
  if (!options.clipboard || failed.length === 0) return;
  const clipText = [
    `Maestro Audit - ${projectName} (${score}/100)`,
    '',
    'Fix these issues:',
    ...failed.filter(c => c.detail).map(c => `- ${c.name}: ${c.detail}`),
  ].join('\n');
  if (copyToClipboard(clipText)) {
    console.log(successBanner('Findings copied to clipboard. Paste into Claude Code to fix.'));
  }
}

function handleFix(
  options: { fix?: boolean; clipboard?: boolean },
  cwd: string,
  checks: AuditCheck[],
): void {
  const failed = checks.filter(c => !c.passed);
  if (options.fix) {
    const fixable = checks.filter(c => !c.passed && c.fixable);
    if (fixable.length > 0) {
      console.log(section('Applying fixes'));
      applyFixes(cwd, checks);
      console.log(hint('maestro audit'));
    } else {
      console.log(chalk.dim('\n  No auto-fixable issues found.\n'));
    }
  } else if (!options.clipboard) {
    const fixable = checks.filter(c => !c.passed && c.fixable);
    if (fixable.length > 0) {
      console.log(hint('maestro audit --fix'));
    } else if (failed.length > 0) {
      console.log(hint('maestro audit --clipboard to copy for Claude Code'));
    } else {
      console.log(hint('maestro quality'));
    }
  }
}

function handleCi(options: { ci?: number }, score: number): void {
  if (options.ci === undefined) return;
  if (score < options.ci) {
    console.log(chalk.red(`\n  CI FAIL: Score ${score} is below threshold ${options.ci}\n`));
    process.exit(1);
  } else {
    console.log(chalk.green(`\n  CI PASS: Score ${score} meets threshold ${options.ci}\n`));
  }
}

export const auditAllCommand = new Command('audit-all')
  .description('Audit all repos in a directory')
  .argument('<directory>', 'Directory containing repos to audit')
  .option('--sort <field>', 'Sort by: score (default), name', 'score')
  .action(async (directory: string, options: { sort: string }) => {
    const { resolve } = await import('node:path');
    const targetDir = resolve(directory);

    if (!existsSync(targetDir)) {
      console.log(chalk.red(`\n  Directory not found: ${targetDir}\n`));
      return;
    }

    console.log(header('maestro audit-all'));
    console.log(info(`Scanning: ${targetDir}\n`));

    const entries = readdirSync(targetDir, { withFileTypes: true });
    const repos = entries
      .filter(e => e.isDirectory() && existsSync(join(targetDir, e.name, '.git')))
      .map(e => e.name);

    if (repos.length === 0) {
      console.log(chalk.yellow('  No git repositories found in this directory.\n'));
      return;
    }

    const results = await collectRepoScores(targetDir, repos);
    sortResults(results, options.sort);
    renderResultsTable(results, repos.length);
  });

async function collectRepoScores(
  targetDir: string,
  repos: string[],
): Promise<Array<{ name: string; score: number }>> {
  const results: Array<{ name: string; score: number }> = [];
  for (const repo of repos) {
    const repoPath = join(targetDir, repo);
    try {
      const { score } = await runAuditChecks(repoPath);
      results.push({ name: repo, score });
    } catch {
      results.push({ name: repo, score: -1 });
    }
  }
  return results;
}

function sortResults(results: Array<{ name: string; score: number }>, sort: string): void {
  if (sort === 'name') {
    results.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    results.sort((a, b) => b.score - a.score);
  }
}

function renderResultsTable(results: Array<{ name: string; score: number }>, repoCount: number): void {
  const maxNameLen = Math.max(...results.map(r => r.name.length), 10);
  const headerLine = `  ${'Repository'.padEnd(maxNameLen)}  Score`;
  const dividerLine = `  ${'-'.repeat(maxNameLen)}  -----`;
  console.log(chalk.bold(headerLine));
  console.log(chalk.dim(dividerLine));

  for (const r of results) {
    const scoreColor = r.score >= 80 ? chalk.hex(palette.PASS_C) : r.score >= 60 ? chalk.hex(palette.WARN_C) : r.score >= 40 ? chalk.hex(palette.SCORE_D) : chalk.hex(palette.FAIL_C);
    const scoreStr = r.score >= 0 ? scoreColor.bold(`${r.score}/100`) : chalk.dim('error');
    console.log(`  ${r.name.padEnd(maxNameLen)}  ${scoreStr}`);
  }

  const avg = results.filter(r => r.score >= 0);
  if (avg.length > 0) {
    const avgScore = Math.round(avg.reduce((s, r) => s + r.score, 0) / avg.length);
    console.log(chalk.dim(dividerLine));
    console.log(`  ${'Average'.padEnd(maxNameLen)}  ${chalk.bold(`${avgScore}/100`)}`);
  }

  console.log(`\n  ${chalk.dim(`${repoCount} repos scanned.`)}\n`);
}
