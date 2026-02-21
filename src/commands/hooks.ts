import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { existsSync, chmodSync } from 'node:fs';
import { writeFile, ensureDir, fileExists, readFile } from '../utils/fs.js';
import { header, info } from '../utils/format.js';

function generateClaudeHookConfig(): string {
  return JSON.stringify({
    hooks: {
      PreToolUse: [
        {
          matcher: ".*",
          hook: "maestro check --hook",
          description: "Verify project context is loaded before AI starts work"
        }
      ]
    }
  }, null, 2);
}

function generateGitPostCheckout(): string {
  return `#!/bin/sh
# Auto-create session log when switching branches
# Installed by maestro hooks install

# Only run on branch checkout (not file checkout)
if [ "$3" = "1" ]; then
  if command -v maestro > /dev/null 2>&1; then
    maestro session start --quiet 2>/dev/null
  fi
fi
`;
}

const hooksCommand = new Command('hooks')
  .description('Install integration hooks for Claude Code and git');

hooksCommand
  .command('install')
  .description('Install pre-session hooks')
  .option('--claude', 'Install Claude Code hook only')
  .option('--git', 'Install git post-checkout hook only')
  .action(async (options: { claude?: boolean; git?: boolean }) => {
    const cwd = process.cwd();
    const installBoth = !options.claude && !options.git;

    console.log(header('maestro hooks install'));

    if (installBoth || options.claude) {
      const claudeDir = join(cwd, '.claude');
      const hookPath = join(claudeDir, 'hooks.json');

      if (fileExists(hookPath)) {
        console.log(chalk.yellow(`  .claude/hooks.json already exists. Skipping.`));
        console.log(chalk.dim(`  To overwrite, delete it first and re-run.\n`));
      } else {
        ensureDir(claudeDir);
        writeFile(hookPath, generateClaudeHookConfig());
        console.log(chalk.green(`  + .claude/hooks.json (Claude Code pre-session hook)`));
      }
    }

    if (installBoth || options.git) {
      const gitDir = join(cwd, '.git');
      if (!existsSync(gitDir)) {
        console.log(chalk.yellow(`  Not a git repository. Skipping git hook.\n`));
      } else {
        const hookDir = join(gitDir, 'hooks');
        const hookPath = join(hookDir, 'post-checkout');

        if (fileExists(hookPath)) {
          const existing = readFile(hookPath);
          if (existing.includes('maestro')) {
            console.log(chalk.yellow(`  post-checkout hook already contains maestro. Skipping.`));
          } else {
            console.log(chalk.yellow(`  post-checkout hook already exists (not maestro). Skipping.`));
            console.log(chalk.dim(`  To add manually, append: maestro session start --quiet\n`));
          }
        } else {
          ensureDir(hookDir);
          writeFile(hookPath, generateGitPostCheckout());
          chmodSync(hookPath, '755');
          console.log(chalk.green(`  + .git/hooks/post-checkout (auto session log on branch switch)`));
        }
      }
    }

    console.log(chalk.dim(`\n  Hooks installed. maestro check will run before AI tool use.\n`));
  });

export { hooksCommand };
