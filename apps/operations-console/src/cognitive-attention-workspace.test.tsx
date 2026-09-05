import { describe, expect, it } from 'vitest';
import { COGNITIVE_ATTENTION_GROUP_LABELS } from './cognitive-attention.js';

// This focused contract test intentionally validates the stable presentation vocabulary without
// requiring a DOM renderer. Runtime/browser coverage remains owned by the repository UI gates.
describe('Cognitive attention presentation contract', () => {
  it('keeps deterministic non-health attention groups', () => {
    expect(COGNITIVE_ATTENTION_GROUP_LABELS).toEqual({
      HUMAN_GOVERNANCE_ATTENTION: 'Human / governance attention required',
      INTEGRITY_CURRENTNESS_FINDING: 'Integrity / currentness finding',
      SOURCE_DEPENDENCY_UNAVAILABLE: 'Source / dependency unavailable',
      OBSERVABILITY_RECORDING_LIMITATION: 'Observability / recording limitation'
    });
  });

  it('does not define a health, readiness, severity, repair or approval group', () => {
    const labels = Object.values(COGNITIVE_ATTENTION_GROUP_LABELS).join(' ').toLowerCase();
    expect(labels).not.toContain('health');
    expect(labels).not.toContain('readiness');
    expect(labels).not.toContain('severity');
    expect(labels).not.toContain('repair');
    expect(labels).not.toContain('approval');
  });
});
