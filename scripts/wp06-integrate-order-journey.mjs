import fs from 'node:fs';

const target = 'apps/markreg-web/src/ConfirmationMatterFlow.tsx';
let text = fs.readFileSync(target, 'utf8');

text = text.replace(
  "import type { MarkregClient } from './api/markreg.js';\n",
  "import type { MarkregClient } from './api/markreg.js';\nimport { OrderJourney } from './OrderJourney.js';\n"
);
text = text.replace(
  "  const [savedMessage, setSavedMessage] = useState('');\n",
  "  const [savedMessage, setSavedMessage] = useState('');\n  const [orderJourneyOpen, setOrderJourneyOpen] = useState(false);\n"
);
text = text.replace(
  "  const confirm = async () => {\n",
  "  if (orderJourneyOpen && confirmation)\n    return <OrderJourney source={{ quote, confirmation }} />;\n\n  const confirm = async () => {\n"
);
text = text.replace(
  "          <Button onClick={() => void createDraft()}>Prepare Matter Draft</Button>\n",
  "          <Alert tone=\"warning\" title=\"Order-first path\">\n            The primary direct-customer path now creates a durable Order before Formal Matter.\n            Creating the Order does not create a Payment, Invoice or Filing.\n          </Alert>\n          <div className=\"markreg-actions\">\n            <Button onClick={() => setOrderJourneyOpen(true)}>Create service Order</Button>\n            <Button variant=\"secondary\" onClick={() => void createDraft()}>\n              Prepare Matter Draft\n            </Button>\n          </div>\n"
);

fs.writeFileSync(target, text);
fs.rmSync('scripts/wp06-integrate-order-journey.mjs');
fs.rmSync('.github/workflows/wp06-integrate-order-journey.yml');
