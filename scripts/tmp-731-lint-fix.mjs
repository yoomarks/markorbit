import fs from 'node:fs';
function replace(path, from, to) {
  const before = fs.readFileSync(path, 'utf8');
  if (!before.includes(from)) throw new Error(`Missing lint-fix anchor in ${path}: ${from}`);
  fs.writeFileSync(path, before.replace(from, to));
}
replace(
  'services/execution/src/durable-preparation-source.ts',
  '  const getJson = async (path: string, allowNotFound = false): Promise<unknown | undefined> => {',
  '  const getJson = async (path: string, allowNotFound = false): Promise<unknown> => {'
);
replace(
  'services/execution/src/index.ts',
  '            ? reviewRepository.findById(id as ProfessionalReviewCaseId)\n',
  '            ? reviewRepository.findById(id)\n'
);
replace(
  'services/execution/tests/durable-preparation-source.test.ts',
  '      const url = String(input);\n',
  "      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;\n"
);
replace(
  'services/execution/tests/durable-preparation-source.test.ts',
  "    reviewSource: async () => (overrides && 'review' in overrides ? overrides.review : review)\n",
  "    reviewSource: () => Promise.resolve(overrides && 'review' in overrides ? overrides.review : review)\n"
);
console.log('TASK 731 lint findings fixed');
