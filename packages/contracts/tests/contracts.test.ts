import { describe, expect, it } from 'vitest';
import {
  channels,
  isChannel,
  isMarkOrbitId,
  isRelationshipModel,
  parseChannel,
  parseRelationshipModel,
  relationshipModels
} from '../src/index.js';
import {
  assertDirectIntake,
  parseIntakeCreateCommand,
  parseRecommendationPackage
} from '../src/index.js';

const valid = {
  channel: 'MARKREG_DIRECT',
  relationshipModel: 'DIRECT',
  customerIntent: {
    brandName: 'Orbit',
    applicantCountry: 'GB',
    targetJurisdictions: ['US'],
    goodsServicesDescription: 'Software'
  },
  actor: {
    actorId: 'actor_test',
    workplaceId: 'workplace_test',
    product: 'MARKREG_COM',
    purpose: 'recommendation'
  },
  idempotencyKey: 'key-1',
  correlationId: 'correlation_test'
};

describe('shared transport contracts', () => {
  it('keeps all channel values unique and runtime-valid', () => {
    expect(new Set(channels).size).toBe(channels.length);
    expect(channels.every(isChannel)).toBe(true);
  });

  it('keeps all relationship models unique and runtime-valid', () => {
    expect(new Set(relationshipModels).size).toBe(relationshipModels.length);
    expect(relationshipModels.every(isRelationshipModel)).toBe(true);
  });

  it('rejects unknown controlled values', () => {
    expect(() => parseChannel('DIRECT_CUSTOMER')).toThrow(TypeError);
    expect(() => parseRelationshipModel('OWNED')).toThrow(TypeError);
  });

  it('accepts governed reference identifiers and rejects ambiguous strings', () => {
    expect(isMarkOrbitId('matter_01JABC')).toBe(true);
    expect(isMarkOrbitId('01JABC')).toBe(false);
    expect(isMarkOrbitId('Matter_01JABC')).toBe(false);
  });

  it('validates a complete direct intake fixture', () => {
    expect(parseIntakeCreateCommand(valid)).toMatchObject({ channel: 'MARKREG_DIRECT' });
    expect(() => assertDirectIntake(parseIntakeCreateCommand(valid))).not.toThrow();
  });

  it('rejects missing, empty, and invalid country fields', () => {
    expect(() => parseIntakeCreateCommand({ ...valid, actor: undefined })).toThrow();
    expect(() =>
      parseIntakeCreateCommand({
        ...valid,
        customerIntent: { ...valid.customerIntent, brandName: '' }
      })
    ).toThrow();
    expect(() =>
      parseIntakeCreateCommand({
        ...valid,
        customerIntent: { ...valid.customerIntent, applicantCountry: 'United Kingdom' }
      })
    ).toThrow();
  });

  it('rejects an unsupported but governed channel relationship combination', () => {
    expect(() =>
      assertDirectIntake(parseIntakeCreateCommand({ ...valid, channel: 'LITE_PROFESSIONAL' }))
    ).toThrow();
  });

  it('requires fixture recommendations to be explicitly marked', () => {
    expect(() => parseRecommendationPackage({ status: 'FINAL', options: [] })).toThrow();
  });
});
