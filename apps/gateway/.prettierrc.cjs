// Current-base formatter probe for #577; never merge this file.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (!process.env.MO_PRETTIER_PROBE) {
  const root = path.resolve(__dirname, '../..');
  const files = [
    'apps/gateway/src/product-loop-http.ts',
    'apps/gateway/tests/trademark-asset-ai-guide-http.test.ts'
  ];
  const formatted = spawnSync(
    'pnpm',
    ['exec', 'prettier', '--write', ...files, '--config', 'prettier.config.mjs'],
    {
      cwd: root,
      env: { ...process.env, MO_PRETTIER_PROBE: '1' },
      encoding: 'utf8'
    }
  );
  console.log('PRETTIER_PROBE_COMMAND');
  console.log(formatted.stdout || '');
  console.log(formatted.stderr || '');
  const diff = spawnSync('git', ['diff', '--', ...files], {
    cwd: root,
    encoding: 'utf8'
  });
  console.log('PRETTIER_DIFF_BEGIN');
  console.log(diff.stdout || '');
  console.log('PRETTIER_DIFF_END');
}

module.exports = {};
