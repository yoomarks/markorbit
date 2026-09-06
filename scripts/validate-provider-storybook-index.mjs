import assert from 'node:assert/strict';
import fs from 'node:fs';

const [file] = process.argv.slice(2);
assert.ok(file, 'Provider Storybook built index is required');
const index = JSON.parse(fs.readFileSync(file, 'utf8'));
const entries = index.entries ?? {};
const storyId = 'provider-web-infrastructure--shell-registration';
assert.ok(entries[storyId], `${file} is missing ${storyId}`);
assert.equal(entries[storyId].type, 'story', `${storyId} must be a rendered story entry`);
console.log(`Provider Storybook index PASS: ${storyId}`);
