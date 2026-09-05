import fs from 'node:fs';

const path = 'services/mgsn/src/governed-network-http.ts';
let source = fs.readFileSync(path, 'utf8');

function replaceExact(before, after, label) {
  if (!source.includes(before)) throw new Error(`missing patch target: ${label}`);
  source = source.replace(before, after);
}

function replaceBetween(start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`missing patch start: ${label}`);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`missing patch end: ${label}`);
  source = source.slice(0, startIndex) + replacement + source.slice(endIndex);
}

replaceExact(
  "import type { ProviderDiscoveryRequestReferenceV1 } from '@markorbit/contracts/provider-discovery';\nimport type {\n  AuthorizeOrReplaceControlledHandoffCommandV1,\n  ControlledHandoffConsumptionAttemptV1,\n  ControlledHandoffId,\n  ControlledHandoffValidationPurpose,\n  RevokeControlledHandoffCommandV1\n} from '@markorbit/contracts/controlled-privacy-handoff';\nimport type {\n  CreateOrReplaceProviderSelectionCommandV1,\n  ProviderSelectionId,\n  ProviderSelectionValidationPurpose,\n  RevokeProviderSelectionCommandV1\n} from '@markorbit/contracts/provider-selection';\n",
  '',
  'domain transport type imports'
);

replaceExact(
  "import {\n  ProviderSelectionError,\n  type ProviderSelectionPrincipal,\n  type ProviderSelectionService\n} from './provider-selection.js';\n",
  "import {\n  ProviderSelectionError,\n  type ProviderSelectionPrincipal,\n  type ProviderSelectionService\n} from './provider-selection.js';\nimport {\n  parseControlledHandoffAuthorizeTransport,\n  parseControlledHandoffRevokeTransport,\n  parseControlledHandoffValidationTransport,\n  parseGovernedAllocationTransport,\n  parseProviderDiscoveryTransport,\n  parseProviderSelectionCreateTransport,\n  parseProviderSelectionRevokeTransport,\n  parseProviderSelectionValidationTransport\n} from './governed-network-http-transport.js';\n",
  'parser imports'
);

replaceBetween(
  'function objectOf(value: unknown, field: string): Body {',
  'function rejectTopLevelAuthority(body: Body): void {',
  '',
  'legacy shape-only parser section'
);

replaceBetween(
  "        assertExactTransportShape(body, discoveryRequestTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const discoveryRequest = parseProviderDiscoveryTransport(body, principal.workspaceId);\n",
  'discovery route parsing'
);

replaceBetween(
  "        assertExactTransportShape(body, providerSelectionCreateTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');\n        const command = parseProviderSelectionCreateTransport({\n          value: body,\n          trustedWorkspaceId: principal.workspaceId,\n          trustedAuthority: selectionAuthority(principal, envelope),\n          idempotencyKey: requireIdempotency(request, body)\n        });\n",
  'selection create parsing'
);

replaceBetween(
  "        assertExactTransportShape(body, providerSelectionRevokeTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');\n        const command = parseProviderSelectionRevokeTransport({\n          value: body,\n          routeProviderSelectionId: request.params.providerSelectionId!,\n          trustedWorkspaceId: principal.workspaceId,\n          trustedAuthority: selectionAuthority(principal, envelope),\n          idempotencyKey: requireIdempotency(request, body)\n        });\n",
  'selection revoke parsing'
);

replaceBetween(
  "        assertExactTransportShape(body, providerSelectionValidationTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const input = parseProviderSelectionValidationTransport(\n          body,\n          request.params.providerSelectionId!\n        );\n",
  'selection validation parsing'
);

replaceExact(
  "          services().providerSelection.validateCurrent(\n            { workspaceId: principal.workspaceId },\n            {\n              scope: body.scope as CreateOrReplaceProviderSelectionCommandV1['scope'],\n              providerSelectionId: request.params.providerSelectionId! as ProviderSelectionId,\n              purpose,\n              ...(typeof body.checkedAt === 'string' ? { checkedAt: body.checkedAt } : {})\n            }\n          )\n",
  "          services().providerSelection.validateCurrent(\n            { workspaceId: principal.workspaceId },\n            input\n          )\n",
  'selection validation owner call'
);

replaceBetween(
  "        assertExactTransportShape(body, controlledHandoffAuthorizeTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');\n        const command = parseControlledHandoffAuthorizeTransport({\n          value: body,\n          trustedWorkspaceId: principal.workspaceId,\n          trustedAuthority: handoffAuthority(principal, envelope),\n          idempotencyKey: requireIdempotency(request, body)\n        });\n",
  'handoff authorize parsing'
);

replaceBetween(
  "        assertExactTransportShape(body, controlledHandoffRevokeTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');\n        const command = parseControlledHandoffRevokeTransport({\n          value: body,\n          routeControlledHandoffId: request.params.controlledHandoffId!,\n          trustedWorkspaceId: principal.workspaceId,\n          trustedAuthority: handoffAuthority(principal, envelope),\n          idempotencyKey: requireIdempotency(request, body)\n        });\n",
  'handoff revoke parsing'
);

replaceBetween(
  "        assertExactTransportShape(body, controlledHandoffValidationTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const input = parseControlledHandoffValidationTransport(\n          body,\n          request.params.controlledHandoffId!,\n          principal.workspaceId\n        );\n",
  'handoff validation parsing'
);

replaceExact(
  "          services().controlledHandoff.validateCurrent(\n            { workspaceId: principal.workspaceId },\n            {\n              envelope: {\n                controlledHandoffId: request.params.controlledHandoffId! as ControlledHandoffId,\n                version: Number(envelope.version)\n              },\n              purpose,\n              attempt: validationAttempt\n            }\n          )\n",
  "          services().controlledHandoff.validateCurrent(\n            { workspaceId: principal.workspaceId },\n            input\n          )\n",
  'handoff validation owner call'
);

replaceBetween(
  "        assertExactTransportShape(body, governedAllocationTransportShape, 'body');",
  '        const result = await operation(() =>',
  "        const command = parseGovernedAllocationTransport({\n          value: body,\n          trustedWorkspaceId: principal.workspaceId,\n          trustedActorId: principal.userId,\n          idempotencyKey: requireIdempotency(request, body)\n        });\n",
  'allocation parsing'
);

replaceExact(
  "          services().governedAllocation.allocate({\n            ...body,\n            workspaceId: principal.workspaceId,\n            actorId: principal.userId,\n            idempotencyKey\n          } as Parameters<GovernedAllocationService['allocate']>[0])\n",
  "          services().governedAllocation.allocate(command)\n",
  'allocation owner call'
);

// Canonical Discovery arrays are narrowed before construction rather than asserted from string[].
replaceExact(
  "    requestedDataClasses: stringArray(body.requestedDataClasses, 'body.requestedDataClasses', false) as ProviderDiscoveryRequestReferenceV1['requestedDataClasses'],\n    requestedFields: stringArray(body.requestedFields, 'body.requestedFields', false) as ProviderDiscoveryRequestReferenceV1['requestedFields'],\n",
  "    requestedDataClasses: stringArray(body.requestedDataClasses, 'body.requestedDataClasses', false).map((item, index) =>\n      enumValue(\n        item,\n        ['ORGANIZATION_IDENTITY', 'PROVIDER_REFERENCE', 'SUPPLY_PROFILE', 'SERVICE_JURISDICTIONS', 'PROVIDER_EVIDENCE_REFERENCE'] as const,\n        `body.requestedDataClasses[${index}]`\n      )\n    ),\n    requestedFields: stringArray(body.requestedFields, 'body.requestedFields', false).map((item, index) =>\n      enumValue(\n        item,\n        ['displayName', 'providerId', 'serviceTypes', 'jurisdictions', 'evidenceReferences'] as const,\n        `body.requestedFields[${index}]`\n      )\n    ),\n",
  'canonical discovery arrays'
);

fs.writeFileSync(path, source);
