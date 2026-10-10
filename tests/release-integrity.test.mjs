import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('release metadata matches the self-hosted GitHub Action distribution',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.version,'0.1.4');
  assert.equal(pkg.license,'MIT');
  assert.equal(pkg.private,true);
  assert.doesNotMatch(JSON.stringify(pkg),/"main":"index\.js"/);
});

test('opt-in evidence upload uses immutable reviewed commit, not mutable v4 tag',()=>{
  const action=read('action.yml');
  assert.match(action,/uses: actions\/upload-artifact@[a-f0-9]{40}\s*#/);
  assert.doesNotMatch(action,/uses: actions\/upload-artifact@v\d/);
  assert.match(action,/upload-evidence:[\s\S]*?default: 'false'/);
});

test('commercial documentation has one-repository scope and no false subscription claims',()=>{
  const docs=read('README.md');
  assert.match(docs,/\$149 one-time/);
  assert.match(docs,/one GitHub repository with an existing OpenAPI 3\.x specification/i);
  assert.match(docs,/unique Stripe-hosted payment link for that order/);
  assert.doesNotMatch(docs,/buy\.stripe\.com\/fZu8wR6FX4q962E81z73G00/);
  assert.match(docs,/scope and delivery schedule before paying/i);
  assert.doesNotMatch(docs,/up to two repositories|per organization \(one-time\)|no online checkout/i);
});

test('CI proves expected failure for actual breaking changes',()=>{
  const flow=read('.github/workflows/ci.yml');
  assert.match(flow,/id: breaking/);
  assert.match(flow,/continue-on-error: true/);
  assert.match(flow,/test "\$BREAKING_OUTCOME" = 'failure'/);
  assert.match(flow,/r\.blockingCount!==2/);
});

test('the CLI reads generator version from package metadata at runtime',()=>{
  const cli=read('cli.mjs');
  assert.match(cli,/const VERSION = JSON\.parse\(fs\.readFileSync/);
});
