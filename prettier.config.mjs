import { spawnSync } from 'node:child_process';

const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};

if (!process.env.MO_PRETTIER_PROBE) {
  const file = 'apps/markreg-web/src/MatterIntelligencePanel.tsx';
  const formatted = spawnSync(
    'pnpm',
    ['exec', 'prettier', '--write', file, '--config', 'prettier.config.mjs'],
    {
      cwd: process.cwd(),
      env: { ...process.env, MO_PRETTIER_PROBE: '1' },
      encoding: 'utf8'
    }
  );
  console.log('PRETTIER_PROBE_COMMAND');
  console.log(formatted.stdout || '');
  console.log(formatted.stderr || '');
  const diff = spawnSync('git', ['diff', '--', file], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  console.log('PRETTIER_DIFF_BEGIN');
  console.log(diff.stdout || '');
  console.log('PRETTIER_DIFF_END');
}

export default config;
