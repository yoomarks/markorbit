import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as prettier from 'prettier';
import { it } from 'vitest';

it('emits exact hosted Prettier output for TrademarkAssetWorkspace', async () => {
  const file = path.resolve('src/features/trademark-assets/TrademarkAssetWorkspace.tsx');
  const input = await readFile(file, 'utf8');
  const config = await prettier.resolveConfig(file);
  const output = await prettier.format(input, {
    ...config,
    filepath: file
  });

  throw new Error(`LITE676_PRETTIER_B64:${Buffer.from(output, 'utf8').toString('base64')}`);
});
