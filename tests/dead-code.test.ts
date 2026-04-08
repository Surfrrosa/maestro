import { describe, it, expect } from 'vitest';
import { analyzeDeadCode } from '../src/analyzers/dead-code.js';
import type { AnalyzerContext } from '../src/analyzers/types.js';

function makeContext(files: Record<string, string>, stack: 'node' | 'python' = 'node'): AnalyzerContext {
  return {
    cwd: '/fake',
    files: Object.keys(files),
    fileContents: new Map(Object.entries(files)),
    stack,
    sourceExtensions: stack === 'python' ? ['py'] : ['ts', 'js'],
    config: { quality: { ignore: [] } },
    pathAliases: new Map(),
  };
}

describe('analyzeDeadCode', () => {
  it('returns empty findings for single-file project', () => {
    const ctx = makeContext({ 'src/app.ts': 'export const x = 1;\n' });
    const findings = analyzeDeadCode(ctx);
    expect(findings).toHaveLength(0);
  });

  it('flags files that are never imported', () => {
    const ctx = makeContext({
      'src/used.ts': 'import { helper } from "./helper.js";\nexport const x = 1;',
      'src/helper.ts': 'export function helper() {}',
      'src/orphan.ts': 'export function lonely() {}',
    });
    const findings = analyzeDeadCode(ctx);
    expect(findings.some(f => f.rule === 'unused-file' && f.file === 'src/orphan.ts')).toBe(true);
  });

  it('does not flag entry-point files', () => {
    const ctx = makeContext({
      'src/index.ts': 'export const x = 1;',
    });
    const findings = analyzeDeadCode(ctx);
    expect(findings.some(f => f.file === 'src/index.ts')).toBe(false);
  });

  it('does not flag Next.js App Router page.tsx', () => {
    const ctx = makeContext({
      'app/src/app/page.tsx': 'export default function Home() { return <div/>; }',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'app/src/app/page.tsx')).toBe(false);
  });

  it('does not flag Next.js App Router layout.tsx', () => {
    const ctx = makeContext({
      'app/src/app/layout.tsx': 'export default function Layout({ children }) { return children; }',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'app/src/app/layout.tsx')).toBe(false);
  });

  it('does not flag Next.js App Router route.ts', () => {
    const ctx = makeContext({
      'app/src/app/api/auth/route.ts': 'export async function GET() { return Response.json({}); }',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'app/src/app/api/auth/route.ts')).toBe(false);
  });

  it('does not flag not-found.tsx', () => {
    const ctx = makeContext({
      'app/src/app/not-found.tsx': 'export default function NotFound() { return <div>404</div>; }',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'app/src/app/not-found.tsx')).toBe(false);
  });

  it('does not flag middleware.ts', () => {
    const ctx = makeContext({
      'middleware.ts': 'export function middleware(req) { return NextResponse.next(); }',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'middleware.ts')).toBe(false);
  });

  it('does not flag eslint.config.mjs', () => {
    const ctx = makeContext({
      'eslint.config.mjs': 'export default [{ rules: {} }];',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'eslint.config.mjs')).toBe(false);
  });

  it('does not flag playwright.config.ts', () => {
    const ctx = makeContext({
      'playwright.config.ts': 'export default defineConfig({});',
    });
    expect(analyzeDeadCode(ctx).some(f => f.file === 'playwright.config.ts')).toBe(false);
  });

  it('still flags genuinely orphaned files', () => {
    const ctx = makeContext({
      'src/used.ts': 'import { helper } from "./helper.js";\nexport const x = 1;',
      'src/helper.ts': 'export function helper() {}',
      'src/abandoned-feature.ts': 'export function oldStuff() {}',
    });
    expect(analyzeDeadCode(ctx).some(f => f.rule === 'unused-file' && f.file === 'src/abandoned-feature.ts')).toBe(true);
  });
});
