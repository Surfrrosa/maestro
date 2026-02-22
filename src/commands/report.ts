import { Command } from 'commander';
import chalk from 'chalk';
import { basename } from 'node:path';
import { runAuditChecks, type AuditCheck } from './audit.js';
import { runQualityAnalysis } from '../analyzers/index.js';
import { runSecurityScan, type SecurityFinding } from './security.js';
import { runDepsAnalysis, type DepFinding } from './deps.js';
import { header, info, divider, scoreBar, gradeDisplay, PASS, FAIL, WARN, section, palette, hint, successBanner, failBanner } from '../utils/format.js';
import { copyToClipboard, today } from '../utils/fs.js';
import type { QualityReport } from '../analyzers/types.js';

// ── Scoring Constants ───────────────────────────────────

const SECURITY_DEDUCTIONS: Record<string, number> = {
  critical: 20,
  high: 15,
  medium: 5,
  low: 2,
};

const DEPS_DEDUCTIONS: Record<string, number> = {
  high: 15,
  medium: 10,
  low: 3,
};

const SECTION_WEIGHTS = {
  audit: 20,
  quality: 35,
  security: 30,
  deps: 15,
};

// ── Types ───────────────────────────────────────────────

interface AttentionItem {
  severity: string;
  message: string;
  location?: string;
  suggestion?: string;
}

export interface ReportResult {
  project: string;
  date: string;
  compositeScore: number;
  grade: string;
  sections: {
    audit: { score: number; passed: number; total: number };
    quality: { score: number; grade: string; totalFindings: number };
    security: { score: number; findings: number; bySeverity: Record<string, number> };
    deps: { score: number; findings: number; byCategory: Record<string, number> };
  };
  attentionItems: AttentionItem[];
  totalFindings: number;
}

// ── Scoring Functions ───────────────────────────────────

function scoreSecurityFindings(findings: SecurityFinding[]): number {
  let deductions = 0;
  for (const f of findings) {
    deductions += SECURITY_DEDUCTIONS[f.severity] ?? 2;
  }
  return Math.max(0, 100 - deductions);
}

function scoreDepsFindings(findings: DepFinding[]): number {
  let deductions = 0;
  for (const f of findings) {
    deductions += DEPS_DEDUCTIONS[f.severity] ?? 3;
  }
  return Math.max(0, 100 - deductions);
}

function computeCompositeScore(audit: number, quality: number, security: number, deps: number): number {
  const total = SECTION_WEIGHTS.audit + SECTION_WEIGHTS.quality + SECTION_WEIGHTS.security + SECTION_WEIGHTS.deps;
  const weighted =
    audit * SECTION_WEIGHTS.audit +
    quality * SECTION_WEIGHTS.quality +
    security * SECTION_WEIGHTS.security +
    deps * SECTION_WEIGHTS.deps;
  return Math.round(weighted / total);
}

function computeGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function buildAttentionItems(
  auditChecks: AuditCheck[],
  securityFindings: SecurityFinding[],
  depsFindings: DepFinding[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  // Critical/high security findings
  for (const f of securityFindings) {
    if (f.severity === 'critical' || f.severity === 'high') {
      const location = f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : undefined;
      items.push({
        severity: f.severity,
        message: f.message,
        location,
        suggestion: f.suggestion,
      });
    }
  }

  // Failed high-weight audit checks
  for (const c of auditChecks) {
    if (!c.passed && c.weight >= 10) {
      items.push({
        severity: 'high',
        message: `${c.name}: ${c.detail}`,
      });
    }
  }

  // License concerns from deps
  for (const f of depsFindings) {
    if (f.severity === 'high') {
      items.push({
        severity: 'high',
        message: f.detail,
      });
    }
  }

  return items;
}

function countBySeverity(findings: SecurityFinding[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    counts[f.severity] = (counts[f.severity] || 0) + 1;
  }
  return counts;
}

function countByCategory(findings: DepFinding[]): Record<string, number> {
  const counts: Record<string, number> = { unused: 0, phantom: 0, license: 0 };
  for (const f of findings) {
    counts[f.category] = (counts[f.category] || 0) + 1;
  }
  return counts;
}

// ── Report Runner ───────────────────────────────────────

export async function runReport(cwd: string): Promise<ReportResult> {
  const projectName = basename(cwd);

  const [auditResult, qualityResult, securityFindings, depsFindings] = await Promise.all([
    runAuditChecks(cwd),
    runQualityAnalysis(cwd),
    runSecurityScan(cwd),
    runDepsAnalysis(cwd),
  ]);

  const auditScore = auditResult.score;
  const qualityScore = qualityResult.overallScore;
  const securityScore = scoreSecurityFindings(securityFindings);
  const depsScore = scoreDepsFindings(depsFindings);

  const compositeScore = computeCompositeScore(auditScore, qualityScore, securityScore, depsScore);
  const grade = computeGrade(compositeScore);

  const passed = auditResult.checks.filter(c => c.passed).length;
  const total = auditResult.checks.length;

  const bySeverity = countBySeverity(securityFindings);
  const byCategory = countByCategory(depsFindings);

  const attentionItems = buildAttentionItems(auditResult.checks, securityFindings, depsFindings);

  const totalFindings =
    auditResult.checks.filter(c => !c.passed).length +
    qualityResult.totalFindings +
    securityFindings.length +
    depsFindings.length;

  return {
    project: projectName,
    date: today(),
    compositeScore,
    grade,
    sections: {
      audit: { score: auditScore, passed, total },
      quality: { score: qualityScore, grade: qualityResult.grade, totalFindings: qualityResult.totalFindings },
      security: { score: securityScore, findings: securityFindings.length, bySeverity },
      deps: { score: depsScore, findings: depsFindings.length, byCategory },
    },
    attentionItems,
    totalFindings,
  };
}

// ── Rendering ───────────────────────────────────────────

function renderSectionLine(label: string, score: number, detail: string): void {
  const scoreColor = score >= 80 ? chalk.hex(palette.PASS_C) : score >= 50 ? chalk.hex(palette.WARN_C) : chalk.hex(palette.FAIL_C);
  console.log(`  ${label.padEnd(16)} ${scoreColor.bold(`${score}/100`)}   ${chalk.dim(detail)}`);
}

function formatSecurityDetail(bySeverity: Record<string, number>): string {
  const parts: string[] = [];
  if (bySeverity.critical) parts.push(`${bySeverity.critical} critical`);
  if (bySeverity.high) parts.push(`${bySeverity.high} high`);
  if (bySeverity.medium) parts.push(`${bySeverity.medium} medium`);
  if (bySeverity.low) parts.push(`${bySeverity.low} low`);
  return parts.length > 0 ? parts.join(', ') : 'No issues';
}

function formatDepsDetail(byCategory: Record<string, number>): string {
  const parts: string[] = [];
  if (byCategory.unused) parts.push(`${byCategory.unused} unused`);
  if (byCategory.phantom) parts.push(`${byCategory.phantom} phantom`);
  if (byCategory.license) parts.push(`${byCategory.license} license`);
  return parts.length > 0 ? parts.join(', ') : 'All clean';
}

function formatClipboardReport(result: ReportResult): string {
  const lines: string[] = [
    `Maestro Report - ${result.project} (${result.compositeScore}/100, Grade ${result.grade})`,
    result.date,
    '',
    `Audit:    ${result.sections.audit.score}/100 (${result.sections.audit.passed}/${result.sections.audit.total} checks passed)`,
    `Quality:  ${result.sections.quality.score}/100 (Grade ${result.sections.quality.grade}, ${result.sections.quality.totalFindings} findings)`,
    `Security: ${result.sections.security.score}/100 (${formatSecurityDetail(result.sections.security.bySeverity)})`,
    `Deps:     ${result.sections.deps.score}/100 (${formatDepsDetail(result.sections.deps.byCategory)})`,
  ];

  if (result.attentionItems.length > 0) {
    lines.push('', 'Attention Required:');
    for (const item of result.attentionItems) {
      const loc = item.location ? ` in ${item.location}` : '';
      lines.push(`- ${item.severity.toUpperCase()}: ${item.message}${loc}`);
      if (item.suggestion) {
        lines.push(`  ${item.suggestion}`);
      }
    }
  }

  lines.push('', 'Fix these issues to improve the project health score.');
  return lines.join('\n');
}

// ── Command ─────────────────────────────────────────────

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

    // JSON output
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      if (options.ci !== undefined && result.compositeScore < options.ci) {
        process.exit(1);
      }
      return;
    }

    // Header
    console.log(info(`Project: ${result.project}`));
    console.log(`\n${scoreBar(result.compositeScore)}\n`);
    console.log(`${gradeDisplay(result.grade, result.compositeScore)}\n`);
    console.log(divider());
    console.log('');

    // Section lines
    renderSectionLine('Audit', result.sections.audit.score,
      `${result.sections.audit.passed} of ${result.sections.audit.total} checks passed`);
    renderSectionLine('Quality', result.sections.quality.score,
      `Grade ${result.sections.quality.grade}   ${result.sections.quality.totalFindings} finding(s)`);
    renderSectionLine('Security', result.sections.security.score,
      formatSecurityDetail(result.sections.security.bySeverity));
    renderSectionLine('Dependencies', result.sections.deps.score,
      formatDepsDetail(result.sections.deps.byCategory));

    console.log('');
    console.log(divider());

    // Attention items
    if (result.attentionItems.length > 0) {
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

    // Footer
    console.log('');
    console.log(info(`4 areas analyzed. ${result.totalFindings} total finding(s).`));

    // Clipboard
    if (options.clipboard) {
      const clipText = formatClipboardReport(result);
      if (copyToClipboard(clipText)) {
        console.log(successBanner('Report copied to clipboard. Paste into Claude Code to fix.'));
      }
    }

    // CI mode
    if (options.ci !== undefined) {
      if (result.compositeScore < options.ci) {
        console.log(chalk.red(`\n  CI FAIL: Score ${result.compositeScore} is below threshold ${options.ci}\n`));
        process.exit(1);
      } else {
        console.log(chalk.green(`\n  CI PASS: Score ${result.compositeScore} meets threshold ${options.ci}\n`));
      }
    }

    // Breadcrumb hint
    if (!options.clipboard && !options.ci) {
      if (result.attentionItems.length > 0) {
        console.log(hint('maestro report --clipboard to copy for Claude Code'));
      } else {
        console.log(successBanner('Project is in good shape.'));
        console.log('');
      }
    }
  });
