import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const isReviewedSourceHandoffSuite = process.argv.some((argument) =>
  argument.includes('milestone5-reviewed-source-handoff.integration.test.ts')
);

export default defineConfig({
  resolve: {
    alias: isReviewedSourceHandoffSuite
      ? [
          {
            find: '@markorbit/contracts/provider-execution',
            replacement: path.join(root, 'packages/contracts/src/provider-execution.ts')
          },
          {
            find: '@markorbit/contracts/evidence-lifecycle',
            replacement: path.join(root, 'packages/contracts/src/evidence-lifecycle.ts')
          },
          {
            find: '@markorbit/contracts/order',
            replacement: path.join(root, 'packages/contracts/src/order.ts')
          },
          {
            find: '@markorbit/contracts',
            replacement: path.join(root, 'packages/contracts/src/index.ts')
          },
          {
            find: '@markorbit/persistence',
            replacement: path.join(root, 'packages/persistence/src/index.ts')
          },
          {
            find: '@markorbit/service-kit',
            replacement: path.join(root, 'packages/service-kit/src/index.ts')
          },
          {
            find: '@markorbit/events',
            replacement: path.join(root, 'packages/events/src/index.ts')
          }
        ]
      : []
  }
});
