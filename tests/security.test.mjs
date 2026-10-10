import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

test('external URL references are blocked instead of fetched', () => {
  const project=path.resolve(import.meta.dirname, '..');
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'contract-ref-'));
  const doc=path.join(work,'remote.yaml');
  fs.writeFileSync(doc, [
    'openapi: 3.1.0',
    'info: {title: Unsafe Example, version: 1.0.0}',
    'paths:',
    '  /unsafe:',
    '    get:',
    '      responses:',
    "        '200':",
    '          description: Remote reference',
    '          content:',
    '            application/json:',
    '              schema:',
    "                $ref: 'http://127.0.0.1:9/sensitive.yaml#/Foo'",
    ''
  ].join('\n'));
  const result=spawnSync(process.execPath,[path.join(project,'cli.mjs'),
    '--base',doc,'--head',doc,'--out',path.join(work,'report')],{
      encoding:'utf8',timeout:20000,cwd:project,
      env:{...process.env,OASDIFF_BIN:process.env.OASDIFF_BIN||
        (process.platform==='win32'?path.join(project,'vendor','oasdiff.exe'):'oasdiff')}
    });
  assert.equal(result.status,2,'Expected blocked external reference: '+result.stdout+' '+result.stderr);
  assert.equal(fs.existsSync(path.join(work,'report','report.json')),false);
  fs.rmSync(work,{recursive:true,force:true});
});
