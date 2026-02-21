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

const program = new Command();

program
  .name('maestro')
  .description('AI-native project scaffolding. Generates instruction files, session logs, brand voice docs, design systems, and security checklists.')
  .version('0.2.0');

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

program.parse();
