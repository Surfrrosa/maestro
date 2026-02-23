import type { QualityFinding, AnalyzerContext } from './types.js';
import { getContent } from './context.js';
import { basename, dirname, join, relative } from 'node:path';
import { existsSync } from 'node:fs';
import { minimatch } from 'minimatch';

interface ImportGraph {
  imports: Map<string, Set<string>>;
  importedBy: Map<string, Set<string>>;
  exports: Map<string, Set<string>>;
}

const RESOLUTION_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
// ESM projects often import with .js extension but actual files are .ts
const EXTENSION_REMAP: Record<string, string[]> = {
  '.js': ['.ts', '.tsx', '.js', '.jsx'],
  '.jsx': ['.tsx', '.jsx'],
  '.mjs': ['.mts', '.mjs'],
};

function resolveImport(importPath: string, fromFile: string, ctx: AnalyzerContext): string | null {
  if (!importPath.startsWith('.')) return null; // Skip package imports

  const fromDir = dirname(fromFile);
  const resolved = join(fromDir, importPath).replace(/\\/g, '/');

  // Try exact match first
  const exactMatch = ctx.files.find(f => f.replace(/\\/g, '/') === resolved);
  if (exactMatch) return exactMatch;

  // ESM remap: import './foo.js' should resolve to './foo.ts'
  const ext = '.' + (resolved.split('.').pop() || '');
  if (EXTENSION_REMAP[ext]) {
    const base = resolved.slice(0, -ext.length);
    for (const tryExt of EXTENSION_REMAP[ext]) {
      const candidate = base + tryExt;
      const match = ctx.files.find(f => f.replace(/\\/g, '/') === candidate);
      if (match) return match;
    }
  }

  // Try with extensions (extensionless imports)
  for (const tryExt of RESOLUTION_EXTENSIONS) {
    const candidate = resolved + tryExt;
    const match = ctx.files.find(f => f.replace(/\\/g, '/') === candidate);
    if (match) return match;
  }

  return null;
}

function buildImportGraph(ctx: AnalyzerContext): ImportGraph {
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();
  const exports = new Map<string, Set<string>>();

  for (const file of ctx.files) {
    imports.set(file, new Set());
    if (!importedBy.has(file)) importedBy.set(file, new Set());
    exports.set(file, new Set());

    const content = getContent(ctx, file);

    if (ctx.stack === 'python') {
      // Python imports
      const patterns = [
        /^from\s+(\.[\w.]*)\s+import\s+(.+)/gm,
        /^import\s+(\.[\w.]+)/gm,
      ];
      for (const pattern of patterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const resolved = resolveImport(match[1].replace(/\./g, '/'), file, ctx);
          if (resolved) {
            imports.get(file)!.add(resolved);
            if (!importedBy.has(resolved)) importedBy.set(resolved, new Set());
            importedBy.get(resolved)!.add(file);
          }
        }
      }

      // Python exports (functions and classes at module level)
      const exportPatterns = /^(?:def|class|async\s+def)\s+(\w+)/gm;
      let expMatch;
      while ((expMatch = exportPatterns.exec(content)) !== null) {
        if (!expMatch[1].startsWith('_')) {
          exports.get(file)!.add(expMatch[1]);
        }
      }
    } else {
      // TS/JS imports
      const importPatterns = [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ];
      for (const pattern of importPatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          const resolved = resolveImport(match[1], file, ctx);
          if (resolved) {
            imports.get(file)!.add(resolved);
            if (!importedBy.has(resolved)) importedBy.set(resolved, new Set());
            importedBy.get(resolved)!.add(file);
          }
        }
      }

      // TS/JS exports
      const exportPatterns = [
        /export\s+(?:function|const|let|var|class|type|interface|enum)\s+(\w+)/g,
        /export\s+default\s+(?:function|class)?\s*(\w+)?/g,
        /export\s+\{([^}]+)\}/g,
      ];
      for (const pattern of exportPatterns) {
        let match;
        pattern.lastIndex = 0;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1]) {
            // For export { a, b, c } -- split by comma
            if (pattern.source.includes('{')) {
              const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
              for (const name of names) {
                if (name) exports.get(file)!.add(name);
              }
            } else {
              exports.get(file)!.add(match[1]);
            }
          }
        }
      }
    }
  }

  return { imports, importedBy, exports };
}

export function analyzeDeadCode(ctx: AnalyzerContext): QualityFinding[] {
  const findings: QualityFinding[] = [];
  const graph = buildImportGraph(ctx);

  // Find unused files (never imported by anything)
  for (const file of ctx.files) {
    const importers = graph.importedBy.get(file);
    if (!importers || importers.size === 0) {
      // Skip entry points and test files
      const base = basename(file);
      const isEntryPoint = /^(index|main|app|server|cli|maestro)\.(ts|js|tsx|jsx|py)$/.test(base);
      const isTest = file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__') || file.startsWith('tests/');
      const isConfig = /\.(config|setup|d)\.(ts|js)$/.test(base) || base.startsWith('.') || /^(vite|vitest|jest|tsup|webpack|rollup|next|tailwind|postcss)/.test(base);
      const isBin = file.startsWith('bin/');
      const isCommand = file.includes('commands/');
      const isTemplate = file.includes('templates/');

      const isIgnored = ctx.config.quality.ignore.some(pattern => minimatch(file, pattern));

      if (!isEntryPoint && !isTest && !isConfig && !isBin && !isCommand && !isTemplate && !isIgnored) {
        findings.push({
          rule: 'unused-file',
          category: 'dead-code',
          severity: 'warning',
          file,
          message: `File is never imported by any other file in the project.`,
          suggestion: 'Remove if unused, or add to an index/barrel export.',
        });
      }
    }
  }

  return findings;
}

// Export for use by structure analyzer
export { buildImportGraph, type ImportGraph };
