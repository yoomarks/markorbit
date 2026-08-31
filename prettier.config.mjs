import { execFileSync } from 'node:child_process';

const probePaths = [
  'packages/contracts/src/method-improvement.ts',
  'packages/contracts/tests/method-improvement.test.ts',
  'services/core/src/index.ts',
  'services/core/src/method-improvement.ts',
  'services/core/tests/method-improvement-postgres.test.ts',
  'services/core/tests/method-improvement.test.ts'
];

if (process.env.GITHUB_ACTIONS === 'true' && process.env.MO_PRETTIER_PROBE !== '1') {
  const env = { ...process.env, MO_PRETTIER_PROBE: '1' };
  execFileSync('prettier', ['--write', ...probePaths], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit'
  });
  const diff = execFileSync('git', ['diff', '--', ...probePaths], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  console.log('---MO_PRETTIER_PROBE_DIFF_BEGIN---');
  console.log(diff);
  console.log('---MO_PRETTIER_PROBE_DIFF_END---');
}

export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
};
