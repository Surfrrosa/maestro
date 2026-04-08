import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
import { chmodSync, unlinkSync } from 'node:fs';
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

function generatePreCommitHook(): string {
  return `#!/bin/sh
# Pre-commit quality gate
# Installed by maestro hooks install --pre-commit

if command -v maestro > /dev/null 2>&1; then
  echo "Running maestro pre-commit checks..."

  maestro security --ci --severity high 2>/dev/null
  SECURITY_EXIT=$?

  maestro review --strict 2>/dev/null
  REVIEW_EXIT=$?

  if [ $SECURITY_EXIT -ne 0 ] || [ $REVIEW_EXIT -ne 0 ]; then
    echo ""
    echo "Pre-commit checks failed. Fix issues before committing."
    echo "Use git commit --no-verify to bypass (not recommended)."
    exit 1
  fi
fi
`;
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

function installGitHook(cwd: string, gitDir: string): void {
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
    return;
  }

  ensureDir(hookDir);
  writeFile(hookPath, generateGitPostCheckout());
  chmodSync(hookPath, '755');
  console.log(chalk.green(`  + .git/hooks/post-checkout (auto session log on branch switch)`));
}

function installPreCommitHook(cwd: string, gitDir: string): void {
  const hookDir = join(gitDir, 'hooks');
  const hookPath = join(hookDir, 'pre-commit');

  if (fileExists(hookPath)) {
    const existing = readFile(hookPath);
    if (existing.includes('maestro')) {
      console.log(chalk.yellow(`  pre-commit hook already contains maestro. Skipping.`));
    } else {
      console.log(chalk.yellow(`  pre-commit hook already exists (not maestro). Skipping.`));
      console.log(chalk.dim(`  To add manually, see: maestro review --help\n`));
    }
    return;
  }

  ensureDir(hookDir);
  writeFile(hookPath, generatePreCommitHook());
  chmodSync(hookPath, '755');
  console.log(chalk.green(`  + .git/hooks/pre-commit (security + review on commit)`));
}

const hooksCommand = new Command('hooks')
  .description('Install integration hooks for Claude Code and git');

hooksCommand
  .command('install')
  .description('Install pre-session hooks')
  .option('--claude', 'Install Claude Code hook only')
  .option('--git', 'Install git post-checkout hook only')
  .option('--pre-commit', 'Install git pre-commit hook (security + review)')
  .action(async (options: { claude?: boolean; git?: boolean; preCommit?: boolean }) => {
    const cwd = process.cwd();
    const installBoth = !options.claude && !options.git && !options.preCommit;

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
      if (!fileExists(gitDir)) {
        console.log(chalk.yellow(`  Not a git repository. Skipping git hook.\n`));
      } else {
        installGitHook(cwd, gitDir);
      }
    }

    if (options.preCommit) {
      const gitDir = join(cwd, '.git');
      if (!fileExists(gitDir)) {
        console.log(chalk.yellow(`  Not a git repository. Skipping pre-commit hook.\n`));
      } else {
        installPreCommitHook(cwd, gitDir);
      }
    }

    console.log(chalk.dim(`\n  Next: maestro check\n`));
  });

hooksCommand
  .command('uninstall')
  .description('Remove maestro-installed hooks')
  .option('--claude', 'Remove Claude Code hook only')
  .option('--git', 'Remove git post-checkout hook only')
  .option('--pre-commit', 'Remove git pre-commit hook only')
  .action(async (options: { claude?: boolean; git?: boolean; preCommit?: boolean }) => {
    const cwd = process.cwd();
    const removeAll = !options.claude && !options.git && !options.preCommit;
    let removed = 0;

    console.log(header('maestro hooks uninstall'));

    if (removeAll || options.claude) {
      const hookPath = join(cwd, '.claude', 'hooks.json');
      if (fileExists(hookPath)) {
        const content = readFile(hookPath);
        if (content.includes('maestro')) {
          unlinkSync(hookPath);
          console.log(chalk.green(`  - .claude/hooks.json (removed)`));
          removed++;
        } else {
          console.log(chalk.yellow(`  .claude/hooks.json exists but was not installed by maestro. Skipping.`));
        }
      } else {
        console.log(chalk.dim(`  .claude/hooks.json not found.`));
      }
    }

    if (removeAll || options.git) {
      const hookPath = join(cwd, '.git', 'hooks', 'post-checkout');
      if (fileExists(hookPath)) {
        const content = readFile(hookPath);
        if (content.includes('maestro')) {
          unlinkSync(hookPath);
          console.log(chalk.green(`  - .git/hooks/post-checkout (removed)`));
          removed++;
        } else {
          console.log(chalk.yellow(`  post-checkout hook exists but was not installed by maestro. Skipping.`));
        }
      } else {
        console.log(chalk.dim(`  .git/hooks/post-checkout not found.`));
      }
    }

    if (removeAll || options.preCommit) {
      const hookPath = join(cwd, '.git', 'hooks', 'pre-commit');
      if (fileExists(hookPath)) {
        const content = readFile(hookPath);
        if (content.includes('maestro')) {
          unlinkSync(hookPath);
          console.log(chalk.green(`  - .git/hooks/pre-commit (removed)`));
          removed++;
        } else {
          console.log(chalk.yellow(`  pre-commit hook exists but was not installed by maestro. Skipping.`));
        }
      } else {
        console.log(chalk.dim(`  .git/hooks/pre-commit not found.`));
      }
    }

    if (removed === 0) {
      console.log(chalk.dim(`\n  No maestro hooks found to remove.\n`));
    } else {
      console.log(chalk.dim(`\n  Removed ${removed} hook(s).\n`));
    }
  });

export { hooksCommand };
