import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const [html, css, js] = await Promise.all(
  ['index.html', 'styles.css', 'app.js'].map((f) => readFile(new URL(f, root), 'utf8'))
);
test('is bilingual and labels preview truthfully', () => {
  assert.match(html, /lang="zh-CN"/);
  assert.match(js, /real payment|真实支付/);
  assert.match(js, /Payment webhook receipt/);
  assert.match(js, /中文/);
});
test('keeps financial lanes and commercial states separate', () => {
  for (const term of [
    'MO 订阅',
    '业务收款',
    '合作方付款',
    '佣金结算',
    '对账与票据',
    'Commercial Agreement',
    'Entitlement',
    'Installation'
  ])
    assert.match(js, new RegExp(term));
});
test('covers required journey and negative cases', () => {
  for (const term of [
    'confirm-buy',
    'confirm-site',
    'confirm-manager',
    'open-admin',
    '不适用',
    '收款主体不匹配',
    'PERMISSION'
  ])
    assert.match(js, new RegExp(term, 'i'));
});
test('has 390px responsive layout', () => {
  assert.match(css, /@media \(max-width: 410px\)/);
  assert.match(css, /bottom: 0/);
});
