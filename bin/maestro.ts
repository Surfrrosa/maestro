import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from '../src/commands/init.js';
import { scanCommand } from '../src/commands/scan.js';
import { auditCommand, auditAllCommand } from '../src/commands/audit.js';
import { sessionCommand } from '../src/commands/session.js';
import { voiceCommand } from '../src/commands/voice.js';
import { designSystemCommand } from '../src/commands/design-system.js';
import { checkCommand } from '../src/commands/check.js';
import { securityCommand } from '../src/commands/security.js';
import { depsCommand } from '../src/commands/deps.js';
import { qualityCommand } from '../src/commands/quality.js';
import { hooksCommand } from '../src/commands/hooks.js';
import { bugsCommand } from '../src/commands/bugs.js';
import { reviewCommand } from '../src/commands/review.js';
import { changelogCommand } from '../src/commands/changelog.js';
import { reportCommand } from '../src/commands/report.js';
import { banner } from '../src/utils/format.js';

const program = new Command();

const b = chalk.hex('#9580FF')('\u2022');

program
  .name('maestro')
  .description('AI-native project scaffolding and development lifecycle CLI.')
  .version('0.3.0');

program.addHelpText('beforeAll', banner('0.3.0'));
program.addHelpText('after', `
  ${b} Report     maestro report (full health check)

  ${b} Setup      scan, init, hooks install
  ${b} Workflow   session, check, review
  ${b} Health     audit, quality, security, deps
  ${b} Insights   bugs, changelog, audit-all
  ${b} Brand      voice, design-system
`);

program.addCommand(scanCommand);
program.addCommand(initCommand);
program.addCommand(auditCommand);
program.addCommand(auditAllCommand);
program.addCommand(checkCommand);
program.addCommand(securityCommand);
program.addCommand(depsCommand);
program.addCommand(qualityCommand);
program.addCommand(sessionCommand);
program.addCommand(voiceCommand);
program.addCommand(designSystemCommand);
program.addCommand(hooksCommand);
program.addCommand(bugsCommand);
program.addCommand(reviewCommand);
program.addCommand(changelogCommand);
program.addCommand(reportCommand);

program.parse();
