import fs from 'node:fs';

const orderPath = 'apps/markreg-web/src/OrderJourney.tsx';
let order = fs.readFileSync(orderPath, 'utf8');
order = order.replace(
  "import type { CustomerConfirmation, PlanQuoteResponse } from '@markorbit/contracts';",
  "import type { CustomerConfirmation } from '@markorbit/contracts';"
);
order = order.replace(
  "export interface OrderCommercialSource {\n  quote: PlanQuoteResponse;\n  confirmation: CustomerConfirmation;\n}",
  "export interface OrderCommercialSource {\n  confirmation: CustomerConfirmation;\n}"
);
order = order.replace(
  "    if (typeof history !== 'undefined')\n      history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', orderRoute(value));",
  "    if (typeof history !== 'undefined') {\n      if (mode === 'push') history.pushState(null, '', orderRoute(value));\n      else history.replaceState(null, '', orderRoute(value));\n    }"
);
fs.writeFileSync(orderPath, order);

const confirmationPath = 'apps/markreg-web/src/ConfirmationMatterFlow.tsx';
let confirmation = fs.readFileSync(confirmationPath, 'utf8');
confirmation = confirmation.replace(
  'return <OrderJourney source={{ quote, confirmation }} />;',
  'return <OrderJourney source={{ confirmation }} />;'
);
fs.writeFileSync(confirmationPath, confirmation);

const routePath = 'apps/markreg-web/src/routing/GovernedRouteEntry.tsx';
let route = fs.readFileSync(routePath, 'utf8');
route = route.replace(
  "import { OrderJourney } from '../OrderJourney.js';",
  "import { CustomerConfirmationOrderEntry } from '../CustomerConfirmationOrderEntry.js';\nimport { OrderJourney } from '../OrderJourney.js';"
);
route = route.replace(
  "  if (parsed.kind === 'VALID' && parsed.route.view === 'order')\n    return (\n      <OrderJourney\n        orderId={parsed.route.recordId}\n        expectedVersion={parsed.route.expectedVersion}\n      />\n    );\n  return <GenericGovernedRouteEntry parsed={parsed} client={client} />;",
  "  if (parsed.kind === 'VALID' && parsed.route.view === 'order')\n    return (\n      <OrderJourney\n        orderId={parsed.route.recordId}\n        expectedVersion={parsed.route.expectedVersion}\n      />\n    );\n  if (parsed.kind === 'VALID' && parsed.route.view === 'customer-confirmation')\n    return (\n      <CustomerConfirmationOrderEntry\n        confirmationId={parsed.route.recordId}\n        expectedVersion={parsed.route.expectedVersion}\n        client={client}\n      />\n    );\n  return <GenericGovernedRouteEntry parsed={parsed} client={client} />;"
);
fs.writeFileSync(routePath, route);

fs.rmSync('scripts/wp06-refine.mjs');
fs.rmSync('.github/workflows/wp06-refine.yml');
