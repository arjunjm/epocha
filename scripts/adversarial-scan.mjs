import crypto from 'crypto';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;

if (!token) throw new Error('GITHUB_TOKEN is required');
if (!repo) throw new Error('GITHUB_REPOSITORY is required');

const apiBase = `https://api.github.com/repos/${repo}`;
const repoRoot = process.cwd();
const interestingExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.md', '.yml', '.yaml']);
const autoFixWorkflow = 'auto-fix-issues.yml';
const humanReviewLabels = new Set(['security', 'auth', 'needs-human']);

const rules = [
  {
    id: 'empty-catch',
    title: 'Empty catch blocks',
    severity: 'low',
    labels: ['triage', 'auto-fix-candidate'],
    matcher: /catch\s*\{\s*\}/g,
    summary: 'An empty catch block swallows a failure without any signal.',
    recommendation: 'Replace the empty catch with the project’s standard ignored-error form or an explicit comment.',
  },
  {
    id: 'dangerous-dom-sink',
    title: 'Potentially dangerous DOM sink',
    severity: 'high',
    labels: ['triage', 'security'],
    matcher: /\bdangerouslySetInnerHTML\b|\binnerHTML\s*=|\beval\s*\(|\bnew Function\s*\(/g,
    summary: 'A DOM sink or dynamic code execution pattern can expose the app to injection bugs.',
    recommendation: 'Avoid raw HTML insertion or runtime code generation unless there is a very strong justification.',
  },
];

const ignoredPrefixes = [
  'node_modules/',
  'dist/',
  'coverage/',
  '.git/',
];

function sha(value) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
}

function currentRef() {
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  return (process.env.GITHUB_REF ?? '')
    .replace(/^refs\/heads\//, '')
    .replace(/^refs\/tags\//, '') || 'master';
}

function shouldDispatchAutoFix(finding) {
  const labels = finding.rule.labels;
  return labels.includes('auto-fix-candidate') && !labels.some(label => humanReviewLabels.has(label));
}

function isTextFile(file) {
  return interestingExts.has(path.extname(file));
}

function isIgnored(file) {
  return ignoredPrefixes.some(prefix => file.startsWith(prefix));
}

async function getTrackedFiles() {
  const output = execFileSync('git', ['ls-files'], { encoding: 'utf8', cwd: repoRoot });
  return output
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .filter(file => !isIgnored(file))
    .filter(isTextFile);
}

async function scanFile(file) {
  const abs = path.join(repoRoot, file);
  const content = await fs.readFile(abs, 'utf8');
  const lines = content.split('\n');
  const findings = [];

  for (const rule of rules) {
    const matches = [];
    lines.forEach((line, index) => {
      if (rule.matcher.test(line)) {
        matches.push({ line: index + 1, excerpt: line.trim() });
      }
      rule.matcher.lastIndex = 0;
    });

    if (matches.length) findings.push({ rule, file, matches });
  }

  return findings;
}

function formatBody(finding, fingerprint) {
  const lines = finding.matches
    .map(match => `- ${finding.file}:${match.line} — \`${match.excerpt}\``)
    .join('\n');

  return `<!-- epocha-scan-fingerprint: ${fingerprint} -->
<!-- epocha-scan-rule: ${finding.rule.id} -->
<!-- epocha-scan-file: ${finding.file} -->

## Why this was flagged

${finding.rule.summary}

## Evidence

${lines}

## Suggested follow-up

${finding.rule.recommendation}
`;
}

async function gh(method, route, body) {
  const res = await fetch(`${apiBase}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${route} failed: ${res.status} ${res.statusText}\n${text}`);
  }

  return res.status === 204 ? null : res.json();
}

async function ensureLabels() {
  const desired = [
    { name: 'triage', color: 'd4c5f9', description: 'Needs triage from the automated scan' },
    { name: 'auto-fix-candidate', color: 'a2eeef', description: 'Safe enough for an automated code fix' },
    { name: 'security', color: 'b60205', description: 'Security-sensitive issue' },
    { name: 'needs-human', color: 'fbca04', description: 'Must be handled by a human reviewer' },
    { name: 'auth', color: 'd93f0b', description: 'Authentication or authorization sensitive' },
  ];
  const existing = await gh('GET', '/labels?per_page=100');
  const existingNames = new Set(existing.map(label => label.name));
  for (const label of desired) {
    if (!existingNames.has(label.name)) {
      await gh('POST', '/labels', label);
    }
  }
}

async function upsertIssue(finding) {
  const fingerprint = sha(
    `${finding.rule.id}|${finding.file}|${finding.matches.map(m => `${m.line}:${m.excerpt}`).join('|')}`
  );
  const title = `${finding.rule.severity === 'high' ? 'Security' : 'QA'}: ${finding.rule.title} in ${finding.file}`;
  const body = formatBody(finding, fingerprint);

  const labels = finding.rule.labels;
  const labelQuery = encodeURIComponent(labels.join(','));
  const issues = await gh('GET', `/issues?state=open&per_page=100&labels=${labelQuery}`);
  const existing = issues.find(issue => typeof issue.body === 'string' && issue.body.includes(`epocha-scan-fingerprint: ${fingerprint}`));

  if (existing) {
    await gh('PATCH', `/issues/${existing.number}`, { title, body, labels });
    return { action: 'updated', number: existing.number, title };
  }

  const issue = await gh('POST', '/issues', { title, body, labels });
  return { action: 'created', number: issue.number, title };
}

async function dispatchAutoFix(issueNumber) {
  await gh('POST', `/actions/workflows/${autoFixWorkflow}/dispatches`, {
    ref: currentRef(),
    inputs: { issue_number: String(issueNumber) },
  });
}

async function hasOpenAutoFixPullRequest(issueNumber) {
  const [owner] = repo.split('/');
  const head = encodeURIComponent(`${owner}:auto-fix/issue-${issueNumber}`);
  const pulls = await gh('GET', `/pulls?state=open&head=${head}`);
  return pulls.length > 0;
}

async function main() {
  await ensureLabels();
  const files = await getTrackedFiles();
  const findings = [];

  for (const file of files) {
    findings.push(...await scanFile(file));
  }

  if (!findings.length) {
    console.log('No issues found');
    return;
  }

  const fingerprints = new Set();
  const results = [];
  for (const finding of findings) {
    const fingerprint = sha(
      `${finding.rule.id}|${finding.file}|${finding.matches.map(m => `${m.line}:${m.excerpt}`).join('|')}`
    );
    fingerprints.add(fingerprint);
    const result = await upsertIssue(finding);
    if (shouldDispatchAutoFix(finding)) {
      if (await hasOpenAutoFixPullRequest(result.number)) {
        result.autoFix = 'open-pr-exists';
      } else {
        await dispatchAutoFix(result.number);
        result.autoFix = 'dispatched';
      }
    }
    results.push(result);
  }

  const triageIssues = await gh('GET', '/issues?state=open&per_page=100&labels=triage');
  for (const issue of triageIssues) {
    const body = String(issue.body ?? '');
    const match = body.match(/epocha-scan-fingerprint:\s*([a-f0-9]{12})/);
    if (match && !fingerprints.has(match[1])) {
      await gh('PATCH', `/issues/${issue.number}`, { state: 'closed' });
      results.push({ action: 'closed', number: issue.number, title: issue.title });
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

await main();
