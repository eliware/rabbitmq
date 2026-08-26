import { readFile } from 'node:fs/promises';

const summary = JSON.parse(await readFile('coverage/coverage-summary.json', 'utf8'));
const failures = Object.entries(summary.total)
  .filter(([metric]) => ['statements', 'branches', 'functions', 'lines'].includes(metric))
  .filter(([, value]) => value.pct !== 100);

if (failures.length) {
  for (const [metric, value] of failures) console.error(`${metric}: ${value.pct}%`);
  process.exitCode = 1;
}
