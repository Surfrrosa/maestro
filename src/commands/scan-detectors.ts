import { join, relative } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileExists, readFile, detectStack } from '../utils/fs.js';
import type { ProjectType } from '../templates/claude-md.js';

export interface ScannedProject {
  name: string;
  description: string;
  projectType: ProjectType;
  stack: 'node' | 'python' | 'unknown';
  runCommands: string[];
  keyFiles: Array<{ file: string; purpose: string }>;
  aiProvider: string;
  database: string;
  deployTarget: string;
  hasTests: boolean;
  hasCi: boolean;
  dependencies: string[];
}

export function readPkg(cwd: string): Record<string, unknown> | null {
  const pkgPath = join(cwd, 'package.json');
  if (!fileExists(pkgPath)) return null;
  try {
    return JSON.parse(readFile(pkgPath));
  } catch {
    return null;
  }
}

export function inferProjectType(cwd: string): ProjectType {
  const stack = detectStack(cwd);
  const pkg = readPkg(cwd);

  if (stack === 'python') {
    if (fileExists(join(cwd, 'Dockerfile')) || pkg !== null) {
      const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';
      if (reqs.includes('fastapi') || reqs.includes('flask') || reqs.includes('django')) return 'api-python';
      if (reqs.includes('pandas') || reqs.includes('numpy') || reqs.includes('scrapy')) return 'data-pipeline';
    }
    return 'api-python';
  }

  if (stack === 'node' && pkg) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    if (deps['next']) return 'frontend-next';
    if (deps['react-native'] || deps['expo']) return 'mobile-react-native';
    if (deps['express'] || deps['fastify'] || deps['hono']) return 'api-node';
    if (pkg.bin) return 'cli-tool';
    return 'frontend-next';
  }

  if (fileExists(join(cwd, 'index.html'))) return 'frontend-static';

  return 'cli-tool';
}

export function extractDescription(cwd: string): string {
  const readmePath = join(cwd, 'README.md');
  if (fileExists(readmePath)) {
    const readme = readFile(readmePath);
    const lines = readme.split('\n').filter(l => l.trim());
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !line.startsWith('!') && !line.startsWith('```') && !line.startsWith('|') && !line.startsWith('-')) {
        return line;
      }
    }
  }

  const pkg = readPkg(cwd);
  if (pkg?.description && typeof pkg.description === 'string') {
    return pkg.description;
  }

  return '(no description found -- add one here)';
}

export function extractRunCommands(cwd: string, stack: 'node' | 'python' | 'unknown'): string[] {
  const commands: string[] = [];

  if (stack === 'node') {
    const pkg = readPkg(cwd);
    if (pkg?.scripts && typeof pkg.scripts === 'object') {
      const scripts = pkg.scripts as Record<string, string>;
      if (scripts.dev) commands.push(`npm run dev -- ${scripts.dev}`);
      else if (scripts.start) commands.push(`npm start -- ${scripts.start}`);
      if (scripts.build) commands.push(`npm run build`);
      if (scripts.test) commands.push(`npm test`);
      if (scripts.lint) commands.push(`npm run lint`);
    }
  }

  if (stack === 'python') {
    const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';
    if (reqs.includes('fastapi') || reqs.includes('uvicorn')) {
      commands.push('uvicorn src.api.main:app --reload');
    }
    if (reqs.includes('flask')) {
      commands.push('flask run');
    }
    if (reqs.includes('pytest')) {
      commands.push('python -m pytest tests/ -x');
    }
    if (commands.length === 0) {
      commands.push('python -m src.main');
    }
  }

  return commands;
}

const ROOT_PURPOSE_MAP: Record<string, string> = {
  'package.json': 'Dependencies and scripts',
  'requirements.txt': 'Python dependencies',
  'pyproject.toml': 'Python project config',
  'Dockerfile': 'Container configuration',
  'docker-compose.yml': 'Multi-container setup',
  'docker-compose.yaml': 'Multi-container setup',
  '.env.example': 'Environment variable template',
  'Procfile': 'Process declaration (Heroku/Railway)',
  'vercel.json': 'Vercel deployment config',
  'fly.toml': 'Fly.io deployment config',
  'railway.json': 'Railway deployment config',
  'tsconfig.json': 'TypeScript configuration',
  'tailwind.config.js': 'Tailwind CSS configuration',
  'tailwind.config.ts': 'Tailwind CSS configuration',
  'next.config.js': 'Next.js configuration',
  'next.config.ts': 'Next.js configuration',
  'next.config.mjs': 'Next.js configuration',
  'vite.config.ts': 'Vite configuration',
  'app.json': 'Expo app configuration',
  'babel.config.js': 'Babel configuration',
  'vitest.config.ts': 'Test configuration',
  'jest.config.js': 'Test configuration',
  'jest.config.ts': 'Test configuration',
  '.github/workflows/ci.yml': 'CI pipeline',
  '.github/workflows/ci.yaml': 'CI pipeline',
};

const DIR_PURPOSE_MAP: Record<string, string> = {
  'src/api': 'API routes and handlers',
  'src/commands': 'CLI commands',
  'src/components': 'React components',
  'src/lib': 'Shared utilities',
  'src/utils': 'Utility functions',
  'src/hooks': 'React hooks',
  'src/styles': 'Stylesheets',
  'src/types': 'TypeScript type definitions',
  'src/calculations': 'Domain logic / calculations',
  'src/synthesis': 'AI synthesis logic',
  'src/observatory': 'Data verification tools',
  'src/output': 'Output generation',
  'migrations': 'Database migrations',
  'scripts': 'Utility scripts',
  'tests': 'Test suite',
  '__tests__': 'Test suite',
  'docs': 'Documentation',
  'public': 'Static assets',
};

const FILE_PURPOSE_MAP: Record<string, string> = {
  'main.py': 'Application entry point',
  'main.ts': 'Application entry point',
  'index.ts': 'Module entry point',
  'index.tsx': 'Application entry point',
  'app.py': 'Application entry point',
  'app.ts': 'Application entry point',
  'config.py': 'Configuration and environment variables',
  'config.ts': 'Configuration and environment variables',
  'models.py': 'Data models / schemas',
  'models.ts': 'Data models / schemas',
  'database.py': 'Database client / connection',
  'database.ts': 'Database client / connection',
  'db.ts': 'Database client / connection',
  'middleware.ts': 'Express/API middleware',
  'auth.ts': 'Authentication logic',
  'auth.py': 'Authentication logic',
  'layout.tsx': 'Root layout component',
  'page.tsx': 'Page component',
  'schema.prisma': 'Prisma database schema',
};

const SKIP_DIRS = new Set([
  'node_modules', '__pycache__', 'dist', 'build', '.next',
]);

function addDirEntry(
  relativePath: string,
  fullPath: string,
  cwd: string,
  depth: number,
  maxDepth: number,
  keyFiles: Array<{ file: string; purpose: string }>,
): void {
  const purpose = DIR_PURPOSE_MAP[relativePath];
  if (purpose) keyFiles.push({ file: `${relativePath}/`, purpose });
  scanDir(fullPath, cwd, depth + 1, maxDepth, keyFiles);
}

function scanDir(
  dir: string,
  cwd: string,
  depth: number,
  maxDepth: number,
  keyFiles: Array<{ file: string; purpose: string }>,
): void {
  if (depth > maxDepth) return;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const fullPath = join(dir, entry.name);
      const relativePath = relative(cwd, fullPath);

      if (entry.isDirectory()) {
        addDirEntry(relativePath, fullPath, cwd, depth, maxDepth, keyFiles);
      } else if (FILE_PURPOSE_MAP[entry.name] && depth <= 2) {
        keyFiles.push({ file: relativePath, purpose: FILE_PURPOSE_MAP[entry.name] });
      }
    }
  } catch {
    // Skip unreadable directories
  }
}

export function scanKeyFiles(cwd: string, maxDepth: number = 3): Array<{ file: string; purpose: string }> {
  const keyFiles: Array<{ file: string; purpose: string }> = [];

  for (const [file, purpose] of Object.entries(ROOT_PURPOSE_MAP)) {
    if (fileExists(join(cwd, file))) {
      keyFiles.push({ file, purpose });
    }
  }

  scanDir(cwd, cwd, 0, maxDepth, keyFiles);

  const seen = new Set<string>();
  return keyFiles.filter(f => {
    if (seen.has(f.file)) return false;
    seen.add(f.file);
    return true;
  }).sort((a, b) => a.file.localeCompare(b.file));
}

export function detectAiProvider(cwd: string): string {
  const pkg = readPkg(cwd);
  const deps = pkg ? { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) } : {};
  const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';

  const hasAnthropic = deps['@anthropic-ai/sdk'] || deps['anthropic'] || reqs.includes('anthropic');
  const hasOpenai = deps['openai'] || reqs.includes('openai');

  if (hasAnthropic && hasOpenai) return 'both';
  if (hasAnthropic) return 'anthropic';
  if (hasOpenai) return 'openai';
  return 'none';
}

export function detectDatabase(cwd: string): string {
  const pkg = readPkg(cwd);
  const deps = pkg ? { ...(pkg.dependencies as Record<string, string> || {}), ...(pkg.devDependencies as Record<string, string> || {}) } : {};
  const reqs = fileExists(join(cwd, 'requirements.txt')) ? readFile(join(cwd, 'requirements.txt')) : '';

  if (deps['@supabase/supabase-js'] || reqs.includes('supabase')) return 'supabase';
  if (deps['@prisma/client'] || deps['pg'] || deps['postgres'] || reqs.includes('psycopg2') || reqs.includes('asyncpg')) return 'postgres';
  if (deps['firebase'] || deps['firebase-admin'] || reqs.includes('firebase')) return 'firebase';
  return 'none';
}

export function detectDeployTarget(cwd: string): string {
  if (fileExists(join(cwd, 'vercel.json')) || fileExists(join(cwd, '.vercel'))) return 'vercel';
  if (fileExists(join(cwd, 'fly.toml'))) return 'fly';
  if (fileExists(join(cwd, 'railway.json')) || fileExists(join(cwd, 'railway.toml'))) return 'railway';
  if (fileExists(join(cwd, 'Dockerfile'))) return 'docker';
  if (fileExists(join(cwd, 'Procfile'))) return 'railway';
  return 'local';
}

export function detectDependencies(cwd: string): string[] {
  const deps: string[] = [];
  const pkg = readPkg(cwd);
  if (pkg?.dependencies) {
    deps.push(...Object.keys(pkg.dependencies as Record<string, string>));
  }
  if (fileExists(join(cwd, 'requirements.txt'))) {
    const reqs = readFile(join(cwd, 'requirements.txt'));
    const pkgs = reqs.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split(/[>=<!\[]/)[0].trim())
      .filter(Boolean);
    deps.push(...pkgs);
  }
  return deps;
}
