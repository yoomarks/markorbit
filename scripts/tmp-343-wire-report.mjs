import fs from 'node:fs';

const path = 'services/core/src/index.ts';
let text = fs.readFileSync(path, 'utf8');
const replacements = [
  [
    "import { createMethodOutcomeEvidenceRoutesV1 } from './method-outcome-evidence-http.js';\nimport type { MethodOutcomeEvidenceAdmissionServiceV1 } from './method-outcome-evidence.js';",
    "import { createMethodOutcomeEvidenceRoutesV1 } from './method-outcome-evidence-http.js';\nimport type { MethodOutcomeEvidenceAdmissionServiceV1 } from './method-outcome-evidence.js';\nimport { createMethodOutcomeReportRoutesV1 } from './method-outcome-report-http.js';\nimport type { MethodOutcomeReportServiceV1 } from './method-outcome-report.js';"
  ],
  [
    "  methodOutcomeEvidenceAdmissions?: Pick<MethodOutcomeEvidenceAdmissionServiceV1, 'admit'>;\n  internalServiceSecret?: string;",
    "  methodOutcomeEvidenceAdmissions?: Pick<MethodOutcomeEvidenceAdmissionServiceV1, 'admit'>;\n  methodOutcomeReports?: Pick<MethodOutcomeReportServiceV1, 'report'>;\n  internalServiceSecret?: string;"
  ],
  [
    "  if (options.methodOutcomeEvidenceAdmissions && !secret)\n    throw new Error('internalServiceSecret is required for Method Outcome Evidence admission.');",
    "  if (options.methodOutcomeEvidenceAdmissions && !secret)\n    throw new Error('internalServiceSecret is required for Method Outcome Evidence admission.');\n  if (options.methodOutcomeReports && !secret)\n    throw new Error('internalServiceSecret is required for Method Outcome reporting.');"
  ],
  [
    "  const methodOutcomeEvidenceRoutes =\n    options.methodOutcomeEvidenceAdmissions && secret\n      ? createMethodOutcomeEvidenceRoutesV1({\n          service: options.methodOutcomeEvidenceAdmissions,\n          internalServiceSecret: secret\n        })\n      : [];",
    "  const methodOutcomeEvidenceRoutes =\n    options.methodOutcomeEvidenceAdmissions && secret\n      ? createMethodOutcomeEvidenceRoutesV1({\n          service: options.methodOutcomeEvidenceAdmissions,\n          internalServiceSecret: secret\n        })\n      : [];\n  const methodOutcomeReportRoutes =\n    options.methodOutcomeReports && secret\n      ? createMethodOutcomeReportRoutesV1({\n          service: options.methodOutcomeReports,\n          internalServiceSecret: secret\n        })\n      : [];"
  ],
  [
    '  routes.push(...methodOutcomeEvidenceRoutes);',
    '  routes.push(...methodOutcomeEvidenceRoutes, ...methodOutcomeReportRoutes);'
  ],
  [
    "export * from './method-outcome-evidence.js';",
    "export * from './method-outcome-evidence.js';\nexport * from './method-outcome-report.js';"
  ]
];
for (const [from, to] of replacements) {
  if (!text.includes(from)) throw new Error(`Missing Core runtime anchor: ${from.slice(0, 100)}`);
  text = text.replace(from, to);
}
fs.writeFileSync(path, text);
