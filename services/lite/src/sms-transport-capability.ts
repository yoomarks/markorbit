import type {
  MaterializedSmsTransportV1,
  SmsTransportProviderV1,
  SmsTransportSubmissionResultV1
} from './sms-transport.js';

const MESSAGE_SID = /^SM[0-9a-fA-F]{32}$/u;
const REASON = /^[A-Z0-9_]{1,120}$/u;

type JsonObject = Record<string, unknown>;

function record(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function parseResult(value: unknown): SmsTransportSubmissionResultV1 | undefined {
  const item = record(value);
  if (!item || typeof item.status !== 'string') return undefined;
  if (item.status === 'ACCEPTED') {
    if (
      Object.keys(item).some((key) => !['status', 'providerSubmissionRef'].includes(key)) ||
      typeof item.providerSubmissionRef !== 'string' ||
      !MESSAGE_SID.test(item.providerSubmissionRef)
    )
      return undefined;
    return { status: 'ACCEPTED', providerSubmissionRef: item.providerSubmissionRef };
  }
  if (item.status === 'FAILED' || item.status === 'UNKNOWN') {
    if (
      Object.keys(item).some((key) => !['status', 'reasonCode'].includes(key)) ||
      typeof item.reasonCode !== 'string' ||
      !REASON.test(item.reasonCode)
    )
      return undefined;
    return { status: item.status, reasonCode: item.reasonCode };
  }
  return undefined;
}

/**
 * Lite-side transport shim only. It does not resolve credentials or select providers.
 * The trusted Capability Engine adapter owns JIT credential use and Twilio HTTP.
 */
export class HttpCapabilityTwilioSmsTransportV1 implements SmsTransportProviderV1 {
  constructor(
    private readonly capabilityEngineUrl: string,
    private readonly internalServiceSecret: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly timeoutMs = 8_000
  ) {}

  async submit(
    materialized: Readonly<MaterializedSmsTransportV1>
  ): Promise<SmsTransportSubmissionResultV1> {
    let response: Response;
    try {
      response = await this.fetcher(
        `${this.capabilityEngineUrl.replace(/\/$/u, '')}/internal/v1/channel-sms/twilio/submit`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-markorbit-internal-authorization': this.internalServiceSecret
          },
          body: JSON.stringify({ materialized }),
          signal: AbortSignal.timeout(this.timeoutMs)
        }
      );
    } catch {
      return { status: 'UNKNOWN', reasonCode: 'TRANSPORT_BRIDGE_AMBIGUOUS' };
    }

    if (!response.ok) {
      if (response.status >= 400 && response.status < 500)
        return { status: 'FAILED', reasonCode: 'TRANSPORT_BRIDGE_REJECTED' };
      return { status: 'UNKNOWN', reasonCode: 'TRANSPORT_BRIDGE_AMBIGUOUS' };
    }
    const parsed = parseResult(await response.json().catch(() => undefined));
    return parsed ?? { status: 'UNKNOWN', reasonCode: 'TRANSPORT_BRIDGE_AMBIGUOUS' };
  }
}
