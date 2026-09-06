import { createProviderWorkClient, ProviderWorkClientError } from './provider-work-api.js';
import {
  parseProviderReturnBody,
  parseProviderWorkDetailBody,
  parseProviderWorkListBody,
  ProviderWorkModelError
} from './provider-work-model.js';
import {
  renderProviderWorkDetail,
  renderProviderWorkEmpty,
  renderProviderWorkQueue
} from './provider-work-view.js';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement))
  throw new Error('Provider Workspace root element is unavailable');
root.dataset.runtime = 'provider-workspace-own-work';
root.dataset.productMode = 'action-console';

const workspaceForm = document.querySelector('#workspace-form');
const workspaceIdInput = document.querySelector('#workspace-id');
const status = document.querySelector('#status');
const workspace = document.querySelector('#workspace');
const queueState = document.querySelector('#queue-state');
const queueList = document.querySelector('#queue-list');
const detail = document.querySelector('#detail');
const refreshQueue = document.querySelector('#refresh-queue');
const loadMore = document.querySelector('#load-more');
if (
  !(workspaceForm instanceof HTMLFormElement) ||
  !(workspaceIdInput instanceof HTMLInputElement) ||
  !(status instanceof HTMLElement) ||
  !(workspace instanceof HTMLElement) ||
  !(queueState instanceof HTMLElement) ||
  !(queueList instanceof HTMLOListElement) ||
  !(detail instanceof HTMLElement) ||
  !(refreshQueue instanceof HTMLButtonElement) ||
  !(loadMore instanceof HTMLButtonElement)
) {
  throw new Error('Provider Workspace UI is incomplete');
}

let client;
let nextCursor;
let items = [];
let selectedAllocationId;
let selectedItem;
let selectedCurrentReturn;
let feedback;
let pendingAction;
const attemptKeys = new Map();

function setStatus(message, kind = 'info') {
  status.textContent = message;
  status.dataset.kind = kind;
}
function sessionValue(key) {
  try {
    return globalThis.sessionStorage?.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function storeSessionValue(key, value) {
  try {
    globalThis.sessionStorage?.setItem(key, value);
  } catch {
    // Session storage is only browser convenience; Gateway remains the authority owner.
  }
}

function stableAttempt(kind, payload) {
  const signature = `${kind}:${JSON.stringify(payload)}`;
  const existing = attemptKeys.get(signature);
  if (existing) return { signature, key: existing };
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const key = `provider-web-${kind}-${suffix}`;
  attemptKeys.set(signature, key);
  return { signature, key };
}

function clearAttempt(signature) {
  attemptKeys.delete(signature);
}
function knownError(error) {
  return error instanceof ProviderWorkClientError || error instanceof ProviderWorkModelError;
}

function renderQueue() {
  renderProviderWorkQueue(queueList, items, selectedAllocationId, loadDetail);
  queueState.replaceChildren();
  if (items.length === 0) {
    renderProviderWorkEmpty(
      queueState,
      'No provider work recorded.',
      'This is a successful empty queue, not a source failure.'
    );
  }
  loadMore.hidden = !nextCursor;
}

function renderSelected() {
  if (!selectedItem) return;
  renderProviderWorkDetail(detail, selectedItem, {
    currentReturn: selectedCurrentReturn,
    feedback,
    pending: Boolean(pendingAction),
    onRespond: submitResponse,
    onReturn: submitReturn
  });
}
function failClosed(error, surface) {
  const message = knownError(error)
    ? error.message
    : 'Provider work could not be safely displayed.';
  setStatus(message, 'error');
  if (surface === 'queue') {
    items = [];
    renderQueue();
    renderProviderWorkEmpty(queueState, 'Queue unavailable.', message, 'error');
    workspace.hidden = false;
    return;
  }
  selectedItem = undefined;
  selectedCurrentReturn = undefined;
  renderProviderWorkEmpty(
    detail,
    error?.code === 'NOT_FOUND_OR_NOT_AUTHORIZED'
      ? 'Work item unavailable.'
      : 'Detail unavailable.',
    message,
    'error'
  );
}

async function loadQueue({ append = false, preserveSelection = false, quiet = false } = {}) {
  if (!client) return;
  if (!quiet) setStatus(append ? 'Loading more provider work...' : 'Loading provider work...');
  refreshQueue.disabled = true;
  loadMore.disabled = true;
  try {
    const body = await client.list({
      limit: 25,
      ...(append && nextCursor ? { cursor: nextCursor } : {})
    });
    const parsed = parseProviderWorkListBody(body);
    items = append ? [...items, ...parsed.items] : parsed.items;
    nextCursor = parsed.nextCursor;
    if (!preserveSelection) {
      selectedAllocationId = undefined;
      selectedItem = undefined;
      selectedCurrentReturn = undefined;
      feedback = undefined;
      renderProviderWorkEmpty(
        detail,
        'Select a work item',
        'Choose a governed Allocation to review its current owner-backed state.'
      );
    }
    renderQueue();
    workspace.hidden = false;
    if (!quiet) {
      setStatus(
        items.length === 0
          ? 'Provider work loaded: empty queue.'
          : `Provider work loaded: ${items.length} item${items.length === 1 ? '' : 's'}.`,
        'success'
      );
    }
  } catch (error) {
    if (!append) items = [];
    failClosed(error, 'queue');
  } finally {
    refreshQueue.disabled = false;
    loadMore.disabled = false;
  }
}

async function loadCurrentReturn(item) {
  if (item.providerReturn.state !== 'KNOWN_RETURN') return undefined;
  try {
    const body = await client.providerReturn(item.providerReturn.id, item.providerReturn.version);
    return parseProviderReturnBody(body);
  } catch (error) {
    setStatus(
      knownError(error)
        ? `Work loaded, but submitted Return history is unavailable: ${error.message}`
        : 'Work loaded, but submitted Return history is unavailable.',
      'error'
    );
    return undefined;
  }
}

async function loadDetail(allocationId, { quiet = false, preserveFeedback = false } = {}) {
  if (!client) return;
  selectedAllocationId = allocationId;
  renderQueue();
  if (!quiet) setStatus(`Loading ${allocationId}...`);
  detail.className = 'detail-loading';
  detail.textContent = 'Loading exact owner-backed work item...';
  try {
    const body = await client.detail(allocationId);
    const item = parseProviderWorkDetailBody(body);
    if (item.allocationId !== allocationId) {
      throw new ProviderWorkModelError('Detail Allocation identity changed in transit.');
    }
    selectedItem = item;
    selectedCurrentReturn = await loadCurrentReturn(item);
    if (!preserveFeedback) feedback = undefined;
    renderSelected();
    if (!quiet) setStatus(`Loaded ${allocationId}.`, 'success');
  } catch (error) {
    failClosed(error, 'detail');
  }
}

function artifactReferences(value) {
  return String(value ?? '')
    .split(/\r?\n/u)
    .map((reference) => reference.trim())
    .filter(Boolean)
    .map((reference) => ({ reference }));
}

function structuredAssertions(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return [];
  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new ProviderWorkClientError(
      'INVALID_ASSERTIONS',
      'Structured assertions must be a valid JSON array.'
    );
  }
  if (!Array.isArray(parsed)) {
    throw new ProviderWorkClientError(
      'INVALID_ASSERTIONS',
      'Structured assertions must be a JSON array.'
    );
  }
  return parsed.map((assertion) => {
    if (!assertion || typeof assertion !== 'object' || Array.isArray(assertion)) {
      throw new ProviderWorkClientError('INVALID_ASSERTIONS', 'Each assertion must be an object.');
    }
    if (typeof assertion.code !== 'string' || !assertion.code.trim()) {
      throw new ProviderWorkClientError('INVALID_ASSERTIONS', 'Each assertion needs a code.');
    }
    const valueType = typeof assertion.value;
    if (assertion.value !== null && !['string', 'number', 'boolean'].includes(valueType)) {
      throw new ProviderWorkClientError(
        'INVALID_ASSERTIONS',
        'Assertion value must be a string, number, boolean, or null.'
      );
    }
    const evidenceReferences = assertion.evidenceReferences ?? [];
    if (
      !Array.isArray(evidenceReferences) ||
      evidenceReferences.some((reference) => typeof reference !== 'string')
    ) {
      throw new ProviderWorkClientError(
        'INVALID_ASSERTIONS',
        'Assertion evidenceReferences must be a string array.'
      );
    }
    return {
      code: assertion.code.trim(),
      value: assertion.value,
      evidenceReferences: evidenceReferences.map((reference) => reference.trim()).filter(Boolean)
    };
  });
}

async function refreshSelectedOwnerTruth({ preserveFeedback = true } = {}) {
  if (!selectedAllocationId) return;
  const allocationId = selectedAllocationId;
  await loadQueue({ preserveSelection: true, quiet: true });
  await loadDetail(allocationId, { quiet: true, preserveFeedback });
}

async function runMutation(kind, payload, action, successMessage) {
  if (pendingAction || !selectedItem) return;
  const attempt = stableAttempt(kind, payload);
  pendingAction = kind;
  feedback = undefined;
  renderSelected();
  setStatus('Submitting through the governed Provider route...');
  try {
    await action(attempt.key);
    clearAttempt(attempt.signature);
    feedback = {
      kind: 'success',
      title: 'Recorded by owner service',
      message: `${successMessage} Reloaded current owner truth before updating this screen.`
    };
    await refreshSelectedOwnerTruth({ preserveFeedback: true });
    setStatus(successMessage, 'success');
  } catch (error) {
    const message = knownError(error)
      ? error.message
      : 'The Provider action could not be recorded.';
    const stale = error?.status === 409;
    feedback = {
      kind: 'error',
      title: stale ? 'Work changed before submission' : 'Action not recorded',
      message: stale
        ? `${message} Current owner truth was refreshed; review it before trying again.`
        : message
    };
    if (stale) {
      clearAttempt(attempt.signature);
      await refreshSelectedOwnerTruth({ preserveFeedback: true });
    } else {
      renderSelected();
    }
    setStatus(message, 'error');
  } finally {
    pendingAction = undefined;
    renderSelected();
  }
}

async function submitResponse({ decision, acknowledgement }) {
  if (!selectedItem) return;
  const payload = { decision, acknowledgement: String(acknowledgement ?? '').trim() };
  await runMutation(
    'response',
    payload,
    (idempotencyKey) => client.respond(selectedItem, { ...payload, idempotencyKey }),
    decision === 'DECLINED'
      ? 'Provider response recorded: declined.'
      : 'Provider response recorded: accepted.'
  );
}

async function submitReturn({ workStatusClaim, artifactText, assertionText, correction }) {
  if (!selectedItem) return;
  try {
    const artifacts = artifactReferences(artifactText);
    const assertions = structuredAssertions(assertionText);
    const supersedes = correction
      ? { id: selectedItem.providerReturn.id, version: selectedItem.providerReturn.version }
      : undefined;
    const payload = {
      workStatusClaim: String(workStatusClaim ?? '').trim(),
      artifacts,
      assertions,
      ...(supersedes ? { supersedes } : {})
    };
    await runMutation(
      correction ? 'return-correction' : 'return',
      payload,
      (idempotencyKey) =>
        client.submitReturn(selectedItem, {
          ...payload,
          idempotencyKey
        }),
      correction ? 'Provider Return correction recorded.' : 'Provider Return recorded.'
    );
  } catch (error) {
    const message = knownError(error)
      ? error.message
      : 'Return evidence could not be parsed safely.';
    feedback = { kind: 'error', title: 'Return not submitted', message };
    renderSelected();
    setStatus(message, 'error');
  }
}

workspaceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    client = createProviderWorkClient({
      workspaceId: workspaceIdInput.value,
      csrfToken: sessionValue('markorbit-csrf-token')
    });
    storeSessionValue('markorbit-provider-workspace-id', client.workspaceId);
    workspaceIdInput.value = client.workspaceId;
    items = [];
    nextCursor = undefined;
    selectedAllocationId = undefined;
    selectedItem = undefined;
    selectedCurrentReturn = undefined;
    feedback = undefined;
    pendingAction = undefined;
    attemptKeys.clear();
    void loadQueue();
  } catch (error) {
    workspace.hidden = true;
    failClosed(error, 'queue');
  }
});

refreshQueue.addEventListener('click', () => void loadQueue());
loadMore.addEventListener('click', () => void loadQueue({ append: true }));

const rememberedWorkspace = sessionValue('markorbit-provider-workspace-id');
if (rememberedWorkspace) workspaceIdInput.value = rememberedWorkspace;
