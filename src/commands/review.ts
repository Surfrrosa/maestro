import { Command } from 'commander';
import chalk from 'chalk';
import { header, PASS, FAIL, WARN, successBanner, failBanner, palette } from '../utils/format.js';
import { runReview, getStagedFiles, type ReviewFinding } from './review-checks.js';

export { runReview, type ReviewFinding } from './review-checks.js';

function renderFindings(findings: ReviewFinding[]): void {
  for (const finding of findings) {
    const icon = finding.status === 'pass' ? PASS : finding.status === 'warn' ? WARN : FAIL;
    console.log(`  ${icon}  ${finding.message}`);
    if (finding.details) {
      for (const detail of finding.details) {
        console.log(chalk.dim(`        ${detail}`));
      }
    }
  }
}

function renderSummary(findings: ReviewFinding[], strict?: boolean): void {
  const fails = findings.filter(f => f.status === 'fail').length;
  const warns = findings.filter(f => f.status === 'warn').length;

  if (fails > 0) {
    console.log(failBanner(`${fails} failure(s) found. Fix before committing.`));
    console.log('');
    process.exit(1);
  } else if (warns > 0) {
    console.log(chalk.hex(palette.WARN_C)(`  ${warns} warning(s). Review before committing.\n`));
    if (strict) process.exit(1);
  } else {
    console.log(successBanner('All checks passed. Ready to commit.'));
    console.log('');
  }
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

    renderFindings(findings);
    console.log('');
    renderSummary(findings, options.strict);
  });
