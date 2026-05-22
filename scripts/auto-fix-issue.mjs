import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
const issueNumber = process.argv[2];

if (!token) throw new Error('GITHUB_TOKEN is required');
if (!repo) throw new Error('GITHUB_REPOSITORY is required');
if (!issueNumber) throw new Error('Issue number is required');

const apiBase = `https://api.github.com/repos/${repo}`;
const repoRoot = process.cwd();

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

function parseMeta(body) {
  const meta = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^<!--\s*epocha-scan-([a-z-]+):\s*(.*?)\s*-->$/);
    if (match) meta[match[1]] = match[2];
  }
  return meta;
}

function replaceEmptyCatch(content) {
  return content.replace(/catch\s*\{\s*\}/g, 'catch { /* ignore */ }');
}

function parseEvidence(body) {
  return body
    .split('\n')
    .map(line => line.match(/^- (.+?):(\d+) — `(.+)`$/))
    .filter(Boolean)
    .map(match => ({
      file: match[1],
      line: Number(match[2]),
      excerpt: match[3],
    }));
}

function buildPrompt(issue, meta, evidence) {
  const files = [...new Set(evidence.map(item => item.file))];
  const evidenceBlock = evidence.map(item => `- ${item.file}:${item.line} — ${item.excerpt}`).join('\n');
  return `You are an autonomous SWE agent. Make the smallest safe fix for this issue.

Issue title: ${issue.title}
Rule: ${meta.rule ?? 'unknown'}

You may only edit these files:
${files.map(file => `- ${file}`).join('\n') || '- none'}

Evidence:
${evidenceBlock || '- none'}

Constraints:
- Return a unified diff only.
- Change as little as possible.
- Do not add dependencies.
- Do not modify security-sensitive code.
- If no safe fix exists, return an empty response.`;
}

async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic request failed: ${res.status} ${res.statusText}\n${text}`);
  }

  const data = await res.json();
  return data.content?.[0]?.type === 'text' ? data.content[0].text ?? '' : '';
}

async function applyPatch(patch) {
  if (!patch.trim()) return false;
  const result = execFileSync('git', ['apply', '--whitespace=nowarn', '-'], {
    cwd: repoRoot,
    encoding: 'utf8',
    input: patch,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return true;
}

async function writeFileIfChanged(file, nextContent) {
  const abs = path.join(repoRoot, file);
  const prev = await fs.readFile(abs, 'utf8');
  if (prev === nextContent) return false;
  await fs.writeFile(abs, nextContent);
  return true;
}

async function appendComment(issueNumber, message) {
  await gh('POST', `/issues/${issueNumber}/comments`, { body: message });
}

async function main() {
  const issue = await gh('GET', `/issues/${issueNumber}`);
  const labels = (issue.labels ?? []).map(label => label.name);
  const body = String(issue.body ?? '');
  const meta = parseMeta(body);

  if (labels.includes('security') || labels.includes('auth') || labels.includes('needs-human')) {
    await appendComment(issueNumber, 'Skipping auto-fix: this issue is labeled security/auth-sensitive and needs human review.');
    console.log('Skipped security-sensitive issue');
    return;
  }

  const files = meta.file ? [meta.file] : [];
  let changed = false;

  for (const file of files) {
    const abs = path.join(repoRoot, file);
    const current = await fs.readFile(abs, 'utf8');
    let next = current;

    if (meta.rule === 'empty-catch') {
      next = replaceEmptyCatch(next);
    }

    if (next !== current) {
      await writeFileIfChanged(file, next);
      changed = true;
    }
  }

  if (!changed && files.length) {
    const evidence = parseEvidence(body).filter(item => files.includes(item.file));
    const prompt = buildPrompt(issue, meta, evidence);
    const patch = await callAnthropic(prompt);
    if (patch.trim()) {
      try {
        changed = await applyPatch(patch);
      } catch (error) {
        await appendComment(issueNumber, `Auto-fix agent could not safely apply a patch: ${error.message}`);
      }
    }
  }

  if (!changed) {
    await appendComment(issueNumber, 'Auto-fix review completed, but no safe code change was possible from the current scan metadata.');
    console.log('No changes made');
    return;
  }

  const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8', cwd: repoRoot }).trim();
  console.log(status || 'clean');
}

await main();
