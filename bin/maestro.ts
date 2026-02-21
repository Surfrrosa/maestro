import { Command } from 'commander';
import { initCommand } from '../src/commands/init.js';
import { auditCommand } from '../src/commands/audit.js';
import { sessionCommand } from '../src/commands/session.js';
import { voiceCommand } from '../src/commands/voice.js';
import { designSystemCommand } from '../src/commands/design-system.js';

const program = new Command();

program
  .name('maestro')
  .description('AI-native project scaffolding. Generates instruction files, session logs, brand voice docs, design systems, and security checklists.')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(auditCommand);
program.addCommand(sessionCommand);
program.addCommand(voiceCommand);
program.addCommand(designSystemCommand);

program.parse();
