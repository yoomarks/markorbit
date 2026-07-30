import fs from 'node:fs';
import assert from 'node:assert/strict';
const manifest = JSON.parse(
  fs.readFileSync('docs/quality/MO-MVP-MILESTONE-001-STORY-MATRIX.json', 'utf8')
);
const expected = manifest.cells.filter((x) => x.applicable).map((x) => x.storyId);
const indexes = process.argv.slice(2);
assert.ok(indexes.length >= 2, 'MarkReg and Lite built indexes are required');
for (const file of indexes) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')).entries;
  const ids = Object.keys(entries);
  assert.equal(new Set(ids).size, ids.length, `${file} has duplicate IDs`);
  const missing = expected.filter((id) => !entries[id]);
  assert.deepEqual(missing, [], `${file} is missing manifest stories`);
}
console.log(
  `Storybook index PASS: ${expected.length} manifest story IDs exist in ${indexes.length} builds`
);
