import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { CoreIntakeRequest, CoreIntakeResult } from '../src/knowledge-intake.js';

describe('Knowledge intake V1 fixtures', () => {
  it('exposes request and RECEIVED result fixtures matching the shared contracts', async () => {
    const request = JSON.parse(
      await readFile(new URL('../fixtures/core-intake-request-v1.json', import.meta.url), 'utf8')
    ) as CoreIntakeRequest;
    const result = JSON.parse(
      await readFile(
        new URL('../fixtures/core-intake-result-received-v1.json', import.meta.url),
        'utf8'
      )
    ) as CoreIntakeResult;
    expect(request.evidence.artifactIds).toHaveLength(2);
    expect(result).toEqual({
      intakeId: '018f0000-0000-7000-8000-000000000004',
      status: 'RECEIVED',
      readyPackageId: request.readyPackageId
    });
  });
});
