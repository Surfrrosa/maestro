import { Command } from 'commander';
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

const program = new Command();

program
  .name('maestro')
  .description('AI-native project scaffolding and development lifecycle CLI.')
  .version('0.3.0');

program.addHelpText('after', `
  Setup:     scan, init, hooks install
  Workflow:  session, check, review
  Health:    audit, quality, security, deps
  Insights:  bugs, changelog, audit-all
  Brand:     voice, design-system
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

program.parse();
