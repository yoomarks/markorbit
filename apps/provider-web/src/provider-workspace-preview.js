import { toProviderWorkItemViewModel } from './provider-work-model.js';
import { renderProviderWorkDetail, renderProviderWorkEmpty } from './provider-work-view.js';

const providerWorkspaceId = '018f0000-0000-7000-8000-000000004190';
const originWorkspaceId = '018f0000-0000-7000-8000-000000004191';
const now = '2026-10-06T09:30:00.000Z';

const privacyExclusions = Object.freeze({
  allocationRationaleIncluded: false,
  allocatorIdentityIncluded: false,
  supplyCapabilityContentsIncluded: false,
  servicePackageSourceSnapshotIncluded: false,
  providerAcceptanceAcknowledgementIncluded: false,
  providerReturnArtifactsIncluded: false,
  providerReturnAssertionsIncluded: false,
  endClientRelationshipInformationIncluded: false,
  endClientContactIncluded: false,
  originatingPricingMarginProfitIncluded: false,
  privateCrmContextIncluded: false,
  unrelatedCommunicationsIncluded: false,
  unrelatedAssetsOrMattersIncluded: false,
  rawPrivateEvidenceIncluded: false
});

const authorityConsequences = Object.freeze({
  createsProviderSelection: false,
  createsProviderAllocation: false,
  createsProviderAcceptance: false,
  createsProviderEngagement: false,
  createsProfessionalAppointment: false,
  authorizesExternalContact: false,
  authorizesProtectedActionRelease: false,
  authorizesFiling: false,
  submitsFiling: false,
  authorizesPayment: false,
  createsPayment: false,
  createsOfficialTruth: false,
  completesMatter: false
});

function rawItem(index, overrides = {}) {
  const suffix = String(51910 + index);
  return {
    schemaVersion: 1,
    provider: { providerId: 'provider_atlas-ip', providerWorkspaceId },
    allocation: {
      allocationId: `allocation_preview-${suffix}`,
      version: 3,
      status: 'ACTIVE',
      updatedAt: `2026-10-06T0${Math.max(1, 9 - index)}:10:00.000Z`
    },
    servicePackage: {
      servicePackage: { id: `service-package_preview-${suffix}`, version: 4 },
      servicePackageFingerprintSha256: String(index + 3).repeat(64)
    },
    origin: {
      originatingWorkspaceId: originWorkspaceId,
      professionalReference: [
        'Northstar IP · Madrid designation',
        'Aster Labs · UK renewal evidence',
        'Fieldnote Studio · AU classification review'
      ][index],
      exposureClass: 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY'
    },
    actionLineage: {
      correlationId: `correlation_provider-preview-${suffix}`,
      actionAuthorityNotGrantedByProjection: true
    },
    responseState: {
      kind: 'KNOWN_ABSENT',
      checkedAt: now,
      absenceScopeFingerprintSha256: 'c'.repeat(64),
      allocationActiveDoesNotImplyPendingResponse: true
    },
    returnState: {
      kind: 'KNOWN_ABSENT',
      checkedAt: now,
      absenceScopeFingerprintSha256: 'd'.repeat(64)
    },
    incomingDataAuthority: {
      state: index === 2 ? 'DENIED' : 'CURRENTLY_USABLE',
      ...(index === 2
        ? {
            denialReason: 'HANDOFF_EXPIRED',
            incomingFieldsVisible: false
          }
        : {
            handoff: { controlledHandoffId: `controlled-handoff_preview-${suffix}`, version: 1 },
            validationReference: `handoff-validation:preview-${suffix}`,
            validationFingerprintSha256: '9'.repeat(64),
            validationPolicyVersion: 'mgsn-controlled-handoff-validation-v1',
            currentExactProjectionMayBeResolvedSeparately: true
          }),
      checkedAt: now,
      embeddedPrivateFieldValues: false
    },
    sourceChecks: [],
    sourceSetFingerprintSha256: '5'.repeat(64),
    projectionFingerprintSha256: '6'.repeat(64),
    projectedAt: now,
    privacyExclusions,
    authorityConsequences,
    allocationIsExistingM4TruthNotCreatedByProjection: true,
    queuePresenceIsNotActionAuthority: true,
    ...overrides
  };
}

const acceptedState = {
  kind: 'KNOWN_RESPONSE',
  response: { id: 'provider-acceptance_preview-51911', version: 2 },
  decision: 'ACCEPTED',
  respondedAt: '2026-10-06T08:35:00.000Z',
  responseFingerprintSha256: '7'.repeat(64)
};

const fixtures = [
  rawItem(0),
  rawItem(1, { responseState: acceptedState }),
  rawItem(2, {
    responseState: {
      ...acceptedState,
      response: { id: 'provider-acceptance_preview-51912', version: 1 }
    },
    returnState: {
      kind: 'KNOWN_RETURN',
      providerReturn: { id: 'provider-return_preview-51912', version: 1 },
      status: 'CURRENT',
      submittedAt: '2026-10-06T08:20:00.000Z',
      returnFingerprintSha256: '8'.repeat(64),
      providerReturnRemainsClaimEvidenceNotOfficialTruth: true
    }
  })
];

const supportedScenarios = new Set([
  'queue',
  'loading',
  'empty',
  'unauthorized',
  'unavailable',
  'partial',
  'permission',
  'conflict',
  'terminal'
]);
const requestedScenario = new URL(window.location.href).searchParams.get('scenario')?.toLowerCase();
const scenario = supportedScenarios.has(requestedScenario) ? requestedScenario : 'queue';

let items = fixtures.map((item) => structuredClone(item));
if (scenario === 'partial') delete items[0].actionLineage;
if (scenario === 'terminal') {
  items = [
    rawItem(0, {
      allocation: { ...fixtures[0].allocation, status: 'SUPERSEDED', version: 4 },
      responseState: {
        kind: 'KNOWN_RESPONSE',
        response: { id: 'provider-acceptance_preview-51910', version: 1 },
        decision: 'DECLINED',
        respondedAt: now,
        responseFingerprintSha256: 'a'.repeat(64)
      }
    })
  ];
}
let selectedId = items[0]?.allocation.allocationId;
let currentReturns = new Map([
  [
    'allocation_preview-51912',
    {
      id: 'provider-return_preview-51912',
      version: 1,
      status: 'CURRENT',
      workStatusClaim: 'WORK_COMPLETED',
      artifacts: [{ reference: 'evidence://renewal-check/51912' }],
      assertions: [],
      submittedAt: '2026-10-06T08:20:00.000Z',
      truthBoundary: 'Provider-owned claim/evidence only; not Official Truth.'
    }
  ]
]);
let feedback;

function html(strings, ...values) {
  return strings.reduce((result, part, index) => result + part + (values[index] ?? ''), '');
}

const root = document.querySelector('#preview-root');
if (!(root instanceof HTMLElement)) throw new Error('Provider preview root is unavailable.');

root.innerHTML = html`
  <div class="provider-preview" data-scenario="${scenario}">
    <header class="preview-topbar">
      <a class="brand-lockup" href="#workspace-main" aria-label="MarkOrbit Provider Workspace home">
        <span class="brand-mark" aria-hidden="true">M</span>
        <span><strong>MarkOrbit</strong><small>Provider Workspace</small></span>
      </a>
      <div class="workspace-identity">
        <span class="live-dot" aria-hidden="true"></span>
        <span
          ><strong>Atlas IP Services</strong
          ><small>Provider Workspace · verified session</small></span
        >
        <span class="avatar" aria-hidden="true">AS</span>
      </div>
    </header>

    <aside class="preview-sidebar">
      <nav aria-label="Provider navigation">
        <a href="#overview"><span aria-hidden="true">⌂</span>Overview</a>
        <a class="active" href="#work" aria-current="page"
          ><span aria-hidden="true">▣</span>My work<span class="nav-count">${items.length}</span></a
        >
        <a href="#returns"><span aria-hidden="true">↗</span>Returns</a>
        <a href="#activity"><span aria-hidden="true">◷</span>Activity</a>
      </nav>
      <section class="sidebar-boundary" aria-labelledby="boundary-title">
        <span class="boundary-icon" aria-hidden="true">◎</span>
        <div>
          <strong id="boundary-title">Governed boundary</strong>
          <p>Actions require current Gateway, Core and MGSN authority.</p>
        </div>
      </section>
      <div class="sidebar-footer">
        <span aria-hidden="true">?</span><span>Help & governance</span>
      </div>
    </aside>

    <main id="workspace-main" class="preview-main">
      <div class="preview-banner" role="status">
        <strong>Preview fixture</strong>
        <span
          >Deterministic owner-backed states · no external contact, filing, payment or Official
          Truth</span
        >
      </div>
      <section class="page-heading">
        <div>
          <p class="page-kicker">Provider operations</p>
          <h1>My work</h1>
          <p>
            Review governed Allocations and record only the next action you are authorized to take.
          </p>
        </div>
        <button id="refresh-preview" class="preview-secondary" type="button">
          <span aria-hidden="true">↻</span> Refresh owner truth
        </button>
      </section>
      <section id="metrics" class="metrics" aria-label="Work queue summary"></section>
      <section class="workbench" aria-label="Provider workbench">
        <section class="queue-shell" aria-labelledby="queue-heading">
          <div class="queue-heading">
            <div>
              <p class="section-label">Owner-backed queue</p>
              <h2 id="queue-heading">Work requiring attention</h2>
            </div>
            <span id="queue-count"></span>
          </div>
          <div id="queue-surface"></div>
        </section>
        <section class="detail-shell" aria-labelledby="detail-heading">
          <h2 id="detail-heading" class="sr-only">Selected provider work detail</h2>
          <div id="detail-surface"></div>
        </section>
      </section>
    </main>
  </div>
`;

const metrics = root.querySelector('#metrics');
const queueSurface = root.querySelector('#queue-surface');
const queueCount = root.querySelector('#queue-count');
const detailSurface = root.querySelector('#detail-surface');
const refresh = root.querySelector('#refresh-preview');
if (
  !(metrics instanceof HTMLElement) ||
  !(queueSurface instanceof HTMLElement) ||
  !(queueCount instanceof HTMLElement) ||
  !(detailSurface instanceof HTMLElement) ||
  !(refresh instanceof HTMLButtonElement)
) {
  throw new Error('Provider preview shell is incomplete.');
}

function metric(label, value, detail, tone = '') {
  const card = document.createElement('article');
  card.className = `metric-card ${tone}`.trim();
  card.innerHTML = `<span>${label}</span><strong>${value}</strong><small>${detail}</small>`;
  return card;
}

function views() {
  return items.map((item) => toProviderWorkItemViewModel(item));
}

function updateMetrics(workItems) {
  const responseCount = workItems.filter((item) => item.task.kind === 'RESPONSE_REQUIRED').length;
  const returnCount = workItems.filter((item) => item.task.kind === 'RETURN_REQUIRED').length;
  const recorded = workItems.filter((item) => item.task.kind === 'RETURN_RECORDED').length;
  metrics.replaceChildren(
    metric(
      'Needs response',
      responseCount,
      'Explicit Accept or Decline',
      responseCount ? 'attention' : ''
    ),
    metric('Returns to prepare', returnCount, 'Claim + evidence required'),
    metric('Returns recorded', recorded, 'Claim evidence, not Official Truth'),
    metric('Workspace scope', '1', 'Your authorized queue only')
  );
}

function stateMeta(item) {
  if (item.task.kind === 'RESPONSE_REQUIRED') return ['Response required', 'amber'];
  if (item.task.kind === 'RETURN_REQUIRED') return ['Return required', 'blue'];
  if (item.task.kind === 'RETURN_RECORDED') return ['Return recorded', 'green'];
  if (item.task.kind === 'DECLINED') return ['Declined', 'neutral'];
  if (item.task.kind === 'ACTION_LINEAGE_UNAVAILABLE') return ['Action blocked', 'red'];
  return [item.task.heading, 'neutral'];
}

function renderQueue(workItems) {
  queueSurface.replaceChildren();
  queueCount.textContent = `${workItems.length} item${workItems.length === 1 ? '' : 's'}`;
  if (workItems.length === 0) {
    renderProviderWorkEmpty(
      queueSurface,
      'No provider work recorded',
      'This is a successful empty result from the authorized Workspace queue.'
    );
    return;
  }
  const list = document.createElement('ol');
  list.className = 'preview-work-list';
  list.setAttribute('aria-label', 'Provider work items');
  for (const item of workItems) {
    const [label, tone] = stateMeta(item);
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preview-work-item';
    button.dataset.selected = String(item.allocationId === selectedId);
    button.setAttribute('aria-pressed', String(item.allocationId === selectedId));
    button.innerHTML = html`
      <span class="work-card-top"
        ><span class="work-icon" aria-hidden="true">${label.startsWith('Return') ? 'R' : 'A'}</span
        ><span class="work-status ${tone}">${label}</span></span
      >
      <strong>${item.professionalReference}</strong>
      <span class="work-reference">${item.servicePackageId} · v${item.servicePackageVersion}</span>
      <span class="work-card-bottom"
        ><span>Updated ${item.updatedAt.slice(11, 16)} UTC</span
        ><span aria-hidden="true">→</span></span
      >
    `;
    button.addEventListener('click', () => {
      selectedId = item.allocationId;
      feedback = undefined;
      render();
    });
    row.append(button);
    list.append(row);
  }
  queueSurface.append(list);
}

function renderPassiveState(title, message, kind = 'empty') {
  updateMetrics([]);
  queueCount.textContent = '—';
  queueSurface.replaceChildren();
  detailSurface.replaceChildren();
  renderProviderWorkEmpty(queueSurface, title, message, kind);
  renderProviderWorkEmpty(detailSurface, 'No work item selected', message, kind);
}

function mutationFailure() {
  if (scenario === 'permission') {
    return {
      kind: 'error',
      title: 'Provider action permission denied',
      message: 'Your current Workspace membership can read this item but cannot record this action.'
    };
  }
  if (scenario === 'conflict') {
    return {
      kind: 'error',
      title: 'Work changed before submission',
      message:
        'The exact Allocation version is stale. Owner truth was refreshed; review before retrying.'
    };
  }
  return undefined;
}

function selectedRaw() {
  return items.find((item) => item.allocation.allocationId === selectedId);
}

async function onRespond({ decision, acknowledgement }) {
  const raw = selectedRaw();
  if (!raw) return;
  const failure = mutationFailure();
  if (failure) {
    feedback = failure;
    render();
    return;
  }
  const normalized = String(acknowledgement ?? '').trim();
  if (!normalized) return;
  raw.responseState = {
    kind: 'KNOWN_RESPONSE',
    response: { id: `provider-acceptance_${raw.allocation.allocationId}`, version: 1 },
    decision,
    respondedAt: now,
    responseFingerprintSha256: '7'.repeat(64)
  };
  if (decision === 'DECLINED') {
    raw.allocation = {
      ...raw.allocation,
      version: raw.allocation.version + 1,
      status: 'SUPERSEDED'
    };
  }
  feedback = {
    kind: 'success',
    title: 'Recorded by MGSN owner truth',
    message:
      decision === 'ACCEPTED'
        ? 'Acceptance recorded. A Provider Return may now be prepared against this exact lineage.'
        : 'Decline recorded. No Provider Return or replacement Allocation was created.'
  };
  render();
}

async function onReturn({ workStatusClaim, artifactText, assertionText, correction }) {
  const raw = selectedRaw();
  if (!raw) return;
  const failure = mutationFailure();
  if (failure) {
    feedback = failure;
    render();
    return;
  }
  const references = String(artifactText ?? '')
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !String(workStatusClaim ?? '').trim() ||
    (references.length === 0 && !String(assertionText ?? '').trim())
  ) {
    feedback = {
      kind: 'error',
      title: 'Return not submitted',
      message:
        'Record a work-status claim and at least one evidence reference or structured assertion.'
    };
    render();
    return;
  }
  const current = currentReturns.get(raw.allocation.allocationId);
  const version = correction && current ? current.version + 1 : 1;
  const returnId = current?.id ?? `provider-return_${raw.allocation.allocationId}`;
  const recorded = {
    id: returnId,
    version,
    status: 'CURRENT',
    workStatusClaim: String(workStatusClaim).trim(),
    artifacts: references.map((reference) => ({ reference })),
    assertions: [],
    submittedAt: now,
    truthBoundary: 'Provider-owned claim/evidence only; not Official Truth.'
  };
  currentReturns.set(raw.allocation.allocationId, recorded);
  raw.returnState = {
    kind: 'KNOWN_RETURN',
    providerReturn: { id: returnId, version },
    status: 'CURRENT',
    submittedAt: now,
    returnFingerprintSha256: '8'.repeat(64),
    providerReturnRemainsClaimEvidenceNotOfficialTruth: true
  };
  feedback = {
    kind: 'success',
    title: correction ? 'Correction recorded by MGSN' : 'Provider Return recorded by MGSN',
    message: correction
      ? `Version ${version} now supersedes the earlier claim. It is still not Official Truth.`
      : 'The claim and evidence references are ready for a separate Execution evidence handoff and review.'
  };
  render();
}

function renderDetail(workItems) {
  const selected = workItems.find((item) => item.allocationId === selectedId);
  if (!selected) {
    renderProviderWorkEmpty(
      detailSurface,
      'Select a work item',
      'Choose an owner-backed Allocation to review its exact state and available action.'
    );
    return;
  }
  renderProviderWorkDetail(detailSurface, selected, {
    currentReturn: currentReturns.get(selected.allocationId),
    feedback,
    pending: false,
    onRespond,
    onReturn
  });
}

function render() {
  if (scenario === 'loading') {
    renderPassiveState(
      'Loading authorized work',
      'Checking current owner truth and Workspace authority.'
    );
    queueSurface.classList.add('preview-loading');
    return;
  }
  if (scenario === 'empty') {
    renderPassiveState('No provider work recorded', 'This is a successful empty authorized queue.');
    return;
  }
  if (scenario === 'unauthorized') {
    renderPassiveState(
      'Provider Workspace access required',
      'Sign in with a current Provider Workspace membership to view this queue.',
      'error'
    );
    return;
  }
  if (scenario === 'unavailable') {
    renderPassiveState(
      'Owner source temporarily unavailable',
      'No queue or response state is inferred. Retry when MGSN owner truth is available.',
      'error'
    );
    return;
  }
  const workItems = views();
  updateMetrics(workItems);
  renderQueue(workItems);
  renderDetail(workItems);
}

refresh.addEventListener('click', () => {
  feedback = {
    kind: 'success',
    title: 'Owner truth refreshed',
    message:
      'Exact Allocation, response, Return and incoming-data authority references were rechecked.'
  };
  render();
});

render();
