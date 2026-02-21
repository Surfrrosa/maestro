import { Command } from 'commander';
import chalk from 'chalk';
import { join, basename } from 'node:path';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { glob } from 'glob';
import { PASS, FAIL, header, info } from '../utils/format.js';
import { fileExists, readFile, writeFile, ensureDir, detectStack, today } from '../utils/fs.js';
import { generateClaudeMd } from '../templates/claude-md.js';
import { generateSessionIndex } from '../templates/session-index.js';
import { generateSessionLog } from '../templates/session-log.js';

interface AuditCheck {
  name: string;
  passed: boolean;
  detail: string;
  fixable: boolean;
  weight: number;
}

function checkClaudeMdExists(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, 'CLAUDE.md'));
  return {
    name: 'CLAUDE.md exists',
    passed: exists,
    detail: exists ? '' : 'No CLAUDE.md found. AI sessions lack project context.',
    fixable: true,
    weight: 15,
  };
}

function checkClaudeMdQuality(cwd: string): AuditCheck {
  const path = join(cwd, 'CLAUDE.md');
  if (!fileExists(path)) {
    return { name: 'CLAUDE.md has content', passed: false, detail: 'File missing.', fixable: true, weight: 10 };
  }
  const content = readFile(path);
  const lower = content.toLowerCase();
  const requiredSections = ['session', 'running', 'key files'];
  const missingSections = requiredSections.filter(s => !lower.includes(s));

  // Check for actual content depth (not just headers with TODOs)
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('<!--') && !l.startsWith('|--'));
  const hasSubstance = lines.length > 10;

  if (missingSections.length > 0) {
    return {
      name: 'CLAUDE.md has content',
      passed: false,
      detail: `Missing sections: ${missingSections.join(', ')}`,
      fixable: false,
      weight: 10,
    };
  }

  if (!hasSubstance) {
    return {
      name: 'CLAUDE.md has content',
      passed: false,
      detail: 'CLAUDE.md has headers but minimal content. Run maestro scan to populate it.',
      fixable: false,
      weight: 10,
    };
  }

  return { name: 'CLAUDE.md has content', passed: true, detail: '', fixable: false, weight: 10 };
}

function checkSessionLogs(cwd: string): AuditCheck {
  const dir = join(cwd, 'docs', 'sessions');
  if (!existsSync(dir)) {
    return { name: 'Session logs present', passed: false, detail: 'No docs/sessions/ directory.', fixable: true, weight: 10 };
  }
  const logs = readdirSync(dir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}/) && f.endsWith('.md'));
  return {
    name: 'Session logs present',
    passed: logs.length > 0,
    detail: logs.length > 0 ? `${logs.length} log(s)` : 'Directory exists but no session logs found.',
    fixable: true,
    weight: 10,
  };
}

function checkSessionIndex(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, 'docs', 'sessions', 'README.md'));
  return {
    name: 'Session index maintained',
    passed: exists,
    detail: exists ? '' : 'No docs/sessions/README.md index.',
    fixable: true,
    weight: 5,
  };
}

function checkEnvSafety(cwd: string): AuditCheck {
  const hasEnv = fileExists(join(cwd, '.env'));
  const hasExample = fileExists(join(cwd, '.env.example'));

  if (!hasEnv) {
    return { name: '.env safety', passed: true, detail: 'No .env file present.', fixable: false, weight: 10 };
  }

  const gitignorePath = join(cwd, '.gitignore');
  if (fileExists(gitignorePath)) {
    const gitignore = readFile(gitignorePath);
    const envIgnored = gitignore.split('\n').some(line => {
      const trimmed = line.trim();
      return trimmed === '.env' || trimmed === '.env*' || trimmed === '.env.*';
    });
    if (!envIgnored) {
      return { name: '.env safety', passed: false, detail: '.env exists but is not in .gitignore.', fixable: false, weight: 10 };
    }
  }

  if (!hasExample) {
    return { name: '.env safety', passed: false, detail: '.env exists but no .env.example template.', fixable: true, weight: 10 };
  }

  return { name: '.env safety', passed: true, detail: '', fixable: false, weight: 10 };
}

function checkGitignore(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, '.gitignore'));
  if (!exists) {
    return { name: '.gitignore exists', passed: false, detail: 'No .gitignore file.', fixable: false, weight: 5 };
  }
  const content = readFile(join(cwd, '.gitignore'));
  const stack = detectStack(cwd);
  const missing: string[] = [];

  if (stack === 'node' && !content.includes('node_modules')) missing.push('node_modules');
  if (stack === 'python' && !content.includes('__pycache__')) missing.push('__pycache__');
  if (!content.includes('.DS_Store')) missing.push('.DS_Store');

  return {
    name: '.gitignore comprehensive',
    passed: missing.length === 0,
    detail: missing.length > 0 ? `Missing: ${missing.join(', ')}` : '',
    fixable: false,
    weight: 5,
  };
}

function checkDependencyPinning(cwd: string): AuditCheck {
  const pkgPath = join(cwd, 'package.json');
  if (fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(readFile(pkgPath));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const unpinned = Object.entries(deps).filter(
        ([, v]) => typeof v === 'string' && (v.startsWith('^') || v.startsWith('~'))
      );
      if (unpinned.length > 0) {
        return {
          name: 'Dependency pinning',
          passed: false,
          detail: `${unpinned.length} unpinned package(s): ${unpinned.slice(0, 3).map(([k]) => k).join(', ')}${unpinned.length > 3 ? '...' : ''}`,
          fixable: false,
          weight: 10,
        };
      }
    } catch {
      return { name: 'Dependency pinning', passed: false, detail: 'Could not parse package.json.', fixable: false, weight: 10 };
    }
  }

  const reqPath = join(cwd, 'requirements.txt');
  if (fileExists(reqPath)) {
    const content = readFile(reqPath);
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const unpinned = lines.filter(l => !l.includes('=='));
    if (unpinned.length > 0) {
      return {
        name: 'Dependency pinning',
        passed: false,
        detail: `${unpinned.length} unpinned package(s): ${unpinned.slice(0, 3).map(l => l.split(/[>=<]/)[0]).join(', ')}${unpinned.length > 3 ? '...' : ''}`,
        fixable: false,
        weight: 10,
      };
    }
  }

  if (!fileExists(pkgPath) && !fileExists(reqPath)) {
    return { name: 'Dependency pinning', passed: true, detail: 'No dependency file found.', fixable: false, weight: 10 };
  }

  return { name: 'Dependency pinning', passed: true, detail: '', fixable: false, weight: 10 };
}

function checkReadme(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, 'README.md'));
  return {
    name: 'README exists',
    passed: exists,
    detail: exists ? '' : 'No README.md.',
    fixable: false,
    weight: 5,
  };
}

function checkArchitecture(cwd: string): AuditCheck {
  const paths = [
    join(cwd, 'docs', 'ARCHITECTURE.md'),
    join(cwd, 'docs', 'architecture.md'),
    join(cwd, 'ARCHITECTURE.md'),
  ];
  const exists = paths.some(p => fileExists(p));
  return {
    name: 'Architecture documented',
    passed: exists,
    detail: exists ? '' : 'No architecture document found.',
    fixable: false,
    weight: 10,
  };
}

function checkSecurity(cwd: string): AuditCheck {
  const paths = [
    join(cwd, 'docs', 'SECURITY_CHECKLIST.md'),
    join(cwd, 'docs', 'SECURITY.md'),
    join(cwd, 'docs', 'security.md'),
    join(cwd, 'SECURITY.md'),
  ];
  const exists = paths.some(p => fileExists(p));
  return {
    name: 'Security checklist present',
    passed: exists,
    detail: exists ? '' : 'No security checklist found.',
    fixable: false,
    weight: 10,
  };
}

async function checkSecrets(cwd: string): Promise<AuditCheck> {
  const patterns = [
    /(?:api[_-]?key|apikey|secret[_-]?key|access[_-]?token|auth[_-]?token)\s*[:=]\s*['\"][a-zA-Z0-9]{16,}/i,
    /sk-[a-zA-Z0-9]{20,}/,
    /ghp_[a-zA-Z0-9]{36}/,
    /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/,
  ];

  try {
    const files = await glob('**/*.{ts,js,py,json,yml,yaml,toml,cfg,ini}', {
      cwd,
      ignore: ['node_modules/**', 'dist/**', '.git/**', '__pycache__/**', '*.lock', 'package-lock.json'],
      maxDepth: 5,
    });

    for (const file of files.slice(0, 100)) {
      try {
        const content = readFileSync(join(cwd, file), 'utf-8');
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            return {
              name: 'No tracked secrets',
              passed: false,
              detail: `Potential secret found in ${file}.`,
              fixable: false,
              weight: 5,
            };
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    return { name: 'No tracked secrets', passed: true, detail: 'Could not scan files.', fixable: false, weight: 5 };
  }

  return { name: 'No tracked secrets', passed: true, detail: '', fixable: false, weight: 5 };
}

function checkTests(cwd: string): AuditCheck {
  const dirs = ['tests', '__tests__', 'test', 'spec'];
  const hasDirs = dirs.some(d => existsSync(join(cwd, d)));

  if (hasDirs) {
    return { name: 'Tests present', passed: true, detail: '', fixable: false, weight: 5 };
  }

  try {
    const srcDir = join(cwd, 'src');
    if (existsSync(srcDir)) {
      const testFiles = readdirSync(srcDir, { recursive: true })
        .filter(f => typeof f === 'string' && (f.includes('.test.') || f.includes('.spec.')));
      if (testFiles.length > 0) {
        return { name: 'Tests present', passed: true, detail: `${testFiles.length} test file(s) in src/`, fixable: false, weight: 5 };
      }
    }
  } catch {
    // src doesn't exist
  }

  return { name: 'Tests present', passed: false, detail: 'No test directory or test files found.', fixable: false, weight: 5 };
}

function applyFixes(cwd: string, checks: AuditCheck[]): void {
  const projectName = cwd.split('/').pop() || 'project';

  for (const check of checks) {
    if (check.passed || !check.fixable) continue;

    switch (check.name) {
      case 'CLAUDE.md exists':
      case 'CLAUDE.md has content': {
        if (!fileExists(join(cwd, 'CLAUDE.md'))) {
          const stack = detectStack(cwd);
          const projectType = stack === 'python' ? 'api-python' : stack === 'node' ? 'api-node' : 'cli-tool';
          writeFile(join(cwd, 'CLAUDE.md'), generateClaudeMd({
            projectName,
            projectType,
            description: '(TODO: add project description)',
            deployTarget: 'local',
            aiProvider: 'none',
            database: 'none',
          }));
          console.log(`  ${chalk.green('+')} Generated CLAUDE.md (run maestro scan for a populated version)`);
        }
        break;
      }
      case 'Session logs present': {
        const date = today();
        ensureDir(join(cwd, 'docs', 'sessions'));
        writeFile(join(cwd, 'docs', 'sessions', `${date}_session.md`), generateSessionLog(date));
        console.log(`  ${chalk.green('+')} Created docs/sessions/${date}_session.md`);
        break;
      }
      case 'Session index maintained':
        ensureDir(join(cwd, 'docs', 'sessions'));
        writeFile(join(cwd, 'docs', 'sessions', 'README.md'), generateSessionIndex(projectName));
        console.log(`  ${chalk.green('+')} Created docs/sessions/README.md`);
        break;
      case '.env safety': {
        if (fileExists(join(cwd, '.env')) && !fileExists(join(cwd, '.env.example'))) {
          const envContent = readFile(join(cwd, '.env'));
          const sanitized = envContent
            .split('\n')
            .map(line => {
              if (line.startsWith('#') || !line.includes('=')) return line;
              const eqIndex = line.indexOf('=');
              const key = line.substring(0, eqIndex);
              return `${key}=your_value_here`;
            })
            .join('\n');
          writeFile(join(cwd, '.env.example'), sanitized);
          console.log(`  ${chalk.green('+')} Generated .env.example from .env (values replaced with placeholders)`);
        }
        break;
      }
    }
  }
}

export async function runAuditChecks(cwd: string): Promise<{ checks: AuditCheck[]; score: number; totalWeight: number }> {
  const checks: AuditCheck[] = [
    checkClaudeMdExists(cwd),
    checkClaudeMdQuality(cwd),
    checkSessionLogs(cwd),
    checkSessionIndex(cwd),
    checkEnvSafety(cwd),
    checkGitignore(cwd),
    checkDependencyPinning(cwd),
    checkReadme(cwd),
    checkArchitecture(cwd),
    checkSecurity(cwd),
    await checkSecrets(cwd),
    checkTests(cwd),
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earnedWeight = checks.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return { checks, score, totalWeight };
}

export function generateBadge(score: number): string {
  const color = score >= 80 ? 'brightgreen' : score >= 60 ? 'yellow' : score >= 40 ? 'orange' : 'red';
  return `![Maestro Score](https://img.shields.io/badge/maestro-${score}%2F100-${color})`;
}

export const auditCommand = new Command('audit')
  .description('Audit a project against AI-native development methodology')
  .option('--fix', 'Auto-fix gaps where possible')
  .option('--ci <threshold>', 'Exit non-zero if score is below threshold (for CI pipelines)', parseInt)
  .option('--badge', 'Output a shields.io badge for your README')
  .action(async (options: { fix?: boolean; ci?: number; badge?: boolean }) => {
    const cwd = process.cwd();
    const projectName = basename(cwd);
    const { checks, score } = await runAuditChecks(cwd);

    if (options.badge) {
      console.log(`\n  ${generateBadge(score)}\n`);
      return;
    }

    const scoreColor = score >= 80 ? chalk.green : score >= 60 ? chalk.yellow : score >= 40 ? chalk.hex('#FFA500') : chalk.red;

    console.log(header('maestro audit'));
    console.log(info(`Project: ${projectName}`));
    console.log(`\n  Score: ${scoreColor.bold(`${score}/100`)}\n`);

    for (const check of checks) {
      const icon = check.passed ? PASS : FAIL;
      const weight = chalk.dim(`[${check.weight}pts]`);
      const detail = check.detail ? chalk.dim(` - ${check.detail}`) : '';
      console.log(`  ${icon}  ${check.name} ${weight}${detail}`);
    }

    const failed = checks.filter(c => !c.passed);
    if (failed.length > 0) {
      console.log(chalk.bold('\n  Recommendations:\n'));
      for (const check of failed) {
        if (check.detail) {
          console.log(`  ${chalk.yellow('-')} ${check.detail}`);
        }
      }
    }

    if (options.fix) {
      const fixable = checks.filter(c => !c.passed && c.fixable);
      if (fixable.length > 0) {
        console.log(chalk.bold('\n  Applying fixes...\n'));
        applyFixes(cwd, checks);
        console.log(chalk.dim('\n  Re-run maestro audit to verify fixes.\n'));
      } else {
        console.log(chalk.dim('\n  No auto-fixable issues found.\n'));
      }
    } else {
      const fixable = checks.filter(c => !c.passed && c.fixable);
      if (fixable.length > 0) {
        console.log(chalk.dim(`\n  Run ${chalk.white('maestro audit --fix')} to auto-fix ${fixable.length} issue(s).`));
      }
      console.log(chalk.dim(`  Run ${chalk.white('maestro scan')} to generate populated docs from your codebase.\n`));
    }

    // CI mode: exit with error if below threshold
    if (options.ci !== undefined) {
      if (score < options.ci) {
        console.log(chalk.red(`\n  CI FAIL: Score ${score} is below threshold ${options.ci}\n`));
        process.exit(1);
      } else {
        console.log(chalk.green(`\n  CI PASS: Score ${score} meets threshold ${options.ci}\n`));
      }
    }

    console.log('');
  });

// audit-all command
export const auditAllCommand = new Command('audit-all')
  .description('Audit all repos in a directory')
  .argument('<directory>', 'Directory containing repos to audit')
  .option('--sort <field>', 'Sort by: score (default), name', 'score')
  .action(async (directory: string, options: { sort: string }) => {
    const { resolve } = await import('node:path');
    const targetDir = resolve(directory);

    if (!existsSync(targetDir)) {
      console.log(chalk.red(`\n  Directory not found: ${targetDir}\n`));
      return;
    }

    console.log(header('maestro audit-all'));
    console.log(info(`Scanning: ${targetDir}\n`));

    const entries = readdirSync(targetDir, { withFileTypes: true });
    const repos = entries
      .filter(e => e.isDirectory() && existsSync(join(targetDir, e.name, '.git')))
      .map(e => e.name);

    if (repos.length === 0) {
      console.log(chalk.yellow('  No git repositories found in this directory.\n'));
      return;
    }

    const results: Array<{ name: string; score: number }> = [];

    for (const repo of repos) {
      const repoPath = join(targetDir, repo);
      try {
        const { score } = await runAuditChecks(repoPath);
        results.push({ name: repo, score });
      } catch {
        results.push({ name: repo, score: -1 });
      }
    }

    // Sort
    if (options.sort === 'name') {
      results.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      results.sort((a, b) => b.score - a.score);
    }

    // Output table
    const maxNameLen = Math.max(...results.map(r => r.name.length), 10);
    const header_line = `  ${'Repository'.padEnd(maxNameLen)}  Score`;
    const divider_line = `  ${'-'.repeat(maxNameLen)}  -----`;
    console.log(chalk.bold(header_line));
    console.log(chalk.dim(divider_line));

    for (const r of results) {
      const scoreColor = r.score >= 80 ? chalk.green : r.score >= 60 ? chalk.yellow : r.score >= 40 ? chalk.hex('#FFA500') : chalk.red;
      const scoreStr = r.score >= 0 ? scoreColor.bold(`${r.score}/100`) : chalk.dim('error');
      console.log(`  ${r.name.padEnd(maxNameLen)}  ${scoreStr}`);
    }

    const avg = results.filter(r => r.score >= 0);
    if (avg.length > 0) {
      const avgScore = Math.round(avg.reduce((s, r) => s + r.score, 0) / avg.length);
      console.log(chalk.dim(divider_line));
      console.log(`  ${'Average'.padEnd(maxNameLen)}  ${chalk.bold(`${avgScore}/100`)}`);
    }

    console.log(`\n  ${chalk.dim(`${repos.length} repos scanned.`)}\n`);
  });
