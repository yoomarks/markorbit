import { createProviderWorkClient, ProviderWorkClientError } from './provider-work-api.js';
import {
  parseProviderWorkDetailBody,
  parseProviderWorkListBody,
  ProviderWorkModelError
} from './provider-work-model.js';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement))
  throw new Error('Provider Workspace root element is unavailable');
root.dataset.runtime = 'provider-workspace-own-work';

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

function setStatus(message, kind = 'info') {
  status.textContent = message;
  status.dataset.kind = kind;
}

function safeText(value) {
  return document.createTextNode(String(value));
}

function stateBlock(title, state, detailText) {
  const block = document.createElement('section');
  block.className = 'state-block';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.dataset.state = state;
  badge.textContent = state.replaceAll('_', ' ');
  const body = document.createElement('p');
  body.textContent = detailText;
  block.append(heading, badge, body);
  return block;
}

function renderDetailItem(item) {
  detail.replaceChildren();
  detail.className = 'detail-content';

  const heading = document.createElement('div');
  heading.className = 'detail-heading';
  const title = document.createElement('h3');
  title.append('Allocation ', safeText(item.allocationId));
  const meta = document.createElement('p');
  meta.className = 'muted';
  meta.textContent = `v${item.allocationVersion} · ${item.allocationStatus} · updated ${item.updatedAt}`;
  heading.append(title, meta);

  const facts = document.createElement('dl');
  facts.className = 'facts';
  for (const [label, value] of [
    ['Service Package', `${item.servicePackageId} · v${item.servicePackageVersion}`],
    ['Originating professional', item.professionalReference]
  ]) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    facts.append(dt, dd);
  }

  const states = document.createElement('div');
  states.className = 'state-grid';
  states.append(
    stateBlock(
      'Provider response',
      item.response.state,
      `${item.response.label}. ${item.response.detail}`
    ),
    stateBlock(
      'Provider Return',
      item.providerReturn.state,
      `${item.providerReturn.label}. ${item.providerReturn.detail}`
    ),
    stateBlock(
      'Incoming data',
      item.incoming.state,
      `${item.incoming.label}. ${item.incoming.detail}`
    )
  );

  const boundary = document.createElement('p');
  boundary.className = 'detail-boundary';
  boundary.textContent =
    'Read-only projection. References do not grant artifact retrieval, mutation, contact, filing, payment, or Official Truth authority.';

  detail.append(heading, facts, states, boundary);
}

function renderQueue() {
  queueList.replaceChildren();
  queueState.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML =
      '<strong>No provider work recorded.</strong><span>This is a successful empty queue, not a source failure.</span>';
    queueState.append(empty);
  }

  for (const item of items) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'work-item';
    button.dataset.selected = String(item.allocationId === selectedAllocationId);
    button.setAttribute('aria-pressed', String(item.allocationId === selectedAllocationId));
    button.dataset.allocationId = item.allocationId;

    const top = document.createElement('span');
    top.className = 'work-item-top';
    const id = document.createElement('strong');
    id.textContent = item.allocationId;
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.dataset.state = item.allocationStatus;
    badge.textContent = item.allocationStatus;
    top.append(id, badge);

    const origin = document.createElement('span');
    origin.className = 'muted';
    origin.textContent = item.professionalReference;
    const state = document.createElement('span');
    state.className = 'work-item-state';
    state.textContent = `${item.response.label} · ${item.providerReturn.label}`;
    button.append(top, origin, state);
    button.addEventListener('click', () => void loadDetail(item.allocationId));
    li.append(button);
    queueList.append(li);
  }

  loadMore.hidden = !nextCursor;
}

function failClosed(error, surface) {
  const known = error instanceof ProviderWorkClientError || error instanceof ProviderWorkModelError;
  const message = known ? error.message : 'Provider work could not be safely displayed.';
  setStatus(message, 'error');
  if (surface === 'queue') {
    queueList.replaceChildren();
    queueState.innerHTML = `<div class="error-state"><strong>Queue unavailable.</strong><span>${message}</span></div>`;
  } else {
    detail.className = 'error-state';
    detail.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent =
      error?.code === 'NOT_FOUND_OR_NOT_AUTHORIZED'
        ? 'Work item unavailable.'
        : 'Detail unavailable.';
    const text = document.createElement('span');
    text.textContent = message;
    detail.append(strong, text);
  }
}

async function loadQueue({ append = false } = {}) {
  if (!client) return;
  setStatus(append ? 'Loading more provider work…' : 'Loading provider work…');
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
    if (!append) selectedAllocationId = undefined;
    renderQueue();
    workspace.hidden = false;
    setStatus(
      items.length === 0
        ? 'Provider work loaded: empty queue.'
        : `Provider work loaded: ${items.length} item${items.length === 1 ? '' : 's'}.`,
      'success'
    );
  } catch (error) {
    if (!append) items = [];
    failClosed(error, 'queue');
    workspace.hidden = false;
  } finally {
    refreshQueue.disabled = false;
    loadMore.disabled = false;
  }
}

async function loadDetail(allocationId) {
  if (!client) return;
  selectedAllocationId = allocationId;
  renderQueue();
  detail.className = 'detail-loading';
  detail.textContent = 'Loading exact work item…';
  setStatus(`Loading ${allocationId}…`);
  try {
    const body = await client.detail(allocationId);
    const item = parseProviderWorkDetailBody(body);
    if (item.allocationId !== allocationId)
      throw new ProviderWorkModelError('Detail Allocation identity changed in transit.');
    renderDetailItem(item);
    setStatus(`Loaded ${allocationId}.`, 'success');
  } catch (error) {
    failClosed(error, 'detail');
  }
}

workspaceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    client = createProviderWorkClient({ workspaceId: workspaceIdInput.value });
    items = [];
    nextCursor = undefined;
    selectedAllocationId = undefined;
    detail.className = 'detail-empty';
    detail.textContent = 'Select a work item to inspect its bounded read-only projection.';
    void loadQueue();
  } catch (error) {
    workspace.hidden = true;
    failClosed(error, 'queue');
  }
});

refreshQueue.addEventListener('click', () => void loadQueue());
loadMore.addEventListener('click', () => void loadQueue({ append: true }));
