import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import { join } from 'node:path';
import { readdirSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { writeFile, readFile, fileExists, ensureDir, today } from '../utils/fs.js';
import { generateSessionLog } from '../templates/session-log.js';
import { generateSessionIndex, appendSessionEntry } from '../templates/session-index.js';

function getGitChanges(cwd: string): string[] {
  try {
    // Check if we're in a git repo
    if (!existsSync(join(cwd, '.git'))) return [];

    const output = execSync('git diff --stat HEAD 2>/dev/null || git diff --stat 2>/dev/null || echo ""', {
      cwd,
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    if (!output) {
      // Try unstaged + staged changes
      const allChanges = execSync('git status --porcelain 2>/dev/null || echo ""', {
        cwd,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();

      if (!allChanges) return [];

      return allChanges
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2).trim();
          const file = line.substring(3).trim();
          const statusMap: Record<string, string> = {
            'M': 'modified',
            'A': 'added',
            'D': 'deleted',
            'R': 'renamed',
            '??': 'new',
          };
          return `- ${file} (${statusMap[status] || 'changed'})`;
        });
    }

    // Parse git diff --stat output
    return output
      .split('\n')
      .filter(line => line.includes('|'))
      .map(line => {
        const file = line.split('|')[0].trim();
        return `- ${file}`;
      });
  } catch {
    return [];
  }
}

const sessionCommand = new Command('session')
  .description('Manage development session logs');

sessionCommand
  .command('start')
  .description('Create a new session log for today')
  .option('--quiet', 'Suppress output (for hooks and automation)')
  .action(async (options: { quiet?: boolean }) => {
    const cwd = process.cwd();
    const sessionsDir = join(cwd, 'docs', 'sessions');
    const date = today();

    ensureDir(sessionsDir);

    // Check if session index exists, create if not
    const indexPath = join(sessionsDir, 'README.md');
    if (!fileExists(indexPath)) {
      const projectName = cwd.split('/').pop() || 'project';
      writeFile(indexPath, generateSessionIndex(projectName));
      if (!options.quiet) {
        console.log(chalk.dim(`  Created session index: docs/sessions/README.md`));
      }
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

    if (!options.quiet) {
      const { commandHeader, SYM: sym, hint: fmtHint } = await import('../utils/format.js');
      console.log(commandHeader('session start'));
      console.log(`  ${sym.plus} docs/sessions/${filename}`);
      console.log(chalk.dim(`\n  Fill in your objectives before starting work.\n`));
    }
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

    const { commandHeader: cmdHdr } = await import('../utils/format.js');
    console.log(cmdHdr('session end'));
    console.log(chalk.dim(`  Closing: docs/sessions/${latestFile}\n`));

    // Detect git changes and auto-populate Files Modified
    const gitChanges = getGitChanges(cwd);
    if (gitChanges.length > 0) {
      console.log(chalk.dim(`  Detected ${gitChanges.length} changed file(s) from git.\n`));
    }

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

    // Update session file
    let content = readFile(latestPath);
    content = content.replace('## Status: In Progress', `## Status: ${status}`);

    // Auto-populate Files Modified from git
    if (gitChanges.length > 0) {
      const filesSection = gitChanges.join('\n');
      content = content.replace(
        '## Files Modified\n-',
        `## Files Modified\n${filesSection}`
      );
    }

    writeFile(latestPath, content);

    // Update session index
    const indexPath = join(sessionsDir, 'README.md');
    if (fileExists(indexPath)) {
      const indexContent = readFile(indexPath);
      const dateFromFile = latestFile.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || today();
      writeFile(indexPath, appendSessionEntry(indexContent, dateFromFile, status, summary));
    }

    console.log(chalk.green(`\n  Session closed: ${status}`));
    if (gitChanges.length > 0) {
      console.log(chalk.dim(`  ${gitChanges.length} file(s) auto-added to Files Modified section.`));
    }
    console.log(chalk.dim(`  Summary added to docs/sessions/README.md\n`));
  });

export { sessionCommand };
