import { describe, it, expect } from 'vitest';
import { analyzeHygiene } from '../src/analyzers/hygiene.js';
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

describe('analyzeHygiene', () => {
  it('detects console.log in source files', () => {
    const ctx = makeContext({
      'src/app.ts': 'console.log("debug");\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.some(f => f.rule === 'debug-statement')).toBe(true);
  });

  it('detects TODO comments', () => {
    const ctx = makeContext({
      'src/app.ts': '// TODO: fix this later\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.some(f => f.rule === 'tech-debt-marker')).toBe(true);
  });

  it('returns clean findings for well-written code', () => {
    const ctx = makeContext({
      'src/app.ts': 'export function greet(name: string) { return `Hello ${name}`; }\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
    expect(findings.filter(f => f.rule === 'tech-debt-marker')).toHaveLength(0);
  });

  it('includes function name in debug statement findings', () => {
    const ctx = makeContext({
      'src/app.ts': `function processData() {
  console.log("debugging");
}
`,
    });
    const findings = analyzeHygiene(ctx);
    const debug = findings.find(f => f.rule === 'debug-statement');
    expect(debug).toBeDefined();
    expect(debug!.message).toContain("in 'processData'");
  });

  it('includes function name in tech-debt marker findings', () => {
    const ctx = makeContext({
      'src/app.ts': `function calculate() {
  // TODO: optimize this
  return 42;
}
`,
    });
    const findings = analyzeHygiene(ctx);
    const debt = findings.find(f => f.rule === 'tech-debt-marker');
    expect(debt).toBeDefined();
    expect(debt!.message).toContain("in 'calculate'");
  });

  it('omits function name for top-level findings', () => {
    const ctx = makeContext({
      'src/app.ts': `// TODO: refactor this module\n`,
    });
    const findings = analyzeHygiene(ctx);
    const debt = findings.find(f => f.rule === 'tech-debt-marker');
    expect(debt).toBeDefined();
    expect(debt!.message).not.toContain("in '");
  });

  it('skips console.log in test files', () => {
    const ctx = makeContext({
      'tests/app.test.ts': 'console.log("test output");\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
  });

  it('skips console.log in CLI command files', () => {
    const ctx = makeContext({
      'src/commands/audit.ts': 'console.log("Score: 100");\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
  });

  it('detects FIXME comments', () => {
    const ctx = makeContext({
      'src/app.ts': '// FIXME: broken login\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.some(f => f.rule === 'tech-debt-marker')).toBe(true);
  });

  it('detects Python print statements', () => {
    const ctx = makeContext({
      'src/app.py': 'print("debug")\n',
    }, 'python');
    const findings = analyzeHygiene(ctx);
    expect(findings.some(f => f.rule === 'debug-statement')).toBe(true);
  });

  it('ignores console.log inside double-quoted string literals', () => {
    const ctx = makeContext({
      'src/app.ts': 'const example = "console.log(foo)";\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
  });

  it('ignores console.log inside template literals', () => {
    const ctx = makeContext({
      'src/tpl.ts': 'const t = `<script>console.log("x")</script>`;\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
  });

  it('ignores // TODO inside string literals', () => {
    const ctx = makeContext({
      'src/tpl.ts': 'const help = "run // TODO before commit";\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'tech-debt-marker')).toHaveLength(0);
  });

  it('ignores magic numbers inside string literals', () => {
    const ctx = makeContext({
      'src/msgs.ts': 'const label = "Timeout after 30000 seconds";\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'magic-number')).toHaveLength(0);
  });

  it('preserves detection of real console.log outside strings on a mixed line', () => {
    const ctx = makeContext({
      'src/app.ts': 'const msg = "console.log(x)"; console.log("real");\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(1);
  });

  it('preserves multi-line template literal masking across lines', () => {
    const ctx = makeContext({
      'src/tpl.ts': 'const html = `\nconsole.log("inside template");\n`;\n',
    });
    const findings = analyzeHygiene(ctx);
    expect(findings.filter(f => f.rule === 'debug-statement')).toHaveLength(0);
  });
});
