import fs from 'node:fs';

function replaceOnce(source, oldText, newText, message) {
  if (!source.includes(oldText)) throw new Error(message);
  return source.replace(oldText, newText);
}

const sourcePath = 'services/mgsn/src/controlled-privacy-handoff.ts';
let source = fs.readFileSync(sourcePath, 'utf8');
source = replaceOnce(
  source,
  "authority: AuthorizeOrReplaceControlledHandoffCommandV1['trustedHumanAuthority'] | RevokeControlledHandoffCommandV1['trustedHumanAuthority']",
  "authority: AuthorizeOrReplaceControlledHandoffCommandV1['trustedHumanAuthority']",
  'duplicate authority union target not found'
);
source = replaceOnce(
  source,
  `  async findSlotState(key: string): Promise<ControlledHandoffSlotState> {\n    const state = this.slots.get(key);\n    return state ? clone(state) : { current: undefined, version: 0 };\n  }`,
  `  findSlotState(key: string): Promise<ControlledHandoffSlotState> {\n    const state = this.slots.get(key);\n    return Promise.resolve(state ? clone(state) : { current: undefined, version: 0 });\n  }`,
  'findSlotState target not found'
);
source = replaceOnce(
  source,
  `  async findLatest(id: ControlledHandoffId): Promise<ControlledHandoffEnvelopeV1 | undefined> {\n    return clone(this.history.get(id)?.at(-1));\n  }`,
  `  findLatest(id: ControlledHandoffId): Promise<ControlledHandoffEnvelopeV1 | undefined> {\n    return Promise.resolve(clone(this.history.get(id)?.at(-1)));\n  }`,
  'findLatest target not found'
);
source = replaceOnce(
  source,
  `  async findReplay(key: string, idempotencyKey: string): Promise<ControlledHandoffReplayRecord | undefined> {\n    return clone(this.replay.get(\`${'${key}'}\\u0000${'${idempotencyKey}'}\`));\n  }`,
  `  findReplay(key: string, idempotencyKey: string): Promise<ControlledHandoffReplayRecord | undefined> {\n    return Promise.resolve(clone(this.replay.get(\`${'${key}'}\\u0000${'${idempotencyKey}'}\`)));\n  }`,
  'findReplay target not found'
);
source = replaceOnce(
  source,
  `  async commit(mutation: ControlledHandoffCommit): Promise<void> {`,
  `  commit(mutation: ControlledHandoffCommit): Promise<void> {`,
  'commit signature target not found'
);
source = replaceOnce(
  source,
  `    this.replay.set(replayMapKey, clone(mutation.replay));\n  }\n\n  listHistory`,
  `    this.replay.set(replayMapKey, clone(mutation.replay));\n    return Promise.resolve();\n  }\n\n  listHistory`,
  'commit return target not found'
);
source = replaceOnce(
  source,
  `    const { envelopeFingerprintSha256: _oldFingerprint, ...withoutFingerprint } = base;`,
  `    const withoutFingerprint = Object.fromEntries(\n      Object.entries(base).filter(([key]) => key !== 'envelopeFingerprintSha256')\n    );`,
  'fingerprint target not found'
);
source = replaceOnce(
  source,
  `    const snapshot = await this.evaluateAuthority({\n      envelope,\n      purpose: input.purpose,\n      attempt: input.attempt\n    });\n    const authorityDenial = denialFromAuthority(snapshot, input.attempt.artifactRetrievalRequested);`,
  `    let snapshot: ControlledHandoffCurrentAuthoritySnapshot;\n    try {\n      snapshot = await this.currentAuthority.evaluateCurrentAuthority({\n        envelope,\n        purpose: input.purpose,\n        attempt: input.attempt\n      });\n    } catch {\n      return deny('AUTHORITY_UNAVAILABLE');\n    }\n    const authorityDenial = denialFromAuthority(snapshot, input.attempt.artifactRetrievalRequested);`,
  'validation outage target not found'
);
fs.writeFileSync(sourcePath, source);

const testPath = 'services/mgsn/tests/controlled-privacy-handoff.test.ts';
let test = fs.readFileSync(testPath, 'utf8');
test = test.replace(
  "() => 'controlled-handoff_605-currentness' as ControlledHandoffId",
  "() => 'controlled-handoff_605-currentness'"
);
const testName = 'returns a fail-closed validation result when current authority evaluation is unavailable';
if (!test.includes(testName)) {
  const addition = `\n\n  it('${testName}', async () => {\n    const repository = new InMemoryControlledHandoffRepository();\n    const seed = new ControlledPrivacyHandoffService(\n      repository,\n      { evaluateCurrentAuthority: () => Promise.resolve(currentSnapshot()) },\n      () => now,\n      () => 'controlled-handoff_605-outage'\n    );\n    const current = await createCurrent(seed);\n    const outage = new ControlledPrivacyHandoffService(\n      repository,\n      { evaluateCurrentAuthority: () => Promise.reject(new Error('outage')) },\n      () => now\n    );\n    const validation = await outage.validateCurrent(principal(), {\n      envelope: { controlledHandoffId: current.envelope.controlledHandoffId, version: 1 },\n      purpose: 'HANDOFF_CONSUMPTION',\n      attempt: attempt()\n    });\n    expect(validation).toMatchObject({\n      decision: 'DENY',\n      denialReason: 'AUTHORITY_UNAVAILABLE',\n      currentlyUsable: false,\n      currentExactDisclosurePermitted: false\n    });\n  });\n`;
  const index = test.lastIndexOf('\n});\n');
  if (index < 0) throw new Error('suite end not found');
  test = test.slice(0, index) + addition + test.slice(index);
}
fs.writeFileSync(testPath, test);
