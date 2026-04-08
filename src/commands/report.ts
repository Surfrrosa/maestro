import { Command } from 'commander';
import chalk from 'chalk';
import { header, info, divider, scoreBar, gradeDisplay, FAIL, section, palette, hint, successBanner } from '../utils/format.js';
import { copyToClipboard } from '../utils/fs.js';
import { runReport, formatClipboardReport, formatSecuritySummary, formatDepsSummary, type ReportResult } from './report-scoring.js';

export { runReport, type ReportResult, type AttentionItem } from './report-scoring.js';

function renderSectionLine(label: string, score: number, detail: string): void {
  const scoreColor = score >= 80 ? chalk.hex(palette.PASS_C) : score >= 50 ? chalk.hex(palette.WARN_C) : chalk.hex(palette.FAIL_C);
  console.log(`  ${label.padEnd(16)} ${scoreColor.bold(`${score}/100`)}   ${chalk.dim(detail)}`);
}

function renderAttentionItems(result: ReportResult): void {
  if (result.attentionItems.length === 0) return;
  console.log(section('Attention Required'));
  for (const item of result.attentionItems) {
    const sevColor = item.severity === 'critical' ? chalk.hex(palette.FAIL_C).bold : chalk.hex(palette.FAIL_C);
    console.log(`  ${FAIL}  ${sevColor(item.severity.toUpperCase())}  ${item.message}`);
    if (item.location) {
      console.log(`     ${chalk.dim(item.location)}`);
    }
    if (item.suggestion) {
      console.log(`     ${chalk.dim(item.suggestion)}`);
    }
    console.log('');
  }
  console.log(divider());
}

function renderSections(result: ReportResult): void {
  renderSectionLine('Audit', result.sections.audit.score,
    `${result.sections.audit.passed} of ${result.sections.audit.total} checks passed`);
  renderSectionLine('Quality', result.sections.quality.score,
    `Grade ${result.sections.quality.grade}   ${result.sections.quality.totalFindings} finding(s)`);
  renderSectionLine('Security', result.sections.security.score,
    formatSecuritySummary(result.sections.security.bySeverity));
  renderSectionLine('Dependencies', result.sections.deps.score,
    formatDepsSummary(result.sections.deps.byCategory));
}

function handleReportFooter(options: { clipboard?: boolean; ci?: number }, result: ReportResult): void {
  if (options.clipboard) {
    const clipText = formatClipboardReport(result);
    if (copyToClipboard(clipText)) {
      console.log(successBanner('Report copied to clipboard. Paste into Claude Code to fix.'));
    }
  }

  if (options.ci !== undefined) {
    if (result.compositeScore < options.ci) {
      console.log(chalk.red(`\n  CI FAIL: Score ${result.compositeScore} is below threshold ${options.ci}\n`));
      process.exit(1);
    } else {
      console.log(chalk.green(`\n  CI PASS: Score ${result.compositeScore} meets threshold ${options.ci}\n`));
    }
  }

  if (!options.clipboard && !options.ci) {
    if (result.attentionItems.length > 0) {
      console.log(hint('maestro report --clipboard to copy for Claude Code'));
    } else {
      console.log(successBanner('Project is in good shape.'));
      console.log('');
    }
  }
}

export const reportCommand = new Command('report')
  .description('Full project health report: audit + quality + security + deps in one pass')
  .option('--json', 'Output the full report as JSON')
  .option('--clipboard', 'Copy report summary to clipboard for Claude Code')
  .option('--ci <threshold>', 'Exit non-zero if composite score is below threshold (0-100)', parseInt)
  .action(async (options: { json?: boolean; clipboard?: boolean; ci?: number }) => {
    const cwd = process.cwd();

    if (!options.json) {
      console.log(header('maestro report'));
      console.log(info(`Analyzing project...\n`));
    }

    const result = await runReport(cwd);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      if (options.ci !== undefined && result.compositeScore < options.ci) {
        process.exit(1);
      }
      return;
    }

    console.log(info(`Project: ${result.project}`));
    console.log(`\n${scoreBar(result.compositeScore)}\n`);
    console.log(`${gradeDisplay(result.grade, result.compositeScore)}\n`);
    console.log(divider());
    console.log('');

    renderSections(result);
    console.log('');
    console.log(divider());
    renderAttentionItems(result);
    console.log('');
    console.log(info(`4 areas analyzed. ${result.totalFindings} total finding(s).`));

    handleReportFooter(options, result);
  });
