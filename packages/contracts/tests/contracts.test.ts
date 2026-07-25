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
});
