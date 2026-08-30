from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing {label}: {old[:100]!r}")
    return text.replace(old, new, 1)


migration = '''CREATE TABLE markreg_matter_intelligence_reviews (
  matter_intelligence_review_id text PRIMARY KEY
    CHECK (matter_intelligence_review_id ~ '^matter-intelligence-review_[A-Za-z0-9_-]+$'),
  workspace_id uuid NOT NULL,
  review_version integer NOT NULL CHECK (review_version >= 1),
  formal_matter_id text NOT NULL,
  formal_matter_version integer NOT NULL CHECK (formal_matter_version >= 1),
  matter_intelligence_observation_id text NOT NULL,
  observation_fingerprint_sha256 char(64) NOT NULL
    CHECK (observation_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  output_fingerprint_sha256 char(64) NOT NULL
    CHECK (output_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  outcome text NOT NULL CHECK (outcome IN ('CONFIRMED', 'OVERRIDDEN', 'INCONCLUSIVE')),
  reason_code text CHECK (
    reason_code IS NULL OR reason_code IN (
      'METHOD_ERROR',
      'INPUT_DATA_ERROR',
      'APPLICABILITY_ERROR',
      'PRODUCT_USER_PREFERENCE',
      'INCONCLUSIVE_EVIDENCE'
    )
  ),
  rationale text CHECK (rationale IS NULL OR char_length(rationale) BETWEEN 1 AND 2000),
  reviewer_principal_id text NOT NULL CHECK (char_length(reviewer_principal_id) BETWEEN 1 AND 300),
  reviewer_membership_id text NOT NULL CHECK (char_length(reviewer_membership_id) BETWEEN 1 AND 300),
  reviewed_at timestamptz NOT NULL,
  supersedes_review_id text,
  supersedes_review_version integer CHECK (supersedes_review_version IS NULL OR supersedes_review_version >= 1),
  review_fingerprint_sha256 char(64) NOT NULL
    CHECK (review_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  UNIQUE (workspace_id, matter_intelligence_review_id),
  UNIQUE (workspace_id, matter_intelligence_review_id, review_version),
  UNIQUE (workspace_id, matter_intelligence_observation_id, review_version),
  FOREIGN KEY (workspace_id, matter_intelligence_observation_id)
    REFERENCES markreg_matter_intelligence_observations(
      workspace_id,
      matter_intelligence_observation_id
    ),
  FOREIGN KEY (workspace_id, supersedes_review_id, supersedes_review_version)
    REFERENCES markreg_matter_intelligence_reviews(
      workspace_id,
      matter_intelligence_review_id,
      review_version
    ),
  CHECK (
    (supersedes_review_id IS NULL AND supersedes_review_version IS NULL) OR
    (supersedes_review_id IS NOT NULL AND supersedes_review_version IS NOT NULL)
  ),
  CHECK (
    (outcome = 'CONFIRMED' AND reason_code IS NULL) OR
    (outcome = 'INCONCLUSIVE' AND reason_code = 'INCONCLUSIVE_EVIDENCE') OR
    (
      outcome = 'OVERRIDDEN' AND reason_code IN (
        'METHOD_ERROR',
        'INPUT_DATA_ERROR',
        'APPLICABILITY_ERROR',
        'PRODUCT_USER_PREFERENCE'
      )
    )
  )
);

CREATE INDEX markreg_matter_intelligence_reviews_matter_idx
  ON markreg_matter_intelligence_reviews (
    workspace_id,
    formal_matter_id,
    reviewed_at DESC,
    matter_intelligence_review_id ASC
  );

CREATE INDEX markreg_matter_intelligence_reviews_observation_version_idx
  ON markreg_matter_intelligence_reviews (
    workspace_id,
    matter_intelligence_observation_id,
    review_version DESC
  );

CREATE TABLE markreg_matter_intelligence_review_commands (
  workspace_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 300),
  request_fingerprint_sha256 char(64) NOT NULL
    CHECK (request_fingerprint_sha256 ~ '^[0-9a-f]{64}$'),
  matter_intelligence_review_id text NOT NULL,
  matter_intelligence_review_version integer NOT NULL CHECK (matter_intelligence_review_version >= 1),
  result_snapshot jsonb NOT NULL CHECK (jsonb_typeof(result_snapshot) = 'object'),
  correlation_id text NOT NULL CHECK (char_length(correlation_id) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, matter_intelligence_review_id, matter_intelligence_review_version)
    REFERENCES markreg_matter_intelligence_reviews(
      workspace_id,
      matter_intelligence_review_id,
      review_version
    )
);

CREATE INDEX markreg_matter_intelligence_review_commands_review_idx
  ON markreg_matter_intelligence_review_commands (
    workspace_id,
    matter_intelligence_review_id,
    matter_intelligence_review_version,
    created_at DESC
  );

CREATE TRIGGER markreg_matter_intelligence_review_append_only
  BEFORE UPDATE OR DELETE ON markreg_matter_intelligence_reviews
  FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();

CREATE TRIGGER markreg_matter_intelligence_review_command_append_only
  BEFORE UPDATE OR DELETE ON markreg_matter_intelligence_review_commands
  FOR EACH ROW EXECUTE FUNCTION reject_markreg_audit_mutation();
'''
Path('infrastructure/persistence/migrations/0075_markreg_matter_intelligence_reviews.sql').write_text(migration)

p = Path('services/markreg/src/matter-intelligence-review.ts')
s = p.read_text()
s = replace_once(s, "  | 'REVIEW_ALREADY_EXISTS'\n", "  | 'SUPERSESSION_REQUIRED'\n  | 'SUPERSESSION_MISMATCH'\n", 'error code')
s = replace_once(s, '  version: 1;\n  workspaceId: string;', '  version: number;\n  workspaceId: string;', 'review version type')
s = replace_once(s, '  reasonCode: MatterIntelligenceReviewReasonCode;\n  rationale?: string;\n  reviewerPrincipalId:', '  reasonCode?: MatterIntelligenceReviewReasonCode;\n  rationale?: string;\n  supersedes?: Readonly<{ reviewId: MatterIntelligenceReviewId; version: number }>;\n  reviewerPrincipalId:', 'review fields')
s = replace_once(s, '  reasonCode: MatterIntelligenceReviewReasonCode;\n  rationale?: string;\n  principal:', '  reasonCode?: MatterIntelligenceReviewReasonCode;\n  rationale?: string;\n  supersedes?: Readonly<{ reviewId: MatterIntelligenceReviewId; version: number }>;\n  principal:', 'command fields')
s = replace_once(s, '    reasonCode: MatterIntelligenceReviewReasonCode;\n    rationale?: string;', '    reasonCode?: MatterIntelligenceReviewReasonCode;\n    rationale?: string;', 'match fields')
s = replace_once(s, '    if (version !== 1) return undefined;\n', '    if (!Number.isSafeInteger(version) || version < 1) return undefined;\n', 'find review version')
s = replace_once(s, '`SELECT * FROM markreg_matter_intelligence_reviews\n         WHERE workspace_id=$1 AND matter_intelligence_observation_id=$2`,', '`SELECT * FROM markreg_matter_intelligence_reviews\n         WHERE workspace_id=$1 AND matter_intelligence_observation_id=$2\n         ORDER BY review_version DESC LIMIT 1`,', 'latest review query')

start = s.index('  async record(value: Readonly<ReviewWrite>): Promise<MatterIntelligenceReviewDisposition> {')
end = s.index('\n  private mapObservation', start)
new_record = '''  async record(value: Readonly<ReviewWrite>): Promise<MatterIntelligenceReviewDisposition> {
    try {
      return await this.database.transact(
        async (client) => {
          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `matter-intelligence-review-command:${value.review.workspaceId}:${value.idempotencyKey}`
          ]);
          const replay = await client.query(
            `SELECT request_fingerprint_sha256,result_snapshot
             FROM markreg_matter_intelligence_review_commands
             WHERE workspace_id=$1 AND idempotency_key=$2 FOR UPDATE`,
            [value.review.workspaceId, value.idempotencyKey]
          );
          if (replay.rowCount) {
            const row = replay.rows[0] as Row;
            if (String(row.request_fingerprint_sha256) !== value.requestFingerprintSha256)
              throw new MatterIntelligenceReviewError(
                'IDEMPOTENCY_CONFLICT',
                'Idempotency-Key was already used for a different review command.'
              );
            return clone(row.result_snapshot as MatterIntelligenceReviewDisposition);
          }

          await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
            `matter-intelligence-review-observation:${value.review.workspaceId}:${value.review.reviewedObservation.id}`
          ]);
          const existingResult = await client.query(
            `SELECT * FROM markreg_matter_intelligence_reviews
             WHERE workspace_id=$1 AND matter_intelligence_observation_id=$2
             ORDER BY review_version DESC LIMIT 1 FOR UPDATE`,
            [value.review.workspaceId, value.review.reviewedObservation.id]
          );
          let review = value.review;
          let semanticDuplicate = false;
          let shouldInsert = true;
          if (existingResult.rowCount) {
            const existing = this.mapReview(existingResult.rows[0] as Row);
            const sameTruth =
              reviewMatchesCommand(existing, {
                outcome: value.review.outcome,
                reasonCode: value.review.reasonCode,
                rationale: value.review.rationale,
                reviewerPrincipalId: value.review.reviewerPrincipalId,
                reviewerMembershipId: value.review.reviewerMembershipId
              }) &&
              existing.reviewedObservation.fingerprintSha256 ===
                value.review.reviewedObservation.fingerprintSha256;
            if (sameTruth) {
              review = existing;
              semanticDuplicate = true;
              shouldInsert = false;
            } else {
              if (!value.review.supersedes)
                throw new MatterIntelligenceReviewError(
                  'SUPERSESSION_REQUIRED',
                  'A different review truth requires an explicit supersedes review ID/version.'
                );
              if (
                value.review.supersedes.reviewId !== existing.matterIntelligenceReviewId ||
                value.review.supersedes.version !== existing.version ||
                value.review.version !== existing.version + 1
              )
                throw new MatterIntelligenceReviewError(
                  'SUPERSESSION_MISMATCH',
                  'Supersession must reference the exact latest review ID/version.'
                );
            }
          } else if (value.review.supersedes || value.review.version !== 1) {
            throw new MatterIntelligenceReviewError(
              'SUPERSESSION_MISMATCH',
              'An initial review cannot supersede a missing prior review.'
            );
          }

          if (shouldInsert) {
            await client.query(
              `INSERT INTO markreg_matter_intelligence_reviews (
                 matter_intelligence_review_id,workspace_id,review_version,
                 formal_matter_id,formal_matter_version,matter_intelligence_observation_id,
                 observation_fingerprint_sha256,output_fingerprint_sha256,
                 outcome,reason_code,rationale,reviewer_principal_id,reviewer_membership_id,
                 reviewed_at,supersedes_review_id,supersedes_review_version,review_fingerprint_sha256
               ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
              [
                review.matterIntelligenceReviewId,
                review.workspaceId,
                review.version,
                review.formalMatter.id,
                review.formalMatter.version,
                review.reviewedObservation.id,
                review.reviewedObservation.fingerprintSha256,
                review.reviewedObservation.outputFingerprintSha256,
                review.outcome,
                review.reasonCode ?? null,
                review.rationale ?? null,
                review.reviewerPrincipalId,
                review.reviewerMembershipId,
                review.reviewedAt,
                review.supersedes?.reviewId ?? null,
                review.supersedes?.version ?? null,
                review.reviewFingerprintSha256
              ]
            );
          }

          const disposition: MatterIntelligenceReviewDisposition = {
            review,
            replayed: false,
            semanticDuplicate
          };
          await client.query(
            `INSERT INTO markreg_matter_intelligence_review_commands (
               workspace_id,idempotency_key,request_fingerprint_sha256,
               matter_intelligence_review_id,matter_intelligence_review_version,
               result_snapshot,correlation_id,created_at
             ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
            [
              review.workspaceId,
              value.idempotencyKey,
              value.requestFingerprintSha256,
              review.matterIntelligenceReviewId,
              review.version,
              JSON.stringify(disposition),
              value.correlationId,
              review.reviewedAt
            ]
          );
          return disposition;
        },
        { isolation: 'SERIALIZABLE' }
      );
    } catch (cause) {
      if (cause instanceof MatterIntelligenceReviewError) throw cause;
      throw this.persistenceError(cause);
    }
  }
'''
s = s[:start] + new_record + s[end:]
s = replace_once(s, '      version: 1,\n      workspaceId: String(row.workspace_id),', '      version: Number(row.review_version),\n      workspaceId: String(row.workspace_id),', 'map review version')
s = replace_once(s, '      reasonCode: String(row.reason_code) as MatterIntelligenceReviewReasonCode,\n      ...(row.rationale', "      ...(row.reason_code === null || row.reason_code === undefined\n        ? {}\n        : { reasonCode: String(row.reason_code) as MatterIntelligenceReviewReasonCode }),\n      ...(row.rationale", 'map optional reason')
s = replace_once(s, "      reviewedAt: timestamp(row.reviewed_at, 'reviewedAt'),\n      reviewFingerprintSha256:", "      reviewedAt: timestamp(row.reviewed_at, 'reviewedAt'),\n      ...(row.supersedes_review_id === null || row.supersedes_review_id === undefined\n        ? {}\n        : {\n            supersedes: {\n              reviewId: String(row.supersedes_review_id) as MatterIntelligenceReviewId,\n              version: Number(row.supersedes_review_version)\n            }\n          }),\n      reviewFingerprintSha256:", 'map supersedes')
s = replace_once(s, "    if (!(matterIntelligenceReviewReasonCodes as readonly string[]).includes(command.reasonCode))\n      throw new MatterIntelligenceReviewError('INVALID_INPUT', 'reasonCode is invalid.', 422);", "    if (\n      command.reasonCode !== undefined &&\n      !(matterIntelligenceReviewReasonCodes as readonly string[]).includes(command.reasonCode)\n    )\n      throw new MatterIntelligenceReviewError('INVALID_INPUT', 'reasonCode is invalid.', 422);", 'optional reason validation')
s = replace_once(s, '      reviewerMembershipId: principal.membershipId\n    });', '      reviewerMembershipId: principal.membershipId,\n      supersedes: command.supersedes\n    });', 'request fingerprint supersedes')
marker = '    const observationFingerprintSha256 = fingerprint(observation);\n    const reviewedAt = new Date(this.now()).toISOString();\n'
injected = '''    const observationFingerprintSha256 = fingerprint(observation);
    const latest = await this.repository.findReviewByObservation(workspace, observationId);
    const sameTruth =
      latest !== undefined &&
      reviewMatchesCommand(latest, {
        outcome: command.outcome,
        reasonCode: command.reasonCode,
        rationale,
        reviewerPrincipalId: principal.userId,
        reviewerMembershipId: principal.membershipId
      }) &&
      latest.reviewedObservation.fingerprintSha256 === observationFingerprintSha256;
    if (latest && !sameTruth) {
      if (!command.supersedes)
        throw new MatterIntelligenceReviewError(
          'SUPERSESSION_REQUIRED',
          'A different review truth requires an explicit supersedes review ID/version.'
        );
      if (
        command.supersedes.reviewId !== latest.matterIntelligenceReviewId ||
        command.supersedes.version !== latest.version
      )
        throw new MatterIntelligenceReviewError(
          'SUPERSESSION_MISMATCH',
          'Supersession must reference the exact latest review ID/version.'
        );
    } else if (!latest && command.supersedes) {
      throw new MatterIntelligenceReviewError(
        'SUPERSESSION_MISMATCH',
        'An initial review cannot supersede a missing prior review.'
      );
    }
    const version = latest ? (sameTruth ? latest.version : latest.version + 1) : 1;
    const supersedes = latest && !sameTruth ? command.supersedes : undefined;
    const reviewedAt = new Date(this.now()).toISOString();
'''
s = replace_once(s, marker, injected, 'service latest review decision')
s = replace_once(s, '      outcome: command.outcome,\n      reasonCode: command.reasonCode,\n      ...(rationale ? { rationale } : {}),', '      outcome: command.outcome,\n      ...(command.reasonCode ? { reasonCode: command.reasonCode } : {}),\n      ...(rationale ? { rationale } : {}),\n      ...(supersedes ? { supersedes } : {}),', 'review base')
s = replace_once(s, '      version: 1,\n      ...base,\n      reviewFingerprintSha256: fingerprint({ schemaVersion: 1, version: 1, ...base })', '      version,\n      ...base,\n      reviewFingerprintSha256: fingerprint({ schemaVersion: 1, version, ...base })', 'review version construction')
s = replace_once(s, "    if (version !== 1)\n      throw new MatterIntelligenceReviewError(\n        'REVIEW_NOT_FOUND',\n        'The exact Matter Intelligence review version was not found.',\n        404\n      );\n", "    if (!Number.isSafeInteger(version) || version < 1)\n      throw new MatterIntelligenceReviewError(\n        'REVIEW_NOT_FOUND',\n        'The exact Matter Intelligence review version was not found.',\n        404\n      );\n", 'resolve positive version')
s = replace_once(s, '          outcome: review.outcome,\n          reasonCode: review.reasonCode,\n          ...(review.rationale', '          outcome: review.outcome,\n          ...(review.reasonCode ? { reasonCode: review.reasonCode } : {}),\n          ...(review.rationale', 'source optional reason')
p.write_text(s)

h = Path('services/markreg/src/matter-intelligence-review-http.ts')
x = h.read_text()
x = replace_once(x, "const allowed = new Set(['outcome', 'reasonCode', 'rationale']);", "const allowed = new Set(['outcome', 'reasonCode', 'rationale', 'supersedes']);", 'HTTP allowed fields')
rationale_fn = '''function rationale(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 2000)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      'rationale must contain between 1 and 2000 characters when supplied.'
    );
  return value.trim();
}
'''
supersedes_fn = rationale_fn + '''
function supersedes(
  value: unknown
): { reviewId: `matter-intelligence-review_${string}`; version: number } | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_REQUEST', 'supersedes must be an object when supplied.');
  const item = value as Record<string, unknown>;
  if (Object.keys(item).sort().join(',') !== 'reviewId,version')
    throw new HttpError(400, 'INVALID_REQUEST', 'supersedes accepts only reviewId and version.');
  if (
    typeof item.reviewId !== 'string' ||
    !item.reviewId.startsWith('matter-intelligence-review_') ||
    !Number.isSafeInteger(item.version) ||
    Number(item.version) < 1
  )
    throw new HttpError(400, 'INVALID_REQUEST', 'supersedes reviewId/version are invalid.');
  return {
    reviewId: item.reviewId as `matter-intelligence-review_${string}`,
    version: Number(item.version)
  };
}
'''
x = replace_once(x, rationale_fn, supersedes_fn, 'HTTP supersedes parser')
old_reason = '''            reasonCode: enumValue(
              body.reasonCode,
              matterIntelligenceReviewReasonCodes,
              'reasonCode'
            ) as MatterIntelligenceReviewReasonCode,
            rationale: rationale(body.rationale),
'''
new_reason = '''            reasonCode:
              body.reasonCode === undefined
                ? undefined
                : (enumValue(
                    body.reasonCode,
                    matterIntelligenceReviewReasonCodes,
                    'reasonCode'
                  ) as MatterIntelligenceReviewReasonCode),
            rationale: rationale(body.rationale),
            supersedes: supersedes(body.supersedes),
'''
x = replace_once(x, old_reason, new_reason, 'HTTP command fields')
h.write_text(x)
