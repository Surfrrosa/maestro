import { Command } from 'commander';
import chalk from 'chalk';
import { join } from 'node:path';
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
}

function checkClaudeMdExists(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, 'CLAUDE.md'));
  return {
    name: 'CLAUDE.md exists',
    passed: exists,
    detail: exists ? '' : 'No CLAUDE.md found. AI sessions lack project context.',
    fixable: true,
  };
}

function checkClaudeMdQuality(cwd: string): AuditCheck {
  const path = join(cwd, 'CLAUDE.md');
  if (!fileExists(path)) {
    return { name: 'CLAUDE.md has required sections', passed: false, detail: 'File missing.', fixable: true };
  }
  const content = readFile(path).toLowerCase();
  const required = ['session', 'running', 'key files'];
  const missing = required.filter(s => !content.includes(s));
  return {
    name: 'CLAUDE.md has required sections',
    passed: missing.length === 0,
    detail: missing.length > 0 ? `Missing sections: ${missing.join(', ')}` : '',
    fixable: false,
  };
}

function checkSessionLogs(cwd: string): AuditCheck {
  const dir = join(cwd, 'docs', 'sessions');
  if (!existsSync(dir)) {
    return { name: 'Session logs present', passed: false, detail: 'No docs/sessions/ directory.', fixable: true };
  }
  const logs = readdirSync(dir).filter(f => f.match(/^\d{4}-\d{2}-\d{2}/) && f.endsWith('.md'));
  return {
    name: 'Session logs present',
    passed: logs.length > 0,
    detail: logs.length > 0 ? `${logs.length} log(s)` : 'Directory exists but no session logs found.',
    fixable: true,
  };
}

function checkSessionIndex(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, 'docs', 'sessions', 'README.md'));
  return {
    name: 'Session index maintained',
    passed: exists,
    detail: exists ? '' : 'No docs/sessions/README.md index.',
    fixable: true,
  };
}

function checkEnvSafety(cwd: string): AuditCheck {
  const hasEnv = fileExists(join(cwd, '.env'));
  const hasExample = fileExists(join(cwd, '.env.example'));

  if (!hasEnv) {
    return { name: '.env safety', passed: true, detail: 'No .env file present.', fixable: false };
  }

  // Check if .env is gitignored
  const gitignorePath = join(cwd, '.gitignore');
  if (fileExists(gitignorePath)) {
    const gitignore = readFile(gitignorePath);
    const envIgnored = gitignore.split('\n').some(line => {
      const trimmed = line.trim();
      return trimmed === '.env' || trimmed === '.env*' || trimmed === '.env.*';
    });
    if (!envIgnored) {
      return { name: '.env safety', passed: false, detail: '.env exists but is not in .gitignore.', fixable: false };
    }
  }

  if (!hasExample) {
    return { name: '.env safety', passed: false, detail: '.env exists but no .env.example template.', fixable: true };
  }

  return { name: '.env safety', passed: true, detail: '', fixable: false };
}

function checkGitignore(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, '.gitignore'));
  if (!exists) {
    return { name: '.gitignore exists', passed: false, detail: 'No .gitignore file.', fixable: false };
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
  };
}

function checkDependencyPinning(cwd: string): AuditCheck {
  // Check package.json
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
        };
      }
    } catch {
      return { name: 'Dependency pinning', passed: false, detail: 'Could not parse package.json.', fixable: false };
    }
  }

  // Check requirements.txt
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
      };
    }
  }

  if (!fileExists(pkgPath) && !fileExists(reqPath)) {
    return { name: 'Dependency pinning', passed: true, detail: 'No dependency file found.', fixable: false };
  }

  return { name: 'Dependency pinning', passed: true, detail: '', fixable: false };
}

function checkReadme(cwd: string): AuditCheck {
  const exists = fileExists(join(cwd, 'README.md'));
  return {
    name: 'README exists',
    passed: exists,
    detail: exists ? '' : 'No README.md.',
    fixable: false,
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
            };
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    return { name: 'No tracked secrets', passed: true, detail: 'Could not scan files.', fixable: false };
  }

  return { name: 'No tracked secrets', passed: true, detail: '', fixable: false };
}

function checkTests(cwd: string): AuditCheck {
  const dirs = ['tests', '__tests__', 'test', 'spec'];
  const hasDirs = dirs.some(d => existsSync(join(cwd, d)));

  if (hasDirs) {
    return { name: 'Tests present', passed: true, detail: '', fixable: false };
  }

  // Check for test files in src
  try {
    const testFiles = readdirSync(join(cwd, 'src'), { recursive: true })
      .filter(f => typeof f === 'string' && (f.includes('.test.') || f.includes('.spec.')));
    if (testFiles.length > 0) {
      return { name: 'Tests present', passed: true, detail: `${testFiles.length} test file(s) in src/`, fixable: false };
    }
  } catch {
    // src doesn't exist
  }

  return { name: 'Tests present', passed: false, detail: 'No test directory or test files found.', fixable: false };
}

function applyFixes(cwd: string, checks: AuditCheck[]): void {
  const projectName = cwd.split('/').pop() || 'project';

  for (const check of checks) {
    if (check.passed || !check.fixable) continue;

    switch (check.name) {
      case 'CLAUDE.md exists':
      case 'CLAUDE.md has required sections': {
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
        console.log(`  ${chalk.green('+')} Generated CLAUDE.md (review and customize)`);
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
              const [key] = line.split('=');
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

export const auditCommand = new Command('audit')
  .description('Audit a project against AI-native development methodology')
  .option('--fix', 'Auto-fix gaps where possible')
  .action(async (options: { fix?: boolean }) => {
    const cwd = process.cwd();
    const projectName = cwd.split('/').pop() || 'project';

    console.log(header(`maestro audit`));
    console.log(info(`Project: ${projectName}`));
    console.log('');

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

    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const pct = Math.round((passed / total) * 100);
    const scoreColor = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;

    console.log(`  Score: ${scoreColor.bold(`${pct}/100`)}\n`);

    for (const check of checks) {
      const icon = check.passed ? PASS : FAIL;
      const detail = check.detail ? chalk.dim(` - ${check.detail}`) : '';
      console.log(`  ${icon}  ${check.name}${detail}`);
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
        console.log(chalk.dim(`\n  Run ${chalk.white('maestro audit --fix')} to auto-fix ${fixable.length} issue(s).\n`));
      }
    }

    console.log('');
  });
