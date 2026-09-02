import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import { describe, it } from 'vitest';

describe('Production Intake Prettier probe', () => {
  it('prints exact hosted Prettier output as base64', async () => {
    const file = path.resolve('tests/production-intake-postgres.test.ts');
    const input = await readFile(file, 'utf8');
    const config = await prettier.resolveConfig(file);
    const output = await prettier.format(input, {
      ...(config ?? {}),
      filepath: file,
    });

    throw new Error(
      `PRETTIER608_B64:${Buffer.from(output, 'utf8').toString('base64')}`,
    );
  });
});
