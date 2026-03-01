import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileExists, readFile, detectStack } from '../utils/fs.js';
import { runSecurityScan } from './security.js';

export interface AuditCheck {
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

function checkNodeDependencyPinning(cwd: string): AuditCheck | null {
  const pkgPath = join(cwd, 'package.json');
  if (!fileExists(pkgPath)) return null;
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
  return null;
}

function checkPythonDependencyPinning(cwd: string): AuditCheck | null {
  const reqPath = join(cwd, 'requirements.txt');
  if (!fileExists(reqPath)) return null;
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
  return null;
}

function checkDependencyPinning(cwd: string): AuditCheck {
  const nodeResult = checkNodeDependencyPinning(cwd);
  if (nodeResult) return nodeResult;

  const pythonResult = checkPythonDependencyPinning(cwd);
  if (pythonResult) return pythonResult;

  const pkgPath = join(cwd, 'package.json');
  const reqPath = join(cwd, 'requirements.txt');
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
  try {
    const findings = await runSecurityScan(cwd);
    const secrets = findings.filter(f => f.category === 'secrets');
    if (secrets.length > 0) {
      const locations = secrets.slice(0, 3).map(f => f.file).filter(Boolean);
      const detail = `${secrets.length} potential secret(s) found${locations.length > 0 ? ` in ${locations.join(', ')}` : ''}.`;
      return { name: 'No tracked secrets', passed: false, detail, fixable: false, weight: 5 };
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
