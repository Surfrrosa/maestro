import { Command } from 'commander';
import chalk from 'chalk';
import { header, info, PASS, FAIL, WARN, divider, section } from '../utils/format.js';
import { runDepsAnalysis, type DepFinding } from './deps-scanner.js';

export { runDepsAnalysis, type DepFinding } from './deps-scanner.js';

const CATEGORY_LABELS: Record<string, string> = {
  unused: 'Unused Dependencies',
  phantom: 'Phantom Dependencies (imported but not declared)',
  license: 'License Concerns',
};

export const depsCommand = new Command('deps')
  .description('Dependency analysis: find unused, phantom, and problematic dependencies')
  .option('--json', 'Output as JSON')
  .action(async (options: { json?: boolean }) => {
    const cwd = process.cwd();
    console.log(header('maestro deps'));
    console.log(info('Analyzing dependencies...\n'));

    const findings = await runDepsAnalysis(cwd);

    if (options.json) {
      console.log(JSON.stringify(findings, null, 2));
      return;
    }

    if (findings.length === 0) {
      console.log(`  ${PASS}  All dependencies look clean.\n`);
      return;
    }

    const grouped: Record<string, DepFinding[]> = {};
    for (const f of findings) {
      if (!grouped[f.category]) grouped[f.category] = [];
      grouped[f.category].push(f);
    }

    for (const [category, items] of Object.entries(grouped)) {
      const icon = category === 'license' ? FAIL : WARN;
      console.log(section(CATEGORY_LABELS[category] || category));
      for (const item of items) {
        console.log(`  ${icon}  ${chalk.white(item.name)}`);
        console.log(`     ${chalk.dim(item.detail)}`);
        console.log('');
      }
    }

    console.log(divider());
    console.log(info(`${findings.length} finding(s) total.\n`));
  });
