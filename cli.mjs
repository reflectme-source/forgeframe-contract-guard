#!/usr/bin/env node
/**
 * ForgeFrame Contract Guard â€” deterministic, local OpenAPI release evidence.
 * The OpenAPI compatibility engine is oasdiff (Apache-2.0), separately licensed.
 * No network calls or specification uploads are performed by this wrapper.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const VERSION = '0.1.0';
const MAX_INPUT = 5 * 1024 * 1024;
const MAX_OUTPUT = 16 * 1024 * 1024;
const LEVEL = Object.freeze({ INFO: 1, WARN: 2, ERR: 3 });
const MAX_FINDINGS = 2500;

function die(message, code = 2) {
  console.error('Contract Guard: ' + String(message).replace(/[\r\n]+/g, ' '));
  process.exit(code);
}

function argsToMap(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    if (item === '--help' || item === '-h') return { help: true };
    if (item === '--version') return { version: true };
    if (!/^--(base|head|out|policy|fail-on|engine)$/.test(item)) die('Unknown argument: ' + item);
    if (item in args) die('Duplicate argument: ' + item);
    if (!argv[i + 1] || argv[i + 1].startsWith('--')) die('Missing value for ' + item);
    args[item.slice(2)] = argv[++i];
  }
  return args;
}

function readFileChecked(file, label) {
  if (!file) die('Missing required ' + label);
  const real = fs.realpathSync(path.resolve(file));
  const stats = fs.statSync(real);
  if (!stats.isFile() || stats.size > MAX_INPUT) die(label + ' must be an ordinary file under 5 MiB');
  return { file: real, bytes: fs.readFileSync(real) };
}

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const short = hash => hash.slice(0, 16);

function readPolicy(policyName) {
  if (!policyName) return { policy: { failOn: 'ERR', exceptions: [] }, bytes: Buffer.from('{}') };
  const { bytes } = readFileChecked(policyName, 'policy');
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { die('Invalid JSON policy'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) die('Policy must be a JSON object');
  for (const field of Object.keys(data)) if (!['failOn', 'exceptions'].includes(field)) die('Unknown policy field: ' + field);
  const failOn = data.failOn ?? 'ERR';
  if (!(failOn in LEVEL)) die('failOn must be ERR, WARN, or INFO');
  const exceptions = data.exceptions ?? [];
  if (!Array.isArray(exceptions) || exceptions.length > 100) die('exceptions must be an array (max 100)');
  for (const [index, exception] of exceptions.entries()) {
    if (!exception || typeof exception !== 'object' || Array.isArray(exception)) die('Invalid exception #' + index);
    for (const field of Object.keys(exception)) if (!['id', 'fingerprint', 'reason', 'expires'].includes(field)) die('Unknown exception field: ' + field);
    if (!/^[a-z][a-z0-9-]+$/.test(exception.id ?? '')) die('Exception requires exact rule id');
    if (!/^[a-f0-9]{12,64}$/.test(exception.fingerprint ?? '')) die('Exception requires exact fingerprint');
    if (typeof exception.reason !== 'string' || exception.reason.trim().length < 12) die('Exception requires a meaningful reason');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exception.expires ?? '') || !Number.isFinite(Date.parse(exception.expires + 'T00:00:00Z'))) die('Exception requires ISO YYYY-MM-DD expiry');
    const today = new Date().toISOString().slice(0,10);
    if (exception.expires < today) die('Exception expired: ' + exception.id + '/' + exception.fingerprint);
  }
  return { policy: { failOn, exceptions }, bytes };
}

function cleanText(text) {
  return String(text ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 700);
}
const markdownCell = text => cleanText(text).replace(/[|<>]/g, x => ({ '|': '\\|', '<': '&lt;', '>': '&gt;' }[x]));

function markdownFor(report) {
  const results = report.findings;
  const active = results.filter(f => !f.excepted);
  const suppressed = results.length - active.length;
  const heading = report.status === 'blocked' ? 'BLOCKED' : 'PASS';
  const lines = [
    '## ForgeFrame Contract Guard â€” ' + heading,
    '',
    '| Metric | Value |',
    '|---|---|',
    '| Blocking findings | ' + report.blockingCount + ' |',
    '| All findings | ' + results.length + ' |',
    '| Exceptions | ' + suppressed + ' |',
    '| Policy threshold | ' + report.policy.failOn + ' |',
    '| Baseline SHA-256 | \`' + short(report.inputs.base.sha256) + 'â€¦\` |',
    '| Revision SHA-256 | \`' + short(report.inputs.head.sha256) + 'â€¦\` |',
    '| Policy SHA-256 | \`' + short(report.policy.sha256) + 'â€¦\` |',
    '',
  ];
  if (results.length) {
    lines.push('| Severity | Check | Endpoint | Detail | Exception |');
    lines.push('|---|---|---|---|---|');
    for (const f of results.slice(0, 75)) {
      lines.push('| ' + f.severity + ' | \`' + markdownCell(f.id) + '\` | ' +
        markdownCell((f.operation ? f.operation + ' ' : '') + (f.path ?? 'â€”')) +
        ' | ' + markdownCell(f.text) + ' | ' + (f.excepted ? 'Approved until ' + f.exceptionExpires : 'â€”') + ' |');
    }
    if (results.length > 75) lines.push('', '_Additional findings are available in report.json._');
  } else {
    lines.push('No changes meeting the engineâ€™s breaking-change checks were detected.');
  }
  lines.push('', '_Evidence is scoped to specification-level checks. It does not prove runtime compatibility or regulatory compliance._', '');
  return lines.join('\n');
}

function run() {
  const args = argsToMap(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node cli.mjs --base old.yaml --head new.yaml [--policy guard.policy.json] [--out evidence] [--engine path] [--fail-on ERR|WARN|INFO]');
    process.exit(0);
  }
  if (args.version) { console.log(VERSION); process.exit(0); }
  const base = readFileChecked(args.base, '--base');
  const head = readFileChecked(args.head, '--head');
  const { policy, bytes: policyBytes } = readPolicy(args.policy);
  if (args['fail-on']) {
    if (!(args['fail-on'] in LEVEL)) die('Invalid --fail-on');
    policy.failOn = args['fail-on'];
  }
  const engine = args.engine || process.env.OASDIFF_BIN ||
    (process.platform === 'win32' ? path.join(import.meta.dirname, 'vendor', 'oasdiff.exe') : 'oasdiff');
  const env = { ...process.env, NO_COLOR: '1' };
  const cmd = spawnSync(engine, ['breaking', '--allow-external-refs=false', '--format', 'json', base.file, head.file],
    { env, encoding: 'utf8', timeout: 45000, maxBuffer: MAX_OUTPUT, windowsHide: true });
  if (cmd.error) die('Engine execution failed: ' + cmd.error.message);
  if (cmd.status !== 0) die('Engine returned error: ' + cleanText(cmd.stderr || cmd.stdout || 'unknown'));
  let findings;
  try { findings = JSON.parse(cmd.stdout); } catch { die('Engine returned invalid JSON'); }
  if (!Array.isArray(findings) || findings.length > MAX_FINDINGS) die('Unexpected engine result');
  for (const f of findings) {
    if (!f || typeof f.id !== 'string' || typeof f.text !== 'string' || !Number.isInteger(f.level) || f.level < 1 || f.level > 3) die('Invalid engine finding');
  }
  const processed = findings.map(f => {
    const match = policy.exceptions.find(w => w.id === f.id && w.fingerprint === f.fingerprint);
    return {
      id: f.id, fingerprint: f.fingerprint ?? null, severity: Object.keys(LEVEL).find(key => LEVEL[key] === f.level),
      operation: f.operation ?? null, path: f.path ?? null, text: f.text,
      source: f.revisionSource ? { line: f.revisionSource.line ?? null, column: f.revisionSource.column ?? null } : null,
      excepted: Boolean(match), exceptionReason: match?.reason ?? null, exceptionExpires: match?.expires ?? null
    };
  });
  const blockingCount = processed.filter(f => !f.excepted && LEVEL[f.severity] >= LEVEL[policy.failOn]).length;
  const evidence = {
    schema: 'urn:forgeframe:contract-guard:evidence:v1',
    generator: { name: 'ForgeFrame Contract Guard', version: VERSION, engine: 'oasdiff' },
    generatedAt: new Date().toISOString(),
    status: blockingCount ? 'blocked' : 'passed',
    blockingCount,
    inputs: {
      base: { name: path.basename(base.file), sha256: sha256(base.bytes) },
      head: { name: path.basename(head.file), sha256: sha256(head.bytes) }
    },
    policy: { failOn: policy.failOn, sha256: sha256(policyBytes), exceptionCount: policy.exceptions.length },
    provenance: { repository: process.env.GITHUB_REPOSITORY ?? null, commit: process.env.GITHUB_SHA ?? null, runId: process.env.GITHUB_RUN_ID ?? null },
    findings: processed
  };
  const markdown = markdownFor(evidence);
  const outDir = path.resolve(args.out || 'evidence');
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(outDir, 'summary.md'), markdown, { mode: 0o600 });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
  console.log(markdown);
  console.log('Evidence: ' + outDir);
  process.exitCode = blockingCount ? 1 : 0;
}
try { run(); } catch (error) { die(error.message); }
