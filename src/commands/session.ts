import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';
import { writeFile, readFile, fileExists, ensureDir, today } from '../utils/fs.js';
import { generateSessionLog } from '../templates/session-log.js';
import { generateSessionIndex, appendSessionEntry } from '../templates/session-index.js';

const sessionCommand = new Command('session')
  .description('Manage development session logs');

sessionCommand
  .command('start')
  .description('Create a new session log for today')
  .action(async () => {
    const cwd = process.cwd();
    const sessionsDir = join(cwd, 'docs', 'sessions');
    const date = today();

    ensureDir(sessionsDir);

    // Check if session index exists, create if not
    const indexPath = join(sessionsDir, 'README.md');
    if (!fileExists(indexPath)) {
      const projectName = cwd.split('/').pop() || 'project';
      writeFile(indexPath, generateSessionIndex(projectName));
      console.log(chalk.dim(`  Created session index: docs/sessions/README.md`));
    }

    // Find next available filename
    let suffix = '';
    let counter = 1;
    while (fileExists(join(sessionsDir, `${date}_session${suffix}.md`))) {
      counter++;
      suffix = `_${counter}`;
    }

    const filename = `${date}_session${suffix}.md`;
    const filepath = join(sessionsDir, filename);

    writeFile(filepath, generateSessionLog(date));

    console.log(chalk.bold('\n  maestro session start\n'));
    console.log(chalk.green(`  Created: docs/sessions/${filename}`));
    console.log(chalk.dim(`\n  Fill in your objectives before starting work.\n`));
  });

sessionCommand
  .command('end')
  .description('Close the current session log')
  .action(async () => {
    const cwd = process.cwd();
    const sessionsDir = join(cwd, 'docs', 'sessions');

    if (!fileExists(sessionsDir)) {
      console.log(chalk.red('\n  No docs/sessions/ directory found. Run maestro session start first.\n'));
      return;
    }

    // Find the most recent session log
    const files = readdirSync(sessionsDir)
      .filter(f => f.match(/^\d{4}-\d{2}-\d{2}_session/) && f.endsWith('.md') && f !== 'README.md')
      .sort()
      .reverse();

    if (files.length === 0) {
      console.log(chalk.red('\n  No session logs found. Run maestro session start first.\n'));
      return;
    }

    const latestFile = files[0];
    const latestPath = join(sessionsDir, latestFile);

    console.log(chalk.bold('\n  maestro session end\n'));
    console.log(chalk.dim(`  Closing: docs/sessions/${latestFile}\n`));

    const summary = await input({
      message: 'Session summary (one line for the index):',
    });

    const status = await select({
      message: 'Session status:',
      choices: [
        { value: 'Complete', name: 'Complete' },
        { value: 'In Progress', name: 'In Progress' },
        { value: 'Blocked', name: 'Blocked' },
      ],
    });

    // Update session file status
    let content = readFile(latestPath);
    content = content.replace('## Status: In Progress', `## Status: ${status}`);
    writeFile(latestPath, content);

    // Update session index
    const indexPath = join(sessionsDir, 'README.md');
    if (fileExists(indexPath)) {
      const indexContent = readFile(indexPath);
      const dateFromFile = latestFile.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || today();
      writeFile(indexPath, appendSessionEntry(indexContent, dateFromFile, status, summary));
    }

    console.log(chalk.green(`\n  Session closed: ${status}`));
    console.log(chalk.dim(`  Summary added to docs/sessions/README.md\n`));
  });

export { sessionCommand };
