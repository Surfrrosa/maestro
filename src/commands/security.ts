import { Command } from 'commander';
import chalk from 'chalk';
import { header, info, PASS, FAIL, divider, palette, failBanner, hint } from '../utils/format.js';
import { runSecurityScan, type SecurityFinding } from './security-scanner.js';

export { runSecurityScan, SecurityFinding, SECRET_PATTERNS } from './security-scanner.js';

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function groupBySeverity(findings: SecurityFinding[]): Record<string, SecurityFinding[]> {
  const grouped: Record<string, SecurityFinding[]> = {};
  for (const f of findings) {
    if (!grouped[f.severity]) grouped[f.severity] = [];
    grouped[f.severity].push(f);
  }
  return grouped;
}

function renderSecurityFindings(grouped: Record<string, SecurityFinding[]>): void {
  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const items = grouped[severity];
    if (!items || items.length === 0) continue;

    const sevColor = severity === 'critical' ? chalk.hex(palette.FAIL_C).bold
      : severity === 'high' ? chalk.hex(palette.FAIL_C)
      : severity === 'medium' ? chalk.hex(palette.WARN_C)
      : chalk.dim;

    console.log(`  ${sevColor(severity.toUpperCase())} (${items.length})\n`);
    for (const f of items) {
      const location = f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : '';
      console.log(`  ${FAIL}  ${f.message}`);
      if (location) console.log(`     ${chalk.dim(location)}`);
      console.log(`     ${chalk.dim(f.suggestion)}`);
      console.log('');
    }
  }
}

export const securityCommand = new Command('security')
  .description('Active security scan: find secrets, unsafe patterns, and missing protections')
  .option('--json', 'Output findings as JSON')
  .option('--severity <level>', 'Minimum severity to show: critical, high, medium, low', 'low')
  .option('--ci', 'Exit non-zero if critical or high severity issues found')
  .action(async (options: { json?: boolean; severity?: string; ci?: boolean }) => {
    const cwd = process.cwd();
    console.log(header('maestro security'));
    console.log(info('Scanning for security issues...\n'));

    const findings = await runSecurityScan(cwd);
    const minSeverity = SEVERITY_ORDER[options.severity || 'low'] ?? 3;
    const filtered = findings.filter(f => SEVERITY_ORDER[f.severity] <= minSeverity);

    if (options.json) { console.log(JSON.stringify(filtered, null, 2)); return; }

    if (filtered.length === 0) {
      console.log(`  ${PASS}  No security issues found.`);
      console.log(chalk.dim(`\n  Not a replacement for a security audit. Catches common patterns only.`));
      if (!options.ci) console.log(hint('maestro review'));
      return;
    }

    const grouped = groupBySeverity(filtered);
    renderSecurityFindings(grouped);

    console.log(divider());
    const critical = (grouped['critical'] || []).length;
    const high = (grouped['high'] || []).length;
    if (critical > 0 || high > 0) {
      console.log(failBanner(`${critical + high} critical/high severity issue(s) require immediate attention.`));
    } else {
      console.log(chalk.hex(palette.WARN_C)(`\n  ${filtered.length} finding(s). Review and address as appropriate.`));
    }
    console.log(chalk.dim(`  Not a replacement for a security audit. Catches common patterns only.\n`));
    if (options.ci && (critical > 0 || high > 0)) process.exit(1);
  });
