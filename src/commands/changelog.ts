import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'node:child_process';
import { parseSessionLogs } from '../utils/sessions.js';
import { writeFile } from '../utils/fs.js';
import { header, divider } from '../utils/format.js';

interface ChangelogEntry {
  text: string;
  source: 'session' | 'git';
  date: string;
  category: 'features' | 'fixes' | 'breaking' | 'internal';
}

function categorize(text: string): ChangelogEntry['category'] {
  const lower = text.toLowerCase();
  const firstWord = lower.replace(/^[-*]\s*/, '').split(/\s+/)[0];

  if (['add', 'added', 'implement', 'implemented', 'create', 'created', 'introduce', 'introduced', 'build', 'built', 'new'].includes(firstWord)) {
    return 'features';
  }
  if (['fix', 'fixed', 'resolve', 'resolved', 'patch', 'patched', 'repair', 'repaired', 'correct', 'corrected'].includes(firstWord)) {
    return 'fixes';
  }
  if (['break', 'breaking', 'remove', 'removed', 'deprecate', 'deprecated', 'drop', 'dropped'].includes(firstWord)) {
    return 'breaking';
  }
  return 'internal';
}

function getGitLog(cwd: string, since?: string): Array<{ message: string; date: string }> {
  try {
    const sinceArg = since ? `--since="${since}"` : '--max-count=50';
    const output = execSync(`git log ${sinceArg} --format="%s|||%as"`, {
      cwd,
      encoding: 'utf-8',
      timeout: 10000,
    }).trim();
    if (!output) return [];
    return output.split('\n')
      .filter(l => l.trim())
      .map(l => {
        const [message, date] = l.split('|||');
        return { message: message.trim(), date: date?.trim() || '' };
      })
      .filter(e => e.message && !e.message.startsWith('Merge'));
  } catch {
    return [];
  }
}

function dedup(entries: ChangelogEntry[]): ChangelogEntry[] {
  const seen = new Set<string>();
  const result: ChangelogEntry[] = [];

  for (const entry of entries) {
    const key = entry.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    // Simple dedup: skip if we've seen something very similar
    const words = key.split(/\s+/).filter(w => w.length > 3);
    const isDupe = [...seen].some(existing => {
      const existingWords = existing.split(/\s+/).filter(w => w.length > 3);
      const overlap = words.filter(w => existingWords.includes(w)).length;
      return overlap >= Math.min(words.length, existingWords.length) * 0.7;
    });

    if (!isDupe && key.length > 0) {
      seen.add(key);
      result.push(entry);
    }
  }

  return result;
}

export function generateChangelog(cwd: string, since?: string): { entries: ChangelogEntry[]; sessionCount: number; commitCount: number } {
  const sessions = parseSessionLogs(cwd);
  const filteredSessions = since
    ? sessions.filter(s => s.date >= since)
    : sessions;

  const entries: ChangelogEntry[] = [];

  // Gather from session logs (higher quality, prefer these)
  for (const session of filteredSessions) {
    for (const item of session.accomplished) {
      entries.push({
        text: item,
        source: 'session',
        date: session.date,
        category: categorize(item),
      });
    }
  }

  // Gather from git log
  const gitEntries = getGitLog(cwd, since);
  for (const entry of gitEntries) {
    entries.push({
      text: entry.message,
      source: 'git',
      date: entry.date,
      category: categorize(entry.message),
    });
  }

  return {
    entries: dedup(entries),
    sessionCount: filteredSessions.length,
    commitCount: gitEntries.length,
  };
}

function formatChangelog(entries: ChangelogEntry[], since?: string, until?: string): string {
  const dateRange = since
    ? `${since} to ${until || new Date().toISOString().split('T')[0]}`
    : 'Recent';

  const lines: string[] = [`# Changelog (${dateRange})`, ''];

  const categories: Array<{ key: ChangelogEntry['category']; label: string }> = [
    { key: 'breaking', label: 'Breaking Changes' },
    { key: 'features', label: 'Features' },
    { key: 'fixes', label: 'Fixes' },
    { key: 'internal', label: 'Internal' },
  ];

  for (const { key, label } of categories) {
    const items = entries.filter(e => e.category === key);
    if (items.length === 0) continue;

    lines.push(`## ${label}`, '');
    for (const item of items) {
      lines.push(`- ${item.text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const changelogCommand = new Command('changelog')
  .description('Generate changelog from session logs and git history')
  .option('--since <date>', 'Start date (YYYY-MM-DD)')
  .option('--json', 'Output as JSON')
  .option('--output <file>', 'Write changelog to file')
  .action(async (options: { since?: string; json?: boolean; output?: string }) => {
    const cwd = process.cwd();
    const { entries, sessionCount, commitCount } = generateChangelog(cwd, options.since);

    if (options.json) {
      console.log(JSON.stringify({ entries, sessionCount, commitCount }, null, 2));
      return;
    }

    if (entries.length === 0) {
      console.log(header('maestro changelog'));
      console.log(chalk.dim('  No changes found. Check --since date or add session logs.\n'));
      return;
    }

    const markdown = formatChangelog(entries, options.since);

    if (options.output) {
      writeFile(options.output, markdown);
      console.log(header('maestro changelog'));
      console.log(chalk.green(`  Changelog written to ${options.output}`));
      console.log(chalk.dim(`  Sources: ${sessionCount} session log(s), ${commitCount} commit(s)\n`));
      return;
    }

    console.log(header('maestro changelog'));
    console.log('');
    // Print the markdown content indented
    for (const line of markdown.split('\n')) {
      console.log(`  ${line}`);
    }
    console.log(divider());
    console.log(chalk.dim(`  Sources: ${sessionCount} session log(s), ${commitCount} commit(s)\n`));
  });
