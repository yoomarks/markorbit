import fs from 'node:fs';
import prettier from 'prettier';

const options = {
  parser: 'typescript',
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};

for (const path of [
  'services/mgsn/src/outcome-trust-evidence-current-authority.ts',
  'services/mgsn/tests/outcome-trust-evidence-current-authority.test.ts'
]) {
  const source = fs.readFileSync(path, 'utf8');
  const formatted = await prettier.format(source, options);
  console.log(`MGSN717_PRETTIER_BEGIN:${path}`);
  console.log(formatted);
  console.log(`MGSN717_PRETTIER_END:${path}`);
}

throw new Error('MGSN717_PRETTIER_PROBE_COMPLETE');

export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};
