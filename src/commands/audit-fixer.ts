import { join } from 'node:path';
import { fileExists, writeFile, ensureDir, detectStack, today } from '../utils/fs.js';
import { SYM } from '../utils/format.js';
import { generateClaudeMd } from '../templates/claude-md.js';
import { generateSessionIndex } from '../templates/session-index.js';
import { generateSessionLog } from '../templates/session-log.js';
import { writeEnvExampleIfMissing } from '../utils/sanitize-env.js';
import type { AuditCheck } from './audit-checks.js';

function fixClaudeMd(cwd: string, projectName: string): void {
  if (fileExists(join(cwd, 'CLAUDE.md'))) return;
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
  console.log(`  ${SYM.plus} Generated CLAUDE.md (run maestro scan for a populated version)`);
}

function fixSessionStructure(cwd: string, projectName: string, checkName: string): void {
  if (checkName === 'Session logs present') {
    const date = today();
    ensureDir(join(cwd, 'docs', 'sessions'));
    writeFile(join(cwd, 'docs', 'sessions', `${date}_session.md`), generateSessionLog(date));
    console.log(`  ${SYM.plus} Created docs/sessions/${date}_session.md`);
  } else {
    ensureDir(join(cwd, 'docs', 'sessions'));
    writeFile(join(cwd, 'docs', 'sessions', 'README.md'), generateSessionIndex(projectName));
    console.log(`  ${SYM.plus} Created docs/sessions/README.md`);
  }
}

function fixEnvExample(cwd: string): void {
  if (writeEnvExampleIfMissing(cwd)) {
    console.log(`  ${SYM.plus} Generated .env.example from .env (values replaced with placeholders)`);
  }
}

export function applyFixes(cwd: string, checks: AuditCheck[]): void {
  const projectName = cwd.split('/').pop() || 'project';

  for (const check of checks) {
    if (check.passed || !check.fixable) continue;

    switch (check.name) {
      case 'CLAUDE.md exists':
      case 'CLAUDE.md has content':
        fixClaudeMd(cwd, projectName);
        break;
      case 'Session logs present':
      case 'Session index maintained':
        fixSessionStructure(cwd, projectName, check.name);
        break;
      case '.env safety':
        fixEnvExample(cwd);
        break;
    }
  }
}
