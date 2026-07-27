/* eslint-disable @typescript-eslint/no-unsafe-argument */
import '../../../../packages/ui/node_modules/@testing-library/jest-dom/vitest';
import { cleanup } from '../../../../packages/ui/node_modules/@testing-library/react';
import { toHaveNoViolations } from '../../../../packages/ui/node_modules/jest-axe';
import { afterEach, expect } from 'vitest';
expect.extend(toHaveNoViolations);
afterEach(cleanup);
