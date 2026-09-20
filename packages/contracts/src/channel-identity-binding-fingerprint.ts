import { createHash } from 'node:crypto';
import {
  parseWorkspaceChannelIdentityBindingV1,
  workspaceChannelIdentityBindingCanonicalPayloadV1,
  type WorkspaceChannelIdentityBindingV1
} from './channel-identity-binding.js';

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
export function workspaceChannelIdentityBindingFingerprintSha256V1(
  binding: Readonly<WorkspaceChannelIdentityBindingV1>
): string {
  const parsed = parseWorkspaceChannelIdentityBindingV1(binding);
  return createHash('sha256')
    .update(stableSerialize(workspaceChannelIdentityBindingCanonicalPayloadV1(parsed)))
    .digest('hex');
}
