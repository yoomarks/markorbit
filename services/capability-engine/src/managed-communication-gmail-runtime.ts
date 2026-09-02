import {
  MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV,
  resolveManagedCommunicationRuntimeConfigV1
} from './managed-communication-bootstrap.js';
import {
  GMAIL_MANAGED_COMMUNICATION_PROVIDER,
  GmailManagedCommunicationClientV1,
  GmailManagedCommunicationSenderV1
} from './managed-communication-gmail.js';

export const GMAIL_CLIENT_ID_ENV = 'MO_MANAGED_COMMUNICATION_GMAIL_CLIENT_ID' as const;
export const GMAIL_CLIENT_SECRET_ENV = 'MO_MANAGED_COMMUNICATION_GMAIL_CLIENT_SECRET' as const;
export const GMAIL_REFRESH_TOKEN_ENV = 'MO_MANAGED_COMMUNICATION_GMAIL_REFRESH_TOKEN' as const;

function required(environment: NodeJS.ProcessEnv, name: string, maximum: number): string {
  const value = environment[name]?.trim();
  if (!value || value.length > maximum) {
    throw new Error(`${name} is required and must contain 1 to ${maximum} characters.`);
  }
  return value;
}

export function createGmailManagedCommunicationSenderFromEnvironmentV1(
  environment: NodeJS.ProcessEnv,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch
): GmailManagedCommunicationSenderV1 | undefined {
  const runtime = resolveManagedCommunicationRuntimeConfigV1(environment);
  if (!runtime || !runtime.providerDispatchAuthorized) return undefined;

  if (runtime.provider !== GMAIL_MANAGED_COMMUNICATION_PROVIDER) {
    throw new Error(
      `${MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED_ENV}=1 currently supports only provider ${GMAIL_MANAGED_COMMUNICATION_PROVIDER}.`
    );
  }

  const client = new GmailManagedCommunicationClientV1(
    {
      clientId: required(environment, GMAIL_CLIENT_ID_ENV, 10_000),
      clientSecret: required(environment, GMAIL_CLIENT_SECRET_ENV, 20_000),
      refreshToken: required(environment, GMAIL_REFRESH_TOKEN_ENV, 20_000),
      providerAccountRef: runtime.providerAccountRef
    },
    fetchImpl
  );

  return new GmailManagedCommunicationSenderV1(client);
}
