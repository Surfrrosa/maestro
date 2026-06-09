import chalk from 'chalk';

// ── Maestro Color Palette ────────────────────────────────
const ACCENT = '#9580FF';
const PASS_C = '#A3BE8C';
const FAIL_C = '#BF616A';
const WARN_C = '#EBCB8B';
const INFO_C = '#81A1C1';
const DIM_C = '#4C566A';
const SCORE_A = '#A3BE8C';
const SCORE_B = '#88C0D0';
const SCORE_C = '#EBCB8B';
const SCORE_D = '#D08770';
const SCORE_F = '#BF616A';

export const palette = { ACCENT, PASS_C, FAIL_C, WARN_C, INFO_C, DIM_C, SCORE_A, SCORE_B, SCORE_C, SCORE_D, SCORE_F };

// ── Symbols ──────────────────────────────────────────────
export const SYM = {
  pass: chalk.hex(PASS_C)('\u2713'),
  fail: chalk.hex(FAIL_C)('\u2717'),
  warn: chalk.hex(WARN_C)('\u25B3'),
  info: chalk.hex(INFO_C)('\u2022'),
  arrow: chalk.hex(ACCENT)('\u203A'),
  plus: chalk.hex(PASS_C)('+'),
  dot: chalk.hex(DIM_C)('\u00B7'),
  baton: chalk.hex(ACCENT)('~'),
};

// Backward-compatible status labels
export const PASS = SYM.pass;
export const FAIL = SYM.fail;
export const WARN = SYM.warn;

// ── Banner & Headers ─────────────────────────────────────
export function banner(version?: string): string {
  const art = [
    '  ██   ██   █████   ██████  ██████  ██████  █████    █████',
    '  ███ ███  ██   ██  ██      ██        ██    ██  ██  ██   ██',
    '  ██ █ ██  ███████  ████    ██████    ██    █████   ██   ██',
    '  ██   ██  ██   ██  ██          ██    ██    ██ ██   ██   ██',
    '  ██   ██  ██   ██  ██████  ██████    ██    ██  ██   █████',
  ].map(line => chalk.hex(ACCENT)(line)).join('\n');
  const ver = version ? `\n${chalk.dim(`     v${version}`)}` : '';
  return `\n${art}${ver}\n`;
}

export function commandHeader(command: string): string {
  return `\n  ${SYM.baton} ${chalk.bold.white('maestro')} ${chalk.dim(command)}\n`;
}

export function header(text: string): string {
  const match = text.match(/^maestro\s+(.+)$/i);
  if (match) return commandHeader(match[1]);
  return `\n  ${SYM.baton} ${chalk.bold.white(text)}\n`;
}

// ── Sections ─────────────────────────────────────────────
export function section(title: string): string {
  return `\n  ${chalk.hex(ACCENT)('\u2022')} ${chalk.bold.white(title)}\n`;
}

export function divider(): string {
  return chalk.hex(DIM_C)('  ' + '\u2500'.repeat(44));
}

// ── Scores ───────────────────────────────────────────────
export function scoreBar(value: number, total: number = 100): string {
  const pct = Math.round((value / total) * 100);
  const barWidth = 20;
  const filled = Math.round((pct / 100) * barWidth);
  const empty = barWidth - filled;
  const color = pct >= 80 ? chalk.hex(PASS_C) : pct >= 50 ? chalk.hex(WARN_C) : chalk.hex(FAIL_C);
  const filledStr = color('\u2588'.repeat(filled));
  const emptyStr = chalk.hex(DIM_C)('\u2500'.repeat(empty));
  return `  Score  ${color.bold(`${value}/${total}`)}  ${chalk.hex(DIM_C)('[')}${filledStr}${emptyStr}${chalk.hex(DIM_C)(']')}`;
}

export function gradeDisplay(grade: string, numericScore: number): string {
  const colors: Record<string, string> = { A: SCORE_A, B: SCORE_B, C: SCORE_C, D: SCORE_D, F: SCORE_F };
  const color = chalk.hex(colors[grade] || '#ECEFF4');
  return `  Grade  ${color.bold(grade)}  ${chalk.dim(`(${numericScore}/100)`)}`;
}

export function score(value: number, total: number): string {
  const pct = Math.round((value / total) * 100);
  const color = pct >= 80 ? chalk.hex(PASS_C) : pct >= 50 ? chalk.hex(WARN_C) : chalk.hex(FAIL_C);
  return color.bold(`${value}/${total}`);
}

export function scoreColor(value: number): typeof chalk {
  return value >= 80 ? chalk.hex(PASS_C) : value >= 50 ? chalk.hex(WARN_C) : chalk.hex(FAIL_C);
}

export function formatLocation(file: string, line?: number): string {
  return line ? `${file}:${line}` : file;
}

// ── Text Helpers ─────────────────────────────────────────
export function error(text: string): string {
  return chalk.hex(FAIL_C)(`  ${text}`);
}

export function info(text: string): string {
  return chalk.dim(`  ${text}`);
}

// ── Completion States ────────────────────────────────────
export function successBanner(text: string): string {
  return `\n  ${SYM.baton} ${chalk.hex(PASS_C).bold(text)}`;
}

export function failBanner(text: string): string {
  return `\n  ${chalk.hex(FAIL_C)('!')} ${chalk.hex(FAIL_C).bold(text)}`;
}

export function hint(text: string): string {
  return chalk.dim(`\n  ${chalk.hex(ACCENT)('\u203A')} Next: ${text}\n`);
}
