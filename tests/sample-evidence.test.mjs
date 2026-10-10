import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
// Git on Windows may check out fixtures as CRLF. Published evidence was generated from canonical LF spec bytes.
const canonicalFixtureDigest=name=>digest(Buffer.from(fs.readFileSync(path.join(root,'fixtures',name),'utf8').replace(/\r\n/g,'\n')));

test('published sample evidence can be independently rehashed and demonstrates pass and block',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  for(const [kind,expected,blocks,head] of [['safe','passed',0,'safe.yaml'],['breaking','blocked',2,'breaking.yaml']]){
    const r=JSON.parse(fs.readFileSync(path.join(root,'examples',kind,'report.json'),'utf8'));
    assert.equal(r.generator.version,pkg.version);
    assert.equal(r.generator.engineVersion.trim(),'oasdiff version 1.33.0');
    assert.equal(r.status,expected);
    assert.equal(r.blockingCount,blocks);
    assert.equal(r.inputs.base.sha256,canonicalFixtureDigest('base.yaml'));
    assert.equal(r.inputs.head.sha256,canonicalFixtureDigest(head));
    assert.equal(r.policy.sha256,digest(Buffer.from('{}')));
    assert.ok(r.findings.every(f=>f.severity==='ERR'||kind==='safe'));
    assert.ok(fs.readFileSync(path.join(root,'examples',kind,'summary.md'),'utf8').length>120);
  }
});
