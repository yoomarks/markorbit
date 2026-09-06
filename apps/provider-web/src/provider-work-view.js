function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function badge(state, text = state) {
  const node = element('span', 'badge', text.replaceAll('_', ' '));
  node.dataset.state = state;
  return node;
}

function descriptionList(rows, className = 'facts') {
  const list = element('dl', className);
  for (const [label, value] of rows) {
    const term = element('dt', '', label);
    const description = element('dd', '', value);
    list.append(term, description);
  }
  return list;
}

function stateLine(title, state, label, detail) {
  const block = element('section', 'state-block');
  const top = element('div', 'state-block-top');
  top.append(element('h4', '', title), badge(state));
  block.append(top, element('strong', '', label), element('p', '', detail));
  return block;
}
function feedbackBlock(feedback) {
  if (!feedback) return undefined;
  const block = element('div', 'action-feedback');
  block.dataset.kind = feedback.kind ?? 'info';
  block.setAttribute('role', feedback.kind === 'error' ? 'alert' : 'status');
  block.append(
    element('strong', '', feedback.title ?? 'Action update'),
    element('span', '', feedback.message)
  );
  return block;
}

function responseForm(item, { pending, onRespond }) {
  const form = element('form', 'action-form');
  form.setAttribute('aria-label', 'Provider response');
  const label = element('label', '', 'Acknowledgement');
  label.htmlFor = 'provider-acknowledgement';
  const input = element('textarea', 'text-area');
  input.id = 'provider-acknowledgement';
  input.name = 'acknowledgement';
  input.rows = 3;
  input.required = true;
  input.placeholder = 'Record the short human acknowledgement for this Allocation.';
  const actions = element('div', 'action-buttons');
  const accept = element('button', '', 'Accept allocation');
  accept.type = 'submit';
  accept.name = 'decision';
  accept.value = 'ACCEPTED';
  accept.disabled = pending;
  const decline = element('button', 'secondary', 'Decline allocation');
  decline.type = 'submit';
  decline.name = 'decision';
  decline.value = 'DECLINED';
  decline.disabled = pending;
  actions.append(accept, decline);
  form.append(label, input, actions);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const submitter = event.submitter;
    const decision = submitter instanceof HTMLButtonElement ? submitter.value : '';
    void onRespond({ decision, acknowledgement: input.value });
  });
  return form;
}

function returnForm(item, { currentReturn, pending, onReturn }) {
  const correction = item.task.canCorrectReturn;
  const form = element('form', 'action-form');
  form.setAttribute(
    'aria-label',
    correction ? 'Correct Provider Return' : 'Submit Provider Return'
  );
  const statusLabel = element('label', '', 'Work status claim');
  statusLabel.htmlFor = 'provider-work-status';
  const statusInput = element('input', 'text-input');
  statusInput.id = 'provider-work-status';
  statusInput.required = true;
  statusInput.value = currentReturn?.workStatusClaim ?? 'WORK_COMPLETED';
  const artifactLabel = element('label', '', 'Evidence references');
  artifactLabel.htmlFor = 'provider-artifacts';
  const artifactInput = element('textarea', 'text-area');
  artifactInput.id = 'provider-artifacts';
  artifactInput.rows = 4;
  artifactInput.placeholder = 'One governed evidence reference per line';
  artifactInput.value = currentReturn?.artifacts?.map((entry) => entry.reference).join('\n') ?? '';
  const advanced = element('details', 'advanced-fields');
  advanced.append(element('summary', '', 'Structured assertions (optional)'));
  const assertionLabel = element('label', '', 'Assertions JSON array');
  assertionLabel.htmlFor = 'provider-assertions';
  const assertionInput = element('textarea', 'text-area code-input');
  assertionInput.id = 'provider-assertions';
  assertionInput.rows = 5;
  assertionInput.placeholder = '[{"code":"...","value":"...","evidenceReferences":[]}]';
  assertionInput.value = currentReturn?.assertions?.length
    ? JSON.stringify(currentReturn.assertions, null, 2)
    : '';
  advanced.append(assertionLabel, assertionInput);
  const submit = element(
    'button',
    '',
    correction ? 'Submit Return correction' : 'Submit Provider Return'
  );
  submit.type = 'submit';
  submit.disabled = pending;
  form.append(statusLabel, statusInput, artifactLabel, artifactInput, advanced, submit);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void onReturn({
      workStatusClaim: statusInput.value,
      artifactText: artifactInput.value,
      assertionText: assertionInput.value,
      correction
    });
  });
  return form;
}
function currentStateSection(item) {
  const section = element('section', 'detail-section current-state');
  section.append(element('p', 'section-kicker', 'Current state'));
  const headingRow = element('div', 'section-heading-row');
  headingRow.append(element('h3', '', item.task.heading), badge(item.allocationStatus));
  section.append(headingRow, element('p', 'section-copy', item.task.detail));
  return section;
}

function attentionSection(item, options) {
  const section = element('section', 'detail-section attention-section');
  section.append(element('p', 'section-kicker', 'Needs attention'));
  const feedback = feedbackBlock(options.feedback);
  if (feedback) section.append(feedback);

  if (item.task.canRespond) {
    section.append(
      element('h3', '', 'Review and record a response'),
      element(
        'p',
        'section-copy',
        'This is an explicit Provider response, not appointment or filing authority.'
      ),
      responseForm(item, options)
    );
    return section;
  }
  if (item.task.canSubmitReturn || item.task.canCorrectReturn) {
    section.append(
      element(
        'h3',
        '',
        item.task.canCorrectReturn ? 'Correct the current claim' : 'Prepare your Return'
      ),
      element(
        'p',
        'section-copy',
        'A Provider Return is claim/evidence only and never becomes Official Truth by submission.'
      ),
      returnForm(item, options)
    );
    return section;
  }
  section.append(
    element('h3', '', item.task.heading),
    element('p', 'section-copy', item.task.detail)
  );
  return section;
}
function safeContextSection(item) {
  const section = element('section', 'detail-section');
  section.append(
    element('p', 'section-kicker', 'Minimum safe context'),
    element('h3', '', 'Bounded work context'),
    descriptionList([
      ['Originating professional', item.professionalReference],
      ['Incoming-data authority', item.incoming.label]
    ]),
    stateLine('Incoming data', item.incoming.state, item.incoming.label, item.incoming.detail)
  );
  const note = element('p', 'detail-boundary');
  note.textContent =
    'Reference visibility does not grant artifact retrieval, customer contact, filing, payment, or protected-action authority.';
  section.append(note);
  return section;
}

function historySection(item, currentReturn) {
  const details = element('details', 'history-details');
  const summary = element('summary', '', 'History and submitted claim');
  details.append(summary);
  const states = element('div', 'state-grid');
  states.append(
    stateLine('Provider response', item.response.state, item.response.label, item.response.detail),
    stateLine(
      'Provider Return',
      item.providerReturn.state,
      item.providerReturn.label,
      item.providerReturn.detail
    )
  );
  details.append(states);
  if (currentReturn) {
    const claim = element('section', 'submitted-claim');
    claim.append(
      element('h4', '', 'Previously submitted'),
      descriptionList(
        [
          ['Work status claim', currentReturn.workStatusClaim],
          ['Submitted', currentReturn.submittedAt],
          ['Evidence references', String(currentReturn.artifacts.length)],
          ['Structured assertions', String(currentReturn.assertions.length)]
        ],
        'facts compact-facts'
      ),
      element('p', 'detail-boundary', currentReturn.truthBoundary)
    );
    details.append(claim);
  }
  return details;
}
function provenanceSection(item) {
  const details = element('details', 'provenance-details');
  details.append(element('summary', '', 'Technical provenance'));
  details.append(
    descriptionList(
      [
        ['Allocation', `${item.allocationId} · v${item.allocationVersion}`],
        ['Allocation updated', item.updatedAt],
        ['Originating Workspace', item.originatingWorkspaceId],
        ['Service Package', `${item.servicePackageId} · v${item.servicePackageVersion}`],
        ['Correlation', item.actionLineage?.correlationId ?? 'Unavailable']
      ],
      'facts compact-facts'
    )
  );
  const boundary = element('p', 'detail-boundary');
  boundary.textContent =
    'The read projection supplies exact lineage references only. Gateway + Core + MGSN still establish current mutation authority.';
  details.append(boundary);
  return details;
}

export function renderProviderWorkQueue(list, items, selectedAllocationId, onSelect) {
  list.replaceChildren();
  for (const item of items) {
    const row = element('li');
    const button = element('button', 'work-item');
    button.type = 'button';
    button.dataset.selected = String(item.allocationId === selectedAllocationId);
    button.setAttribute('aria-pressed', String(item.allocationId === selectedAllocationId));
    const top = element('span', 'work-item-top');
    top.append(element('strong', '', item.professionalReference), badge(item.allocationStatus));
    button.append(
      top,
      element('span', 'work-item-state', item.task.heading),
      element('span', 'muted', item.allocationId)
    );
    button.addEventListener('click', () => void onSelect(item.allocationId));
    row.append(button);
    list.append(row);
  }
}
export function renderProviderWorkDetail(
  container,
  item,
  { currentReturn, feedback, pending = false, onRespond, onReturn }
) {
  container.replaceChildren();
  container.className = 'detail-content action-console';
  const header = element('div', 'detail-heading');
  header.append(
    element('p', 'section-kicker', 'Governed work detail'),
    element('h2', '', item.professionalReference),
    element('p', 'muted', `Allocation ${item.allocationId}`)
  );
  container.append(
    header,
    currentStateSection(item),
    attentionSection(item, { currentReturn, feedback, pending, onRespond, onReturn }),
    safeContextSection(item),
    historySection(item, currentReturn),
    provenanceSection(item)
  );
}

export function renderProviderWorkEmpty(container, title, message, kind = 'empty') {
  container.replaceChildren();
  container.className = kind === 'error' ? 'error-state' : 'empty-state';
  container.append(element('strong', '', title), element('span', '', message));
}
