'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['js', 'test', 'scripts'];

function collect(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(p, out);
    else if (entry.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = [];
for (const d of DIRS) collect(path.join(ROOT, d), files);
files.sort();

let bad = 0;
for (const f of files) {
  const rel = path.relative(ROOT, f);
  try {
    new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f });
    console.log('ok   ' + rel);
  } catch (e) {
    bad++;
    console.error('FAIL ' + rel + '\n     ' + e.message);
  }
}

console.log('\n' + (files.length - bad) + '/' + files.length + ' fichiers valides');
process.exit(bad ? 1 : 0);
