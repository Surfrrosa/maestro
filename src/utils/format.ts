import chalk from 'chalk';

export const PASS = chalk.green('PASS');
export const FAIL = chalk.red('FAIL');
export const WARN = chalk.yellow('WARN');

export function header(text: string): string {
  return chalk.bold.white(`\n  ${text}\n`);
}

export function success(text: string): string {
  return chalk.green(`  ${text}`);
}

export function error(text: string): string {
  return chalk.red(`  ${text}`);
}

export function info(text: string): string {
  return chalk.dim(`  ${text}`);
}

export function score(value: number, total: number): string {
  const pct = Math.round((value / total) * 100);
  const color = pct >= 80 ? chalk.green : pct >= 50 ? chalk.yellow : chalk.red;
  return color.bold(`${value}/${total}`);
}

export function divider(): string {
  return chalk.dim('  ' + '-'.repeat(50));
}

export function hint(text: string): string {
  return chalk.dim(`\n  Next: ${text}\n`);
}
