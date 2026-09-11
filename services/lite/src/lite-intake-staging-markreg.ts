import { encodeInternalWorkspacePrincipal, type WorkspacePrincipal } from '@markorbit/contracts';
import {
  parseProductionIntakeV1,
  type CreateProductionIntakeCommandV1,
  type ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  LiteIntakeProductionIntakeClientError,
  type LiteIntakeProductionIntakeClient
} from './lite-intake-staging.js';

interface Fetcher {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

export class HttpLiteIntakeProductionIntakeClient implements LiteIntakeProductionIntakeClient {
  constructor(
    private readonly markRegUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: Fetcher = fetch
  ) {}

  async create(
    principal: Readonly<WorkspacePrincipal>,
    command: Readonly<CreateProductionIntakeCommandV1>
  ): Promise<Readonly<ProductionIntakeV1>> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.markRegUrl.replace(/\/$/u, '')}/internal/v1/production-intakes`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret,
            'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
            'x-markorbit-workspace-id': principal.workspaceId,
            'idempotency-key': command.idempotencyKey,
            'x-correlation-id': command.correlationId
          },
          body: JSON.stringify({
            schemaVersion: command.schemaVersion,
            channel: command.channel,
            relationshipModel: command.relationshipModel,
            input: command.input,
            correlationId: command.correlationId
          })
        }
      );
    } catch (cause) {
      throw new LiteIntakeProductionIntakeClientError(
        'MarkReg Production Intake request outcome is uncertain.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        code?: unknown;
        message?: unknown;
      };
      const code =
        typeof payload.code === 'string' && payload.code.trim()
          ? payload.code.trim()
          : 'MARKREG_PRODUCTION_INTAKE_FAILED';
      const message =
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message.trim()
          : `HTTP ${response.status}`;
      throw new LiteIntakeProductionIntakeClientError(
        `${code}: ${message}`,
        response.status >= 500
      );
    }

    const payload = (await response.json().catch(() => undefined)) as
      { intake?: unknown } | undefined;
    if (!payload?.intake)
      throw new LiteIntakeProductionIntakeClientError(
        'MarkReg Production Intake response did not include intake evidence.',
        true
      );
    try {
      return parseProductionIntakeV1(payload.intake);
    } catch (cause) {
      throw new LiteIntakeProductionIntakeClientError(
        'MarkReg Production Intake response failed contract validation.',
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
}
