import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { buildAdapterUrl, presentProjection } = require('../miniprogram/lib/projection.js');

function projection(overrides = {}) {
  return {
    schemaVersion: 1,
    platform: 'WECHAT_MINIPROGRAM',
    site: {
      schemaVersion: 1,
      siteId: 'site_a',
      configurationVersion: 3,
      hostname: 'brand.example.com',
      brand: {
        displayName: 'Workspace A',
        theme: { primaryColor: '#112233' }
      },
      localization: { defaultLocale: 'en-US', defaultMarket: 'US' },
      services: [
        {
          productRef: { productId: 'product_trademark', version: 7 },
          visibility: 'PUBLIC',
          markets: ['US'],
          locales: ['en-US'],
          fulfillmentMode: 'MARKREG'
        }
      ],
      contentSlots: [
        {
          slot: 'home.hero',
          route: '/',
          locale: 'en-US',
          title: 'Protect your mark'
        }
      ]
    },
    serviceHandoffs: [
      {
        productRef: { productId: 'product_trademark', version: 7 },
        url: 'https://brand.example.com/?utm_source=wechat-mini-program&utm_content=product_trademark'
      }
    ],
    authorityConsequences: {
      customerIdentityEstablished: false,
      customerRelationshipCreated: false,
      quoteCreated: false,
      orderCreated: false,
      matterCreated: false,
      paymentCreated: false,
      workspaceAuthorityGranted: false
    },
    ...overrides
  };
}

test('builds the adapter request from bounded evidence without Site authority', () => {
  const url = new URL(
    buildAdapterUrl('https://gateway.example.com', {
      campaign: 'launch',
      referral: 'partner-a',
      siteId: 'site_attacker'
    })
  );
  assert.equal(url.pathname, '/api/wechat-mini-program/site');
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    campaign: 'launch',
    referral: 'partner-a'
  });
});

test('renders success, partial and empty states from owner projection', () => {
  assert.equal(presentProjection(projection()).state, 'success');
  assert.equal(
    presentProjection(projection({ site: { ...projection().site, contentSlots: [] } })).state,
    'partial'
  );
  assert.equal(
    presentProjection(
      projection({ site: { ...projection().site, services: [] }, serviceHandoffs: [] })
    ).state,
    'empty'
  );
});

test('rejects cross-Site handoffs and any asserted business consequence', () => {
  assert.throws(
    () =>
      presentProjection(
        projection({
          serviceHandoffs: [
            {
              productRef: { productId: 'product_trademark', version: 7 },
              url: 'https://attacker.example.com/?utm_source=wechat-mini-program'
            }
          ]
        })
      ),
    /INVALID_SITE_PROJECTION/u
  );
  assert.throws(
    () =>
      presentProjection(
        projection({
          authorityConsequences: {
            ...projection().authorityConsequences,
            customerRelationshipCreated: true
          }
        })
      ),
    /INVALID_SITE_PROJECTION/u
  );
});
