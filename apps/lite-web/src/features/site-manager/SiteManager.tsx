import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  SiteConfigurationVersionV1,
  SiteHostBindingV1,
  SiteInstallationV1
} from '@markorbit/contracts/site';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import {
  createSiteManagerClient,
  SiteManagerHttpError,
  type SiteManagerClient,
  type SiteManagerConfigurationInput
} from '../../api/site-manager.js';
import './site-manager.css';

export interface SiteManagerProps {
  workspaceId: string;
  client?: SiteManagerClient;
}

type ReadyState = Readonly<{
  sites: readonly SiteInstallationV1[];
  installation: SiteInstallationV1;
  configuration: SiteConfigurationVersionV1;
  bindings: readonly SiteHostBindingV1[];
  bindingsUnavailable: boolean;
}>;

type ViewState =
  | { kind: 'LOADING' }
  | { kind: 'EMPTY' }
  | { kind: 'ERROR'; error: SiteManagerHttpError }
  | ({ kind: 'READY' } & ReadyState);

const conflictCodes = new Set(['CONFLICT', 'IDEMPOTENCY_KEY_REUSE']);
const colorPattern = /^#[0-9a-f]{6}$/iu;

function configurationInput(
  configuration: SiteConfigurationVersionV1,
  workspaceId: string
): SiteManagerConfigurationInput {
  return {
    brand: structuredClone(configuration.brand),
    localization: structuredClone(configuration.localization),
    roles: structuredClone(configuration.roles),
    services: structuredClone(configuration.services),
    contentSlots: structuredClone(configuration.contentSlots),
    ...(configuration.attributionPolicyRef
      ? { attributionPolicyRef: structuredClone(configuration.attributionPolicyRef) }
      : {}),
    sourceRef: `lite:site-manager:${workspaceId}`
  };
}

function list(value: string): readonly string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function idempotencyKey(action: string, siteId: string): string {
  const id =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `site-manager:${action}:${siteId}:${id}`;
}

function errorOf(error: unknown, fallback: string): SiteManagerHttpError {
  return error instanceof SiteManagerHttpError
    ? error
    : new SiteManagerHttpError(503, 'SITE_RUNTIME_UNAVAILABLE', fallback, true);
}

function exactRef(ref: Readonly<{ id: string; version: number }> | undefined): string {
  return ref ? `${ref.id} / v${ref.version}` : 'Not configured';
}

export function SiteManager({ workspaceId, client }: SiteManagerProps) {
  const activeClient = useMemo(
    () => client ?? createSiteManagerClient(workspaceId),
    [client, workspaceId]
  );
  const [state, setState] = useState<ViewState>({ kind: 'LOADING' });
  const [draft, setDraft] = useState<SiteManagerConfigurationInput>();
  const [saving, setSaving] = useState('');
  const [mutationError, setMutationError] = useState<SiteManagerHttpError>();
  const [status, setStatus] = useState('');
  const [activeRevisionAcknowledged, setActiveRevisionAcknowledged] = useState(false);
  const [hostname, setHostname] = useState('');
  const [bindingType, setBindingType] = useState<SiteHostBindingV1['bindingType']>('PRIMARY');
  const [verificationMethod, setVerificationMethod] =
    useState<SiteHostBindingV1['verificationMethod']>('DNS_TXT');
  const [suspendReason, setSuspendReason] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const load = useCallback(
    async (preferredSiteId?: string) => {
      setState({ kind: 'LOADING' });
      setMutationError(undefined);
      try {
        const sites = await activeClient.list();
        if (!sites.length) {
          setState({ kind: 'EMPTY' });
          setDraft(undefined);
          return;
        }
        const installation =
          sites.find((candidate) => candidate.siteId === preferredSiteId) ?? sites[0]!;
        const configuration = await activeClient.configuration(installation.siteId);
        let bindings: readonly SiteHostBindingV1[] = [];
        let bindingsUnavailable = false;
        try {
          bindings = await activeClient.hostBindings(installation.siteId);
        } catch {
          bindingsUnavailable = true;
        }
        setDraft(configurationInput(configuration, workspaceId));
        setActiveRevisionAcknowledged(false);
        setPreviewOpen(false);
        setState({
          kind: 'READY',
          sites,
          installation,
          configuration,
          bindings,
          bindingsUnavailable
        });
      } catch (error) {
        setState({
          kind: 'ERROR',
          error: errorOf(error, 'Site management state could not be loaded.')
        });
      }
    },
    [activeClient, workspaceId]
  );

  useEffect(() => void load(), [load]);

  const runMutation = async (
    action: string,
    work: () => Promise<unknown>,
    success: string
  ): Promise<boolean> => {
    if (state.kind !== 'READY') return false;
    setSaving(action);
    setMutationError(undefined);
    setStatus('');
    try {
      await work();
      await load(state.installation.siteId);
      setStatus(success);
      return true;
    } catch (error) {
      setMutationError(errorOf(error, 'The Site command could not be completed.'));
      return false;
    } finally {
      setSaving('');
    }
  };

  if (state.kind === 'LOADING') return <LoadingState label="Loading Site Manager" />;
  if (state.kind === 'EMPTY')
    return (
      <>
        <PageHeader
          title="Site Manager"
          description="Workspace-owned external service-commerce projection"
          actions={<Badge>Owner-backed</Badge>}
        />
        <EmptyState
          title="No Site installation is provisioned"
          description="A governed SITE product installation and owner configuration must exist before Lite can manage a Site. Lite does not manufacture installation, merchant, fulfillment, or customer ownership truth."
        />
      </>
    );
  if (state.kind === 'ERROR') {
    const permission = [401, 403].includes(state.error.status);
    return (
      <ErrorState
        title={permission ? 'Site Manager permission required' : 'Site Manager unavailable'}
        description={state.error.message}
        {...(state.error.retryable ? { onRetry: () => void load() } : {})}
      />
    );
  }

  const { installation, configuration, bindings, sites } = state;
  const activeBinding = bindings.find((binding) => binding.status === 'ACTIVE');
  const locales =
    draft?.localization.supportedLocales ?? configuration.localization.supportedLocales;
  const invalidDraft =
    !draft ||
    !draft.brand.displayName.trim() ||
    !colorPattern.test(draft.brand.theme.primaryColor) ||
    !colorPattern.test(draft.brand.theme.accentColor) ||
    !draft.localization.defaultMarket.trim() ||
    !locales.length ||
    !locales.includes(draft.localization.defaultLocale);
  const saveRequiresAcknowledgement = installation.lifecycle === 'ACTIVE';
  const canSave =
    !invalidDraft && (!saveRequiresAcknowledgement || activeRevisionAcknowledged) && !saving;

  const updateService = (
    index: number,
    update: (
      service: SiteConfigurationVersionV1['services'][number]
    ) => SiteConfigurationVersionV1['services'][number]
  ) => {
    if (!draft) return;
    setDraft({
      ...draft,
      services: draft.services.map((service, serviceIndex) =>
        serviceIndex === index ? update(service) : service
      )
    });
  };

  return (
    <div className="site-manager">
      <PageHeader
        title="Site Manager"
        description="Manage the Workspace projection without moving Customer, Quote, Order, Matter, Payment, Provider, or professional identity truth into Lite."
        actions={
          <div className="site-manager__header-actions">
            <Badge>
              {installation.kind === 'MARKREG_REFERENCE'
                ? 'MarkReg reference'
                : 'Workspace branded'}
            </Badge>
            <Badge>{installation.lifecycle}</Badge>
            <Button variant="secondary" onClick={() => setPreviewOpen((value) => !value)}>
              {previewOpen ? 'Hide projection preview' : 'Preview current projection'}
            </Button>
            {installation.lifecycle === 'ACTIVE' && activeBinding ? (
              <a
                className="site-manager__open-link"
                href={`https://${activeBinding.normalizedHostname}`}
                target="_blank"
                rel="noreferrer"
              >
                Open Site
              </a>
            ) : null}
          </div>
        }
      />

      <Alert title="Site authority boundary">
        Branding and service visibility configure the external projection only. They do not verify a
        provider, guarantee fulfillment, create a Customer, publish a Quote, authorize Payment, or
        grant a protected action. Domain verification must come from governed verification evidence.
      </Alert>

      {mutationError && conflictCodes.has(mutationError.code) ? (
        <Alert tone="warning" title="Site state changed">
          {mutationError.message} Reload current owner state before another mutation.{' '}
          <Button variant="secondary" onClick={() => void load(installation.siteId)}>
            Reload current state
          </Button>
        </Alert>
      ) : mutationError ? (
        <Alert
          tone={mutationError.status >= 500 ? 'warning' : 'danger'}
          title="Site command was not saved"
        >
          {mutationError.message}
        </Alert>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
      {state.bindingsUnavailable ? (
        <Alert tone="warning" title="Domain state unavailable">
          Current configuration is owner-backed, but host bindings could not be read. No domain,
          verification, activation, or preview state is inferred.
        </Alert>
      ) : null}

      {previewOpen ? (
        <Card className="site-manager__preview">
          <div className="site-manager__section-heading">
            <div>
              <h2>Current durable projection preview</h2>
              <p>
                This renders the owner-backed configuration currently stored for the Site.
                Previewing does not publish, activate a host, create a customer, quote, payment, or
                provider action.
              </p>
            </div>
            <Badge>Preview only / config v{configuration.version}</Badge>
          </div>
          <div
            className="site-manager__preview-surface"
            style={{ borderTopColor: configuration.brand.theme.primaryColor }}
            aria-label="Current durable Site projection preview"
          >
            <div className="site-manager__preview-brand">
              <span
                className="site-manager__preview-accent"
                style={{ backgroundColor: configuration.brand.theme.accentColor }}
                aria-hidden="true"
              />
              <div>
                <strong>{configuration.brand.displayName}</strong>
                <small>
                  {configuration.localization.defaultLocale} /{' '}
                  {configuration.localization.defaultMarket}
                </small>
              </div>
            </div>
            <p>
              {configuration.services.filter((service) => service.visibility === 'PUBLIC').length}{' '}
              public service projection(s) / {configuration.contentSlots.length} governed content
              slot(s)
            </p>
          </div>
        </Card>
      ) : null}

      {sites.length > 1 ? (
        <Select
          label="Site installation"
          value={installation.siteId}
          onChange={(event) => void load(event.target.value)}
        >
          {sites.map((site) => (
            <option key={site.siteId} value={site.siteId}>
              {site.siteId} / {site.lifecycle}
            </option>
          ))}
        </Select>
      ) : null}

      <div className="site-manager__summary-grid">
        <Card>
          <h2>Exact owner state</h2>
          <KeyValueList
            items={[
              { key: 'Site', value: installation.siteId },
              { key: 'Site version', value: String(installation.version) },
              { key: 'Configuration version', value: String(configuration.version) },
              { key: 'Lifecycle', value: installation.lifecycle },
              {
                key: 'Core SITE installation',
                value: `${installation.coreSiteInstallationRef.installationId} / v${installation.coreSiteInstallationRef.version}`
              },
              { key: 'Recorded', value: installation.recordedAt }
            ]}
          />
        </Card>
        <Card>
          <h2>Ownership references</h2>
          <KeyValueList
            items={[
              { key: 'Surface owner', value: configuration.roles.surfaceOwnerWorkspaceId },
              {
                key: 'Customer relationship owner',
                value: configuration.roles.customerRelationshipWorkspaceId
              },
              { key: 'Offer owner', value: configuration.roles.offerOwnerRef },
              { key: 'Merchant owner', value: configuration.roles.merchantOwnerRef },
              { key: 'Fulfillment owner', value: configuration.roles.fulfillmentOwnerRef },
              {
                key: 'Referral source',
                value: configuration.roles.referralSourceRef ?? 'Not configured'
              }
            ]}
          />
        </Card>
      </div>

      {draft ? (
        <Card className="site-manager__configuration">
          <div className="site-manager__section-heading">
            <div>
              <h2>Brand and market projection</h2>
              <p>Saving creates one new immutable Site configuration version.</p>
            </div>
            <Badge>Current config v{configuration.version}</Badge>
          </div>
          <div className="site-manager__form-grid">
            <TextInput
              label="Display name"
              value={draft.brand.displayName}
              onChange={(event) =>
                setDraft({ ...draft, brand: { ...draft.brand, displayName: event.target.value } })
              }
            />
            <TextInput
              label="Logo asset reference"
              value={draft.brand.logoAssetRef ?? ''}
              readOnly
              hint="Read-only until a governed asset picker is available."
            />
            <TextInput
              label="Primary color"
              value={draft.brand.theme.primaryColor}
              error={
                colorPattern.test(draft.brand.theme.primaryColor)
                  ? undefined
                  : 'Use a six-digit hex color.'
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  brand: {
                    ...draft.brand,
                    theme: { ...draft.brand.theme, primaryColor: event.target.value }
                  }
                })
              }
            />
            <TextInput
              label="Accent color"
              value={draft.brand.theme.accentColor}
              error={
                colorPattern.test(draft.brand.theme.accentColor)
                  ? undefined
                  : 'Use a six-digit hex color.'
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  brand: {
                    ...draft.brand,
                    theme: { ...draft.brand.theme, accentColor: event.target.value }
                  }
                })
              }
            />
            <Select
              label="Color mode"
              value={draft.brand.theme.colorMode}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  brand: {
                    ...draft.brand,
                    theme: {
                      ...draft.brand.theme,
                      colorMode: event.target
                        .value as SiteConfigurationVersionV1['brand']['theme']['colorMode']
                    }
                  }
                })
              }
            >
              <option value="LIGHT">Light</option>
              <option value="DARK">Dark</option>
              <option value="SYSTEM">System</option>
            </Select>
            <TextInput
              label="Supported locales"
              value={draft.localization.supportedLocales.join(', ')}
              hint="Comma-separated BCP 47 locale tags."
              onChange={(event) =>
                setDraft({
                  ...draft,
                  localization: {
                    ...draft.localization,
                    supportedLocales: list(event.target.value)
                  }
                })
              }
            />
            <Select
              label="Default locale"
              value={draft.localization.defaultLocale}
              error={
                locales.includes(draft.localization.defaultLocale)
                  ? undefined
                  : 'Choose a supported locale.'
              }
              onChange={(event) =>
                setDraft({
                  ...draft,
                  localization: { ...draft.localization, defaultLocale: event.target.value }
                })
              }
            >
              {locales.map((locale) => (
                <option key={locale} value={locale}>
                  {locale}
                </option>
              ))}
            </Select>
            <TextInput
              label="Default market"
              value={draft.localization.defaultMarket}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  localization: { ...draft.localization, defaultMarket: event.target.value }
                })
              }
            />
            <TextInput
              label="Jurisdictions"
              value={draft.localization.jurisdictions.join(', ')}
              hint="Comma-separated owner-backed jurisdiction codes."
              onChange={(event) =>
                setDraft({
                  ...draft,
                  localization: { ...draft.localization, jurisdictions: list(event.target.value) }
                })
              }
            />
          </div>

          <div className="site-manager__services">
            <h3>Service visibility and fulfillment</h3>
            {draft.services.length ? (
              draft.services.map((service, index) => {
                const networkPolicy = service.fulfillment.policyRef;
                return (
                  <section
                    className="site-manager__service-row"
                    key={`${service.productRef.productId}:${service.productRef.version}`}
                  >
                    <div>
                      <strong>{service.productRef.productId}</strong>
                      <p>
                        MarkReg product v{service.productRef.version} / {service.channel} /{' '}
                        {service.relationshipModel}
                      </p>
                      <small>
                        Pricing:{' '}
                        {service.pricingPolicyRefs.length
                          ? service.pricingPolicyRefs.map(exactRef).join(', ')
                          : 'No pricing policy ref'}
                      </small>
                    </div>
                    <Select
                      label={`Visibility for ${service.productRef.productId}`}
                      value={service.visibility}
                      onChange={(event) =>
                        updateService(index, (current) => ({
                          ...current,
                          visibility: event.target.value as 'PUBLIC' | 'HIDDEN'
                        }))
                      }
                    >
                      <option value="PUBLIC">Public</option>
                      <option value="HIDDEN">Hidden</option>
                    </Select>
                    <Select
                      label={`Fulfillment for ${service.productRef.productId}`}
                      value={service.fulfillment.mode}
                      onChange={(event) => {
                        const mode = event.target
                          .value as SiteConfigurationVersionV1['services'][number]['fulfillment']['mode'];
                        updateService(index, (current) => ({
                          ...current,
                          fulfillment:
                            mode === 'GOVERNED_NETWORK_POLICY' && networkPolicy
                              ? { mode, policyRef: networkPolicy }
                              : {
                                  mode:
                                    mode === 'GOVERNED_NETWORK_POLICY'
                                      ? current.fulfillment.mode
                                      : mode,
                                  ...(mode === current.fulfillment.mode &&
                                  current.fulfillment.policyRef
                                    ? { policyRef: current.fulfillment.policyRef }
                                    : {})
                                }
                        }));
                      }}
                    >
                      <option value="SELF">Workspace / self</option>
                      <option value="MARKREG">MarkReg</option>
                      {networkPolicy ? (
                        <option value="GOVERNED_NETWORK_POLICY">Governed network policy</option>
                      ) : null}
                    </Select>
                  </section>
                );
              })
            ) : (
              <p>No service availability entries are configured. Nothing is inferred.</p>
            )}
          </div>

          {saveRequiresAcknowledgement ? (
            <Alert tone="warning" title="Active Site configuration becomes Draft on revision">
              The Site owner deliberately returns a revised active Site to DRAFT. Saving does not
              automatically reactivate or republish it.
              <Checkbox
                label="I understand this revision requires a separate activation step."
                checked={activeRevisionAcknowledged}
                onChange={(event) => setActiveRevisionAcknowledged(event.target.checked)}
              />
            </Alert>
          ) : null}
          <div className="site-manager__actions">
            <Button
              disabled={!canSave}
              onClick={() =>
                void runMutation(
                  'save-configuration',
                  () =>
                    activeClient.reviseConfiguration(
                      installation.siteId,
                      installation.version,
                      draft,
                      idempotencyKey('configuration', installation.siteId)
                    ),
                  'New Site configuration version saved. Current owner state was reloaded.'
                )
              }
            >
              {saving === 'save-configuration' ? 'Saving...' : 'Save configuration version'}
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="site-manager__section-heading">
          <div>
            <h2>Domain and host bindings</h2>
            <p>
              Verification status is read from the Site owner; Lite never self-verifies a domain.
            </p>
          </div>
          <Badge>{state.bindingsUnavailable ? 'Unavailable' : `${bindings.length} current`}</Badge>
        </div>
        {!state.bindingsUnavailable ? (
          <>
            {bindings.length ? (
              <div className="site-manager__binding-list">
                {bindings.map((binding) => (
                  <section key={binding.bindingId} className="site-manager__binding-row">
                    <div>
                      <strong>{binding.normalizedHostname}</strong>
                      <p>
                        {binding.bindingType} / {binding.verificationMethod} / v{binding.version}
                      </p>
                    </div>
                    <Badge>{binding.status}</Badge>
                    {binding.status === 'PENDING_VERIFICATION' ? (
                      <small>
                        Waiting for governed verification evidence. Lite does not offer a manual
                        ?mark verified? action.
                      </small>
                    ) : null}
                    {binding.status === 'VERIFIED' ? (
                      <Button
                        disabled={Boolean(saving)}
                        onClick={() =>
                          void runMutation(
                            `activate:${binding.bindingId}`,
                            () =>
                              activeClient.activate(
                                installation.siteId,
                                installation.version,
                                binding.bindingId,
                                binding.version,
                                idempotencyKey('activate', installation.siteId)
                              ),
                            `${binding.normalizedHostname} activated from verified owner state.`
                          )
                        }
                      >
                        Activate verified host
                      </Button>
                    ) : null}
                  </section>
                ))}
              </div>
            ) : (
              <p>No host binding exists for this Site.</p>
            )}

            <div className="site-manager__binding-form">
              <TextInput
                label="Hostname"
                value={hostname}
                placeholder="brand.example.com"
                onChange={(event) => setHostname(event.target.value)}
              />
              <Select
                label="Binding type"
                value={bindingType}
                onChange={(event) =>
                  setBindingType(event.target.value as SiteHostBindingV1['bindingType'])
                }
              >
                <option value="PRIMARY">Primary</option>
                <option value="ALIAS">Alias</option>
                <option value="TEST">Test</option>
              </Select>
              <Select
                label="Verification method"
                value={verificationMethod}
                onChange={(event) =>
                  setVerificationMethod(
                    event.target.value as SiteHostBindingV1['verificationMethod']
                  )
                }
              >
                <option value="DNS_TXT">DNS TXT</option>
                <option value="HTTP_TOKEN">HTTP token</option>
                <option value="PLATFORM_MANAGED">Platform managed</option>
              </Select>
              <Button
                disabled={
                  !hostname.trim() || Boolean(saving) || installation.lifecycle === 'DECOMMISSIONED'
                }
                onClick={() =>
                  void runMutation(
                    'create-binding',
                    () =>
                      activeClient.createHostBinding(
                        installation.siteId,
                        installation.version,
                        { hostname, bindingType, verificationMethod },
                        idempotencyKey('host-binding', installation.siteId)
                      ),
                    'Pending host binding created. Verification remains a separate governed step.'
                  ).then((saved) => {
                    if (saved) setHostname('');
                  })
                }
              >
                {saving === 'create-binding' ? 'Adding...' : 'Add pending binding'}
              </Button>
            </div>
          </>
        ) : null}
      </Card>

      {installation.lifecycle === 'ACTIVE' ? (
        <Card>
          <h2>Suspend active Site</h2>
          <p>
            Suspension is explicit and does not rewrite commercial, customer, or fulfillment truth.
          </p>
          <div className="site-manager__binding-form">
            <TextInput
              label="Suspension reason reference"
              value={suspendReason}
              placeholder="operator:planned-maintenance"
              onChange={(event) => setSuspendReason(event.target.value)}
            />
            <Button
              variant="danger"
              disabled={!suspendReason.trim() || Boolean(saving)}
              onClick={() =>
                void runMutation(
                  'suspend',
                  () =>
                    activeClient.suspend(
                      installation.siteId,
                      installation.version,
                      suspendReason,
                      idempotencyKey('suspend', installation.siteId)
                    ),
                  'Site suspended by explicit Workspace action.'
                ).then((saved) => {
                  if (saved) setSuspendReason('');
                })
              }
            >
              {saving === 'suspend' ? 'Suspending...' : 'Suspend Site'}
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="site-manager__summary-grid">
        <Card>
          <h2>Content and attribution</h2>
          <p>
            Attribution policy: <strong>{exactRef(configuration.attributionPolicyRef)}</strong>
          </p>
          {configuration.contentSlots.length ? (
            <ul className="site-manager__compact-list">
              {configuration.contentSlots.map((slot) => (
                <li key={`${slot.slot}:${slot.route}:${slot.locale}`}>
                  <strong>{slot.title}</strong>
                  <span>
                    {slot.route} / {slot.locale} / {exactRef(slot.publishPackageRef)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No published content-slot references are configured.</p>
          )}
        </Card>
        <Card>
          <h2>SEO / GEO projection status</h2>
          <Badge>Not exposed by Site owner V1</Badge>
          <p>
            No SEO/GEO readiness, index status, ranking, publication success, or content health is
            inferred from Site configuration. A future owner-backed status can be added here without
            turning Lite into a second truth store.
          </p>
        </Card>
      </div>
    </div>
  );
}
