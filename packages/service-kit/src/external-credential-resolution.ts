/** Server-internal transport only. Never expose this shape through a browser or public Gateway. */
export interface ExternalCredentialResolutionRequestWireV1 {
  callerService: 'CAPABILITY_ENGINE';
  credential: Readonly<{
    owner: 'CORE_IDENTITY';
    credentialBindingId: `external-credential-binding_${string}`;
    version: number;
  }>;
  expectedWorkspaceId: string;
  expectedProvider: string;
  expectedExternalAccountRef: string;
  expectedSecretKind: 'API_KEY' | 'STATIC_BEARER' | 'BASIC';
  requiredCapabilityId: string;
  requiredCapabilityVersion: string;
  implementationProfileId: string;
  implementationProfileVersion: number;
  correlationId: string;
  approvedUsage: 'APPROVED_PROVIDER_ADAPTER_AUTHENTICATION';
}

export type ResolvedExternalCredentialSecretWireV1 =
  | Readonly<{ kind: 'API_KEY'; keyId?: string; secret: string }>
  | Readonly<{ kind: 'STATIC_BEARER'; token: string }>
  | Readonly<{ kind: 'BASIC'; username: string; password: string }>;

/** Ephemeral sensitive response. It is not evidence, business truth, or execution authority. */
export interface ResolvedExternalCredentialWireV1 {
  schemaVersion: 1;
  credentialBindingId: string;
  bindingVersion: number;
  secret: Readonly<ResolvedExternalCredentialSecretWireV1>;
  createsProviderSelectionAuthority: false;
  createsImplementationSelectionAuthority: false;
  createsExecutionAuthority: false;
  authorizesProtectedAction: false;
}
