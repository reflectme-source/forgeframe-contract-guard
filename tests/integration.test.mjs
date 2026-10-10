import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const project = path.resolve(import.meta.dirname, '..');
const cli = path.join(project, 'cli.mjs');
const base = path.join(project, 'fixtures', 'base.yaml');
const breaking = path.join(project, 'fixtures', 'breaking.yaml');
const safe = path.join(project, 'fixtures', 'safe.yaml');
const engine = process.env.OASDIFF_BIN || (process.platform === 'win32' ?
  path.join(project, 'vendor', 'oasdiff.exe') : 'oasdiff');

function run(argv, env) {
  return spawnSync(process.execPath, [cli, ...argv], {
    cwd: project, encoding: 'utf8', timeout: 20000, env: { ...process.env, OASDIFF_BIN: engine, ...env }
  });
}
function temporary() { return fs.mkdtempSync(path.join(os.tmpdir(), 'contract-guard-')); }
function inspect(args, expected) {
  const out = temporary();
  const result = run([...args, '--out', out]);
  assert.equal(result.status, expected, 'Unexpected CLI exit: ' + result.stderr + '\n' + result.stdout);
  const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  assert.ok(fs.readFileSync(path.join(out, 'summary.md'), 'utf8').includes('ForgeFrame Contract Guard'));
  fs.rmSync(out, { recursive: true, force: true });
  return report;
}
test('safe additive change passes and produces correct file digests', () => {
  const report = inspect(['--base', base, '--head', safe], 0);
  assert.equal(report.status, 'passed');
  assert.equal(report.blockingCount, 0);
  assert.equal(report.inputs.base.sha256, crypto.createHash('sha256').update(fs.readFileSync(base)).digest('hex'));
});
test('required parameter and expanded response enum block', () => {
  const report = inspect(['--base', base, '--head', breaking], 1);
  assert.equal(report.status, 'blocked');
  assert.ok(report.findings.some(f => f.id === 'request-parameter-became-required'));
  assert.ok(report.findings.some(f => f.id === 'response-property-enum-value-added'));
  assert.ok(report.findings.every(f => !f.excepted));
});
test('waiver needs exact fingerprint, reason and future expiry', () => {
  const out = temporary();
  const report = inspect(['--base', base, '--head', breaking], 1);
  const policy = path.join(out, 'policy.json');
  const id = report.findings[0].id, fingerprint = report.findings[0].fingerprint;
  fs.writeFileSync(policy, JSON.stringify({ failOn: 'ERR', exceptions: [
    { id, fingerprint, reason: 'Approved migration with client owners', expires: '2099-12-31' }
  ] }));
  const waived = inspect(['--base', base, '--head', breaking, '--policy', policy], 1);
  assert.equal(waived.findings.filter(f => f.excepted).length, 1);
  assert.equal(waived.blockingCount, report.blockingCount - 1);
  fs.rmSync(out, { recursive: true, force: true });
});
test('expired and imprecise exceptions fail closed', () => {
  const dir = temporary(), policy = path.join(dir, 'policy.json');
  fs.writeFileSync(policy, JSON.stringify({ exceptions: [
    { id: 'request-parameter-became-required', fingerprint: 'ab1234567890', reason: 'Temporary exception approved', expires: '2020-01-01' }
  ] }));
  const result = run(['--base', base, '--head', breaking, '--policy', policy]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /expired/i);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('missing baseline and missing engine cannot silently pass', () => {
  assert.equal(run(['--base', 'fixtures/missing.yaml', '--head', safe]).status, 2);
  assert.equal(run(['--base', base, '--head', safe, '--engine', 'definitely-missing-command']).status, 2);
});
test('invalid spec fails closed without creating a success receipt', () => {
  const dir = temporary(), invalid = path.join(dir, 'invalid.yaml');
  fs.writeFileSync(invalid, 'openapi: [not-a-valid-version');
  const result = run(['--base', invalid, '--head', safe, '--out', path.join(dir, 'out')]);
  assert.equal(result.status, 2);
  assert.equal(fs.existsSync(path.join(dir, 'out', 'report.json')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});
test('unknown arguments are rejected rather than silently ignored', () => {
  assert.equal(run(['--base', base, '--head', safe, '--silent']).status, 2);
});
test('threshold rules are explicit', () => {
  const report = inspect(['--base', base, '--head', breaking, '--fail-on', 'WARN'], 1);
  assert.equal(report.policy.failOn, 'WARN');
  assert.equal(report.blockingCount, 2);
});

test('real calendar date required; leap-day rollover cannot create bogus waivers', () => {
  const dir=temporary(), policy=path.join(dir,'policy.json');
  fs.writeFileSync(policy, JSON.stringify({ failOn:'ERR', exceptions:[{
    id:'request-parameter-became-required',
    fingerprint:'0123456789ab',
    reason:'Explicitly reviewed compatibility exception',
    expires:'2027-02-30'
  }] }));
  const result=run(['--base', base, '--head', breaking, '--policy', policy]);
  assert.equal(result.status,2);
  assert.match(result.stderr,/real ISO/i);
  fs.rmSync(dir,{recursive:true,force:true});
});
test('untrusted ambient oasdiff configuration cannot silently override rules', () => {
  const dir=temporary(), out=path.join(dir,'out');
  fs.writeFileSync(path.join(dir,'.oasdiff.yaml'),'not: a valid config for compatibility rules\n');
  const result=spawnSync(process.execPath,[cli,'--base',base,'--head',breaking,'--out',out],{
    cwd:dir,encoding:'utf8',timeout:15000,
    env:{...process.env,OASDIFF_CONFIG:path.join(dir,'missing-config.yaml'),OASDIFF_BIN:engine}
  });
  assert.equal(result.status,1,'Expected two blocking findings despite ambient config: '+result.stderr);
  const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
  assert.equal(report.blockingCount,2);
  assert.match(report.generator.engineVersion,/oasdiff version 1\.33\.0/);
  fs.rmSync(dir,{recursive:true,force:true});
});
