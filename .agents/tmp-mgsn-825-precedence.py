from pathlib import Path
import re

path = Path('services/mgsn/src/governed-network-http.ts')
text = path.read_text()


def sub_once(pattern: str, replacement: str, label: str) -> None:
    global text
    text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected one match, got {count}')


sub_once(
    r"const controlledHandoffRevokeTransportShape = \{\n\s*schemaVersion: null,\n\s*target: \{\n\s*controlledHandoffId: null,\n\s*version: null\n\s*\},",
    "const controlledHandoffRevokeTransportShape = {\n  schemaVersion: null,\n  target: controlledHandoffVersionReferenceTransportShape,",
    'handoff revoke exact reference shape'
)

sub_once(
    r"(assertExactTransportShape\(body, discoveryRequestTransportShape, 'body'\);\n)\s*const audience = objectOf\(body\.audience, 'audience'\);\n\s*if \(\n\s*audience\.kind === 'BOUNDED_NETWORK' &&\n\s*audience\.relationshipAuthorityReference !== undefined\n\s*\)",
    "\\1        const audience =\n          body.audience === undefined ? undefined : objectOf(body.audience, 'audience');\n        if (\n          audience?.kind === 'BOUNDED_NETWORK' &&\n          audience.relationshipAuthorityReference !== undefined\n        )",
    'optional discovery audience guard'
)

sub_once(
    r"(assertExactTransportShape\(body, providerSelectionCreateTransportShape, 'body'\);\n)\s*const expectedCurrent = objectOf\(body\.expectedCurrent, 'expectedCurrent'\);\n\s*if \(\n\s*expectedCurrent\.kind === 'ABSENT' &&\n\s*\(expectedCurrent\.providerSelectionId !== undefined \|\|\n\s*expectedCurrent\.version !== undefined\)\n\s*\)\n\s*throw new HttpError\(\n\s*400,\n\s*'UNEXPECTED_GOVERNED_NETWORK_FIELD',\n\s*'ABSENT Selection expectedCurrent cannot carry an exact Selection reference\.'\n\s*\);\n\s*const envelope = parseHumanActionEnvelope\(request, principal, 'PROVIDER_SELECTION'\);",
    "\\1        const envelope = parseHumanActionEnvelope(request, principal, 'PROVIDER_SELECTION');\n        const expectedCurrent =\n          body.expectedCurrent === undefined\n            ? undefined\n            : objectOf(body.expectedCurrent, 'expectedCurrent');\n        if (\n          expectedCurrent?.kind === 'ABSENT' &&\n          (expectedCurrent.providerSelectionId !== undefined ||\n            expectedCurrent.version !== undefined)\n        )\n          throw new HttpError(\n            400,\n            'UNEXPECTED_GOVERNED_NETWORK_FIELD',\n            'ABSENT Selection expectedCurrent cannot carry an exact Selection reference.'\n          );",
    'selection authority precedence'
)

sub_once(
    r"(assertExactTransportShape\(body, controlledHandoffAuthorizeTransportShape, 'body'\);\n)\s*const expectedCurrent = objectOf\(body\.expectedCurrent, 'expectedCurrent'\);\n\s*if \(\n\s*expectedCurrent\.kind === 'ABSENT' &&\n\s*\(expectedCurrent\.controlledHandoffId !== undefined \|\|\n\s*expectedCurrent\.version !== undefined\)\n\s*\)\n\s*throw new HttpError\(\n\s*400,\n\s*'UNEXPECTED_GOVERNED_NETWORK_FIELD',\n\s*'ABSENT Handoff expectedCurrent cannot carry an exact Handoff reference\.'\n\s*\);\n\s*const envelope = parseHumanActionEnvelope\(request, principal, 'CONTROLLED_HANDOFF'\);",
    "\\1        const envelope = parseHumanActionEnvelope(request, principal, 'CONTROLLED_HANDOFF');\n        const expectedCurrent =\n          body.expectedCurrent === undefined\n            ? undefined\n            : objectOf(body.expectedCurrent, 'expectedCurrent');\n        if (\n          expectedCurrent?.kind === 'ABSENT' &&\n          (expectedCurrent.controlledHandoffId !== undefined ||\n            expectedCurrent.version !== undefined)\n        )\n          throw new HttpError(\n            400,\n            'UNEXPECTED_GOVERNED_NETWORK_FIELD',\n            'ABSENT Handoff expectedCurrent cannot carry an exact Handoff reference.'\n          );",
    'handoff authority precedence'
)

sub_once(
    r"(assertExactTransportShape\(body, governedAllocationTransportShape, 'body'\);\n)\s*const handoffBinding = objectOf\(body\.handoffBinding, 'handoffBinding'\);\n\s*if \(\n\s*handoffBinding\.mode === 'NONE_EXPLICIT' &&\n\s*Object\.keys\(handoffBinding\)\.some\(\(field\) => field !== 'mode'\)\n\s*\)",
    "\\1        const idempotencyKey = requireIdempotency(request, body);\n        const handoffBinding =\n          body.handoffBinding === undefined\n            ? undefined\n            : objectOf(body.handoffBinding, 'handoffBinding');\n        if (\n          handoffBinding?.mode === 'NONE_EXPLICIT' &&\n          Object.keys(handoffBinding).some((field) => field !== 'mode')\n        )",
    'allocation idempotency precedence'
)

sub_once(
    r"actorId: principal\.userId,\n\s*idempotencyKey: requireIdempotency\(request, body\)\n\s*\} as Parameters<GovernedAllocationService\['allocate'\]>\[0\]\)",
    "actorId: principal.userId,\n            idempotencyKey\n          } as Parameters<GovernedAllocationService['allocate']>[0])",
    'allocation idempotency reuse'
)

path.write_text(text)
