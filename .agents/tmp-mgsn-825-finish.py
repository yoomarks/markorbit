from pathlib import Path

route = Path('services/mgsn/src/governed-network-http.ts')
text = route.read_text()

old = '''const versionReferenceTransportShape = {
  providerSelectionId: null,
  controlledHandoffId: null,
  version: null,
  scopeVersion: null
} satisfies TransportShape;

const selectionScopeTransportShape = {'''
new = '''const providerSelectionVersionReferenceTransportShape = {
  providerSelectionId: null,
  version: null,
  scopeVersion: null
} satisfies TransportShape;

const controlledHandoffVersionReferenceTransportShape = {
  controlledHandoffId: null,
  version: null
} satisfies TransportShape;

const discoveryRequestTransportShape = {
  schemaVersion: null,
  providerDiscoveryRequestId: null,
  need: {
    reference: null,
    version: null,
    fingerprintSha256: null,
    jurisdiction: null,
    serviceType: null
  },
  purpose: null,
  audience: {
    kind: null,
    relationshipAuthorityReference: null
  },
  contextReference: null,
  requestedDataClasses: null,
  requestedFields: null,
  requestedAt: null,
  requestFingerprintSha256: null,
  correlationId: null
} satisfies TransportShape;

const selectionScopeTransportShape = {'''
if old not in text:
    raise SystemExit('reference-shape marker missing')
text = text.replace(old, new, 1)
text = text.replace('target: versionReferenceTransportShape,', 'target: providerSelectionVersionReferenceTransportShape,', 1)
text = text.replace('selection: versionReferenceTransportShape,', 'selection: providerSelectionVersionReferenceTransportShape,', 1)
text = text.replace('selection: versionReferenceTransportShape,', 'selection: providerSelectionVersionReferenceTransportShape,', 1)

human_marker = '''  const envelope = parsed as Partial<MgsnGovernedHumanActionEnvelopeV1>;
  const strings = ['''
human_new = '''  const envelope = parsed as Partial<MgsnGovernedHumanActionEnvelopeV1>;
  const allowedHumanActionFields = new Set([
    'schemaVersion',
    'kind',
    'actorKind',
    'workspaceId',
    'userId',
    'membershipId',
    'principalReference',
    'authorityReference',
    'authorityVersion',
    'authenticatedAt',
    'affirmativeHumanActionEvidenceReference',
    'payloadIdentityAuthoritative'
  ]);
  if (Object.keys(envelope).some((field) => !allowedHumanActionFields.has(field)))
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority contains unsupported fields.'
    );
  const strings = ['''
if human_marker not in text:
    raise SystemExit('human-action marker missing')
text = text.replace(human_marker, human_new, 1)

discovery_marker = '''        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        const discoveryRequest = {
          ...body,
          requesterWorkspaceId: principal.workspaceId
        } as unknown as ProviderDiscoveryRequestReferenceV1;'''
discovery_new = '''        const body = bodyOf(request);
        rejectTopLevelAuthority(body);
        assertExactTransportShape(body, discoveryRequestTransportShape, 'body');
        const audience = objectOf(body.audience, 'audience');
        if (
          audience.kind === 'BOUNDED_NETWORK' &&
          audience.relationshipAuthorityReference !== undefined
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'body.audience.relationshipAuthorityReference is not permitted for BOUNDED_NETWORK.'
          );
        const discoveryRequest = {
          ...body,
          requesterWorkspaceId: principal.workspaceId
        } as unknown as ProviderDiscoveryRequestReferenceV1;'''
if discovery_marker not in text:
    raise SystemExit('discovery route marker missing')
text = text.replace(discovery_marker, discovery_new, 1)

selection_create_marker = '''        assertExactTransportShape(body, providerSelectionCreateTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');'''
selection_create_new = '''        assertExactTransportShape(body, providerSelectionCreateTransportShape, 'body');
        const expectedCurrent = objectOf(body.expectedCurrent, 'expectedCurrent');
        if (
          expectedCurrent.kind === 'ABSENT' &&
          (expectedCurrent.providerSelectionId !== undefined || expectedCurrent.version !== undefined)
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'ABSENT Selection expectedCurrent cannot carry an exact Selection reference.'
          );
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');'''
if selection_create_marker not in text:
    raise SystemExit('selection create marker missing')
text = text.replace(selection_create_marker, selection_create_new, 1)

handoff_create_marker = '''        assertExactTransportShape(body, controlledHandoffAuthorizeTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');'''
handoff_create_new = '''        assertExactTransportShape(body, controlledHandoffAuthorizeTransportShape, 'body');
        const expectedCurrent = objectOf(body.expectedCurrent, 'expectedCurrent');
        if (
          expectedCurrent.kind === 'ABSENT' &&
          (expectedCurrent.controlledHandoffId !== undefined || expectedCurrent.version !== undefined)
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'ABSENT Handoff expectedCurrent cannot carry an exact Handoff reference.'
          );
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');'''
if handoff_create_marker not in text:
    raise SystemExit('handoff create marker missing')
text = text.replace(handoff_create_marker, handoff_create_new, 1)

allocation_marker = '''        assertExactTransportShape(body, governedAllocationTransportShape, 'body');
        const result = await operation(() =>'''
allocation_new = '''        assertExactTransportShape(body, governedAllocationTransportShape, 'body');
        const handoffBinding = objectOf(body.handoffBinding, 'handoffBinding');
        if (
          handoffBinding.mode === 'NONE_EXPLICIT' &&
          Object.keys(handoffBinding).some((field) => field !== 'mode')
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'NONE_EXPLICIT Handoff binding cannot carry an exact Handoff reference or fingerprints.'
          );
        const result = await operation(() =>'''
if allocation_marker not in text:
    raise SystemExit('allocation marker missing')
text = text.replace(allocation_marker, allocation_new, 1)

route.write_text(text)

tests_path = Path('services/mgsn/tests/governed-network-http.test.ts')
tests = tests_path.read_text()
anchor = '\n});\n'
extra = r'''
  it('rejects arbitrary private fields from Provider Discovery requests', async () => {
    const response = await fetch(`${base}/v1/governed-network/discovery/evaluate`, {
      method: 'POST',
      headers: { ...headers(), 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        customerDocument: { raw: 'must-not-be-reflected' }
      })
    });

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('UNEXPECTED_GOVERNED_NETWORK_FIELD');
    expect(captured).toBeUndefined();
  });

  it('rejects unsupported fields inside the reviewed human-action envelope', async () => {
    const encoded = Buffer.from(
      JSON.stringify({
        ...humanAction('PROVIDER_SELECTION'),
        customerDocument: 'must-not-cross-the-authority-boundary'
      }),
      'utf8'
    ).toString('base64url');
    const response = await fetch(`${base}/v1/governed-network/selections`, {
      method: 'POST',
      headers: {
        ...headers({ idempotencyKey: 'selection-extra-human-action-field' }),
        [MGSN_GOVERNED_HUMAN_ACTION_HEADER]: encoded,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        expectedCurrent: { kind: 'ABSENT', expectedScopeVersion: 0 },
        sourceLineage: { discoveryRequest: {} }
      })
    });

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('INVALID_GOVERNED_HUMAN_ACTION');
    expect(captured).toBeUndefined();
  });

  it('keeps union branches exact for absent Selection and no-Handoff Allocation', async () => {
    const selectionResponse = await fetch(`${base}/v1/governed-network/selections`, {
      method: 'POST',
      headers: {
        ...headers({ kind: 'PROVIDER_SELECTION', idempotencyKey: 'selection-absent-extra-ref' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        expectedCurrent: {
          kind: 'ABSENT',
          expectedScopeVersion: 0,
          providerSelectionId: selectionId,
          version: 1
        },
        sourceLineage: { discoveryRequest: {} }
      })
    });
    expect(selectionResponse.status).toBe(400);
    expect((await selectionResponse.json()).code).toBe('UNEXPECTED_GOVERNED_NETWORK_FIELD');
    expect(captured).toBeUndefined();

    const allocationResponse = await fetch(`${base}/v1/governed-network/allocations`, {
      method: 'POST',
      headers: {
        ...headers({ idempotencyKey: 'allocation-none-extra-handoff' }),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        handoffBinding: {
          mode: 'NONE_EXPLICIT',
          handoff: { controlledHandoffId: handoffId, version: 1 }
        }
      })
    });
    expect(allocationResponse.status).toBe(400);
    expect((await allocationResponse.json()).code).toBe('UNEXPECTED_GOVERNED_NETWORK_FIELD');
    expect(captured).toBeUndefined();
  });
'''
if 'rejects arbitrary private fields from Provider Discovery requests' in tests:
    raise SystemExit('final transport tests already inserted')
head, sep, tail = tests.rpartition(anchor)
if not sep:
    raise SystemExit('test-suite end marker missing')
tests_path.write_text(head + extra + anchor + tail)
