import fs from 'node:fs';
import prettier from 'prettier';

const options = {
  parser: 'typescript',
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};

const paths = [
  'services/mgsn/src/outcome-trust-evidence-current-authority.ts',
  'services/mgsn/tests/outcome-trust-evidence-current-authority.test.ts'
];
const formatted = {};
for (const path of paths) {
  formatted[path] = await prettier.format(fs.readFileSync(path, 'utf8'), options);
}
fs.mkdirSync('.artifacts', { recursive: true });
fs.writeFileSync(
  '.artifacts/m8-wp-06-commercial-runtime-reliability.json',
  JSON.stringify({ mgsn717Prettier: formatted })
);

export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};
