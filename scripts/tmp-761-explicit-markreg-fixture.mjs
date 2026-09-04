import fs from 'node:fs';

for (const path of [
  'apps/gateway/tests/vertical-slice.test.ts',
  'apps/gateway/tests/governed-read-routes.test.ts'
]) {
  let source = fs.readFileSync(path, 'utf8');
  const before = source;
  source = source.replace(/createMarkReg\(\{\n(\s*)(?!milestoneTestRuntime: true,)/g, (_match, indent) =>
    `createMarkReg({\n${indent}milestoneTestRuntime: true,\n${indent}`
  );
  if (source === before) throw new Error(`no createMarkReg fixture runtime anchor changed in ${path}`);
  fs.writeFileSync(path, source);
}

console.log('TASK 761 explicit MarkReg fixture runtime patch applied');
