from pathlib import Path

path = Path('services/mgsn/src/governed-network-http.ts')
text = path.read_text()

replacements = [
    (
        '''const controlledHandoffRevokeTransportShape = {
  schemaVersion: null,
  target: {
    controlledHandoffId: null,
    version: null
  },''',
        '''const controlledHandoffRevokeTransportShape = {
  schemaVersion: null,
  target: controlledHandoffVersionReferenceTransportShape,'''
    ),
    (
        '''        assertExactTransportShape(body, discoveryRequestTransportShape, 'body');
        const audience = objectOf(body.audience, 'audience');
        if (
          audience.kind === 'BOUNDED_NETWORK' &&
          audience.relationshipAuthorityReference !== undefined
        )''',
        '''        assertExactTransportShape(body, discoveryRequestTransportShape, 'body');
        const audience =
          body.audience === undefined ? undefined : objectOf(body.audience, 'audience');
        if (
          audience?.kind === 'BOUNDED_NETWORK' &&
          audience.relationshipAuthorityReference !== undefined
        )'''
    ),
    (
        '''        assertExactTransportShape(body, providerSelectionCreateTransportShape, 'body');
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
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');''',
        '''        assertExactTransportShape(body, providerSelectionCreateTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');
        const expectedCurrent =
          body.expectedCurrent === undefined
            ? undefined
            : objectOf(body.expectedCurrent, 'expectedCurrent');
        if (
          expectedCurrent?.kind === 'ABSENT' &&
          (expectedCurrent.providerSelectionId !== undefined || expectedCurrent.version !== undefined)
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'ABSENT Selection expectedCurrent cannot carry an exact Selection reference.'
          );'''
    ),
    (
        '''        assertExactTransportShape(body, controlledHandoffAuthorizeTransportShape, 'body');
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
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');''',
        '''        assertExactTransportShape(body, controlledHandoffAuthorizeTransportShape, 'body');
        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');
        const expectedCurrent =
          body.expectedCurrent === undefined
            ? undefined
            : objectOf(body.expectedCurrent, 'expectedCurrent');
        if (
          expectedCurrent?.kind === 'ABSENT' &&
          (expectedCurrent.controlledHandoffId !== undefined || expectedCurrent.version !== undefined)
        )
          throw new HttpError(
            400,
            'UNEXPECTED_GOVERNED_NETWORK_FIELD',
            'ABSENT Handoff expectedCurrent cannot carry an exact Handoff reference.'
          );'''
    ),
    (
        '''        assertExactTransportShape(body, governedAllocationTransportShape, 'body');
        const handoffBinding = objectOf(body.handoffBinding, 'handoffBinding');
        if (
          handoffBinding.mode === 'NONE_EXPLICIT' &&
          Object.keys(handoffBinding).some((field) => field !== 'mode')
        )''',
        '''        assertExactTransportShape(body, governedAllocationTransportShape, 'body');
        const idempotencyKey = requireIdempotency(request, body);
        const handoffBinding =
          body.handoffBinding === undefined
            ? undefined
            : objectOf(body.handoffBinding, 'handoffBinding');
        if (
          handoffBinding?.mode === 'NONE_EXPLICIT' &&
          Object.keys(handoffBinding).some((field) => field !== 'mode')
        )'''
    ),
    (
        '''            actorId: principal.userId,
            idempotencyKey: requireIdempotency(request, body)
          } as Parameters<GovernedAllocationService['allocate']>[0])''',
        '''            actorId: principal.userId,
            idempotencyKey
          } as Parameters<GovernedAllocationService['allocate']>[0])'''
    )
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'expected route fragment missing: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
