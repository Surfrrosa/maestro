import { Command } from 'commander';
import chalk from 'chalk';
import { parseSessionLogs, type ParsedSession } from '../utils/sessions.js';
import { header, PASS, FAIL, WARN, divider } from '../utils/format.js';

export interface BugEntry {
  description: string;
  firstSeen: string;
  firstFile: string;
  lastSeen: string;
  sessionCount: number;
  resolved: boolean;
  resolvedDate?: string;
}

function normalizeIssue(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function issueMatchesAccomplishment(issue: string, accomplishment: string): boolean {
  const normIssue = normalizeIssue(issue);
  const normAcc = normalizeIssue(accomplishment);

  // Direct substring match
  if (normAcc.includes(normIssue) || normIssue.includes(normAcc)) return true;

  // Check if the accomplishment mentions fixing/resolving the issue
  const fixPrefixes = ['fix', 'fixed', 'resolve', 'resolved', 'patch', 'patched'];
  for (const prefix of fixPrefixes) {
    if (normAcc.startsWith(prefix)) {
      const rest = normAcc.replace(new RegExp(`^${prefix}\\s*`), '');
      // Check word overlap
      const issueWords = normIssue.split(/\s+/).filter(w => w.length > 3);
      const matchCount = issueWords.filter(w => rest.includes(w)).length;
      if (issueWords.length > 0 && matchCount >= Math.ceil(issueWords.length * 0.5)) {
        return true;
      }
    }
  }

  return false;
}

export function trackBugs(sessions: ParsedSession[]): BugEntry[] {
  const bugs = new Map<string, BugEntry>();

  for (const session of sessions) {
    // Track new issues
    for (const issue of session.knownIssues) {
      const key = normalizeIssue(issue);
      if (!key) continue;

      if (!bugs.has(key)) {
        bugs.set(key, {
          description: issue,
          firstSeen: session.date,
          firstFile: session.file,
          lastSeen: session.date,
          sessionCount: 1,
          resolved: false,
        });
      } else {
        const existing = bugs.get(key)!;
        existing.lastSeen = session.date;
        existing.sessionCount++;
      }
    }

    // Check if any known issues were resolved in this session's accomplishments
    for (const [key, bug] of bugs.entries()) {
      if (bug.resolved) continue;
      for (const acc of session.accomplished) {
        if (issueMatchesAccomplishment(bug.description, acc)) {
          bug.resolved = true;
          bug.resolvedDate = session.date;
          break;
        }
      }
    }
  }

  return Array.from(bugs.values());
}

export const bugsCommand = new Command('bugs')
  .description('Track bugs and issues across session logs')
  .option('--json', 'Output as JSON')
  .option('--open', 'Show only open issues')
  .option('--stale', 'Show only stale issues (3+ sessions unresolved)')
  .action(async (options: { json?: boolean; open?: boolean; stale?: boolean }) => {
    const cwd = process.cwd();
    const sessions = parseSessionLogs(cwd);

    if (sessions.length === 0) {
      console.log(header('maestro bugs'));
      console.log(chalk.dim('  No session logs found. Run maestro session start first.\n'));
      return;
    }

    const allBugs = trackBugs(sessions);

    let openBugs = allBugs.filter(b => !b.resolved);
    let resolvedBugs = allBugs.filter(b => b.resolved);
    const staleBugs = openBugs.filter(b => b.sessionCount >= 3);

    if (options.stale) {
      openBugs = staleBugs;
      resolvedBugs = [];
    } else if (options.open) {
      resolvedBugs = [];
    }

    if (options.json) {
      const output = options.stale ? staleBugs : options.open ? openBugs : allBugs;
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log(header('maestro bugs'));

    if (allBugs.length === 0) {
      console.log(`  ${PASS}  No issues tracked across ${sessions.length} session(s).\n`);
      return;
    }

    if (openBugs.length > 0) {
      console.log(chalk.bold(`  Open Issues (${openBugs.length})\n`));
      for (const bug of openBugs) {
        const isStale = bug.sessionCount >= 3;
        const icon = isStale ? chalk.red('STALE') : chalk.yellow('OPEN ');
        const age = isStale ? chalk.dim(` (first seen: ${bug.firstSeen}, ${bug.sessionCount} sessions ago)`) : chalk.dim(` (first seen: ${bug.firstSeen})`);
        console.log(`  ${icon}  ${bug.description}${age}`);
        console.log(chalk.dim(`         src: docs/sessions/${bug.firstFile}`));
        console.log('');
      }
    }

    if (resolvedBugs.length > 0) {
      console.log(chalk.bold(`  Resolved (${resolvedBugs.length})\n`));
      for (const bug of resolvedBugs) {
        console.log(`  ${PASS}  ${bug.description} ${chalk.dim(`(resolved: ${bug.resolvedDate})`)}`);
      }
      console.log('');
    }

    if (openBugs.length === 0 && !options.stale) {
      console.log(`  ${PASS}  All tracked issues have been resolved.\n`);
    }

    console.log(divider());
    console.log(chalk.dim(`  ${allBugs.length} issue(s) tracked across ${sessions.length} session(s).`));
    if (staleBugs.length > 0) {
      console.log(chalk.red(`  ${staleBugs.length} stale issue(s) need attention.\n`));
    } else {
      console.log('');
    }
  });
