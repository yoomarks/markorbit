import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import { describe, it } from 'vitest';

describe('Production Intake Prettier probe', () => {
  it('prints exact hosted Prettier output', async () => {
    const file = path.resolve('tests/production-intake-postgres.test.ts');
    const input = await readFile(file, 'utf8');
    const config = await prettier.resolveConfig(file);
    const output = await prettier.format(input, {
      ...(config ?? {}),
      filepath: file,
    });

    throw new Error(`PRETTIER608_START\n${output}PRETTIER608_END`);
  });
});
