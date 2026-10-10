import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const doc=fs.readFileSync(new URL('../README.md',import.meta.url),'utf8');
test('readme pins its Action and keeps artifacts private by default',()=>{assert.match(doc,/forgeframe-contract-guard@[a-f0-9]{40}/);assert.match(doc,/upload-evidence: 'false'/);});
