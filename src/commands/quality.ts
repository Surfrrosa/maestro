import { Command } from 'commander';
import chalk from 'chalk';
import { basename } from 'node:path';
import { runQualityAnalysis } from '../analyzers/index.js';
import { header, info, divider, PASS, FAIL, WARN } from '../utils/format.js';
import type { QualityReport, CategoryScore } from '../analyzers/types.js';

function gradeColor(grade: string): typeof chalk {
  switch (grade) {
    case 'A': return chalk.green;
    case 'B': return chalk.cyan;
    case 'C': return chalk.yellow;
    case 'D': return chalk.hex('#FFA500');
    case 'F': return chalk.red;
    default: return chalk.white;
  }
}

function renderCategory(cat: CategoryScore): void {
  const icon = cat.score >= 80 ? PASS : cat.score >= 50 ? WARN : FAIL;
  const scoreStr = cat.score >= 80 ? chalk.green(`${cat.score}%`)
    : cat.score >= 50 ? chalk.yellow(`${cat.score}%`)
    : chalk.red(`${cat.score}%`);
  const label = cat.category.padEnd(18);
  const count = cat.findings.length;
  const countStr = count > 0 ? chalk.dim(` (${count} finding${count !== 1 ? 's' : ''})`) : '';
  console.log(`  ${icon}  ${label} ${scoreStr}${countStr}`);
}

function renderTopOffenders(report: QualityReport, limit: number = 5): void {
  const allFindings = report.categories.flatMap(c => c.findings);
  const ranked = allFindings
    .filter(f => f.severity !== 'info')
    .sort((a, b) => {
      const sev: Record<string, number> = { error: 0, warning: 1, info: 2 };
      return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
    })
    .slice(0, limit);

  if (ranked.length === 0) return;

  console.log(chalk.bold('\n  Top issues:\n'));
  for (const f of ranked) {
    const sevColor = f.severity === 'error' ? chalk.red : chalk.yellow;
    const location = f.line ? `${f.file}:${f.line}` : f.file;
    console.log(`  ${sevColor(f.severity.toUpperCase().padEnd(7))} ${chalk.dim(location)}`);
    console.log(`          ${f.message}`);
    if (f.suggestion) {
      console.log(`          ${chalk.dim(f.suggestion)}`);
    }
  }
}

export const qualityCommand = new Command('quality')
  .description('Static code quality analysis: complexity, dead code, hygiene, structure')
  .option('--verbose', 'Show all findings per category')
  .option('--json', 'Output as JSON')
  .option('--ci <grade>', 'Exit non-zero if grade is below threshold (A-F)')
  .action(async (options: { verbose?: boolean; json?: boolean; ci?: string }) => {
    const cwd = process.cwd();
    const projectName = basename(cwd);

    const report = await runQualityAnalysis(cwd);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const gc = gradeColor(report.grade);

    console.log(header('maestro quality'));
    console.log(info(`Project: ${projectName}\n`));
    console.log(`  Grade: ${gc.bold(report.grade)}  (${report.overallScore}/100)\n`);
    console.log(divider());

    for (const cat of report.categories) {
      renderCategory(cat);
    }

    console.log(divider());
    console.log(info(`${report.totalFindings} total finding(s)`));

    if (options.verbose) {
      for (const cat of report.categories) {
        if (cat.findings.length === 0) continue;
        console.log(chalk.bold(`\n  ${cat.category}:\n`));
        for (const f of cat.findings) {
          const sevColor = f.severity === 'error' ? chalk.red : f.severity === 'warning' ? chalk.yellow : chalk.dim;
          const location = f.line ? `${f.file}:${f.line}` : f.file;
          console.log(`    ${sevColor(f.severity.padEnd(7))} ${chalk.dim(location)}`);
          console.log(`            ${f.message}`);
        }
      }
    } else {
      renderTopOffenders(report);
    }

    if (report.fixableCount > 0) {
      console.log(chalk.dim(`\n  ${report.fixableCount} auto-fixable issue(s) detected.`));
    }

    if (!options.ci) {
      console.log(chalk.dim(`\n  Next: maestro security`));
    }

    if (options.ci) {
      const gradeOrder = ['F', 'D', 'C', 'B', 'A'];
      const threshold = gradeOrder.indexOf(options.ci.toUpperCase());
      const actual = gradeOrder.indexOf(report.grade);
      if (threshold < 0) {
        console.log(chalk.red(`\n  Invalid grade threshold: ${options.ci}. Use A, B, C, D, or F.\n`));
        process.exit(1);
      }
      if (actual < threshold) {
        console.log(chalk.red(`\n  CI FAIL: Grade ${report.grade} is below threshold ${options.ci.toUpperCase()}\n`));
        process.exit(1);
      } else {
        console.log(chalk.green(`\n  CI PASS: Grade ${report.grade} meets threshold ${options.ci.toUpperCase()}\n`));
      }
    }

    console.log('');
  });
