from pathlib import Path
import json

source = Path('apps/gateway/src/markreg-early-funnel-http.ts')
text = source.read_text()
marker = "\n  const productionIntakeRoute: JsonRoute = {"
addition = r'''

  const forwardWorkspaceActionRead = async (
    request: JsonRequest,
    principal: WorkspacePrincipal
  ) => {
    if (!options.internalServiceSecret)
      throw new HttpError(
        503,
        'DOWNSTREAM_UNAVAILABLE',
        'MarkReg service authentication is unavailable.',
        true
      );
    try {
      const response = await fetch(`${options.markRegUrl}/internal/v1/workspace-actions`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          'x-markorbit-internal-authorization': options.internalServiceSecret,
          'x-markorbit-principal': encodeInternalWorkspacePrincipal(principal),
          'x-markorbit-workspace-id': principal.workspaceId,
          ...(request.headers['x-correlation-id']
            ? { 'x-correlation-id': request.headers['x-correlation-id'] }
            : {}),
          ...(request.headers['x-request-id']
            ? { 'x-request-id': request.headers['x-request-id'] }
            : {})
        }
      });
      return json(response.status, await response.json());
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'MarkReg service is unavailable.', true);
    }
  };
'''
if marker not in text:
    raise SystemExit('forward insertion marker not found')
text = text.replace(marker, addition + marker, 1)

marker = "\n  const quoteRoute: JsonRoute = {"
addition = r'''

  const workspaceActionRoute: JsonRoute = {
    method: 'GET',
    path: '/api/markreg/workspace-actions',
    handle: async (request) => {
      const principal = await authenticateMatterRead(request);
      return forwardWorkspaceActionRead(request, principal);
    }
  };
'''
if marker not in text:
    raise SystemExit('route insertion marker not found')
text = text.replace(marker, addition + marker, 1)

old = """    formalMatterEvidenceRoute,\n    formalMatterExaminationRoute\n  ];"""
new = """    formalMatterEvidenceRoute,\n    formalMatterExaminationRoute,\n    workspaceActionRoute\n  ];"""
if old not in text:
    raise SystemExit('route list marker not found')
source.write_text(text.replace(old, new, 1))

inventory_path = Path('docs/architecture/GATEWAY_ROUTE_INVENTORY_MARKREG_EARLY_FUNNEL.json')
inventory = json.loads(inventory_path.read_text())
route = {
    'method': 'GET',
    'path': '/api/markreg/workspace-actions',
    'owner': 'markreg',
    'namespaceClass': 'PRIMARY_PRODUCT_API',
    'authenticationMode': 'COOKIE_AUTHENTICATED',
    'environmentScope': 'ALL_ENVIRONMENTS',
    'idempotencyRequirement': 'NOT_APPLICABLE_READ_ONLY',
    'authorityConsequenceResponse': 'NONE_EXTERNAL',
    'httpIntegrationTestFile': 'apps/gateway/tests/workspace-action-gateway.test.ts'
}
if any(row['method'] == route['method'] and row['path'] == route['path'] for row in inventory['routes']):
    raise SystemExit('workspace action route already present')
inventory['routes'].append(route)
inventory_path.write_text(json.dumps(inventory, indent=2) + '\n')

validator = Path('scripts/validate-gateway-inventory.mjs')
text = validator.read_text()
auth_marker = "    row.path.startsWith('/api/markreg/formal-matters') ||\n"
if auth_marker not in text:
    raise SystemExit('validator auth marker not found')
text = text.replace(
    auth_marker,
    auth_marker + "    row.path.startsWith('/api/markreg/workspace-actions') ||\n",
    1
)
text = text.replace('assert.equal(source.length, 96);', 'assert.equal(source.length, 97);', 1)
text = text.replace('assert.equal(inventory.length, 96);', 'assert.equal(inventory.length, 97);', 1)
text = text.replace('  90\n);', '  91\n);', 1)
text = text.replace(
    "'Gateway inventory PASS: 96 runtime routes; authenticated Early Funnel, Production Intake, Matter Intelligence, Formal Matter Evidence, Examination, Checkout, Commercial Catalog, Payment, Order, Document Package, Evidence Review and Lifecycle boundaries included; test bootstrap excluded'",
    "'Gateway inventory PASS: 97 runtime routes; authenticated Early Funnel, Production Intake, Workspace Action, Matter Intelligence, Formal Matter Evidence, Examination, Checkout, Commercial Catalog, Payment, Order, Document Package, Evidence Review and Lifecycle boundaries included; test bootstrap excluded'",
    1
)
validator.write_text(text)
