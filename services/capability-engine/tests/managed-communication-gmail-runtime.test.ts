import { describe, expect, it, vi } from 'vitest';
import {
  createGmailManagedCommunicationSenderFromEnvironmentV1,
  GMAIL_CLIENT_ID_ENV,
  GMAIL_CLIENT_SECRET_ENV,
  GMAIL_REFRESH_TOKEN_ENV
} from '../src/managed-communication-gmail-runtime.js';

function enabledEnvironment(): NodeJS.ProcessEnv {
  return {
    MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED: '1',
    MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED: '1',
    MO_MANAGED_COMMUNICATION_WORKSPACE_ID: 'workspace-live-gmail',
    MO_MANAGED_COMMUNICATION_ACCOUNT_REF: 'account-live-gmail',
    MO_MANAGED_COMMUNICATION_PROVIDER: 'GMAIL',
    MO_MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF: 'markorbit.test@gmail.com',
    [GMAIL_CLIENT_ID_ENV]: 'client-id.apps.googleusercontent.com',
    [GMAIL_CLIENT_SECRET_ENV]: 'client-secret-test-only',
    [GMAIL_REFRESH_TOKEN_ENV]: 'refresh-token-test-only'
  };
}

describe('Gmail Managed Communication production runtime wiring', () => {
  it('stays absent while Managed Communication dispatch is not explicitly authorized', () => {
    const fetchImpl = vi.fn();
    const environment = enabledEnvironment();
    environment.MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED = '0';
    delete environment[GMAIL_CLIENT_ID_ENV];
    delete environment[GMAIL_CLIENT_SECRET_ENV];
    delete environment[GMAIL_REFRESH_TOKEN_ENV];

    expect(
      createGmailManagedCommunicationSenderFromEnvironmentV1(environment, fetchImpl)
    ).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([GMAIL_CLIENT_ID_ENV, GMAIL_CLIENT_SECRET_ENV, GMAIL_REFRESH_TOKEN_ENV])(
    'fails closed when %s is missing under authorized dispatch',
    (name) => {
      const environment = enabledEnvironment();
      delete environment[name];
      expect(() =>
        createGmailManagedCommunicationSenderFromEnvironmentV1(environment, vi.fn())
      ).toThrow(`${name} is required`);
    }
  );

  it('fails closed for an authorized non-Gmail provider', () => {
    const environment = enabledEnvironment();
    environment.MO_MANAGED_COMMUNICATION_PROVIDER = 'SMTP';
    expect(() =>
      createGmailManagedCommunicationSenderFromEnvironmentV1(environment, vi.fn())
    ).toThrow('currently supports only provider GMAIL');
  });

  it('constructs the Gmail sender without any OAuth or Gmail network request', () => {
    const fetchImpl = vi.fn();
    const sender = createGmailManagedCommunicationSenderFromEnvironmentV1(
      enabledEnvironment(),
      fetchImpl as unknown as typeof globalThis.fetch
    );
    expect(sender).toBeDefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
