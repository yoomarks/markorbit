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
  'services/mgsn/src/provider-discovery-current-responsibility.ts',
  'services/mgsn/tests/provider-discovery-current-responsibility.test.ts'
]) {
  const source = fs.readFileSync(path, 'utf8');
  const formatted = await prettier.format(source, options);
  console.log(`MGSN707_PRETTIER_BEGIN:${path}`);
  console.log(formatted);
  console.log(`MGSN707_PRETTIER_END:${path}`);
}

throw new Error('MGSN707_PRETTIER_PROBE_COMPLETE');

export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};
