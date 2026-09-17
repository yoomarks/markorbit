function token(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/u.test(value)
    ? value
    : undefined;
}

function buildAdapterUrl(apiBase, entry) {
  if (typeof apiBase !== 'string' || !/^https:\/\/[A-Za-z0-9.-]+(?::[0-9]{1,5})?$/u.test(apiBase)) {
    throw new Error('ADAPTER_NOT_CONFIGURED');
  }
  const query = [];
  for (const field of ['campaign', 'content', 'referral']) {
    const value = token(entry[field]);
    if (value) query.push(`${field}=${encodeURIComponent(value)}`);
  }
  return `${apiBase}/api/wechat-mini-program/site${query.length ? `?${query.join('&')}` : ''}`;
}

function presentProjection(value) {
  if (!value || value.schemaVersion !== 1 || value.platform !== 'WECHAT_MINIPROGRAM') {
    throw new Error('INVALID_SITE_PROJECTION');
  }
  const site = value.site;
  if (!site || typeof site.siteId !== 'string' || typeof site.hostname !== 'string') {
    throw new Error('INVALID_SITE_PROJECTION');
  }
  if (
    !value.authorityConsequences ||
    Object.values(value.authorityConsequences).some((consequence) => consequence !== false)
  ) {
    throw new Error('INVALID_SITE_PROJECTION');
  }
  const handoffs = Array.isArray(value.serviceHandoffs) ? value.serviceHandoffs : [];
  const handoffByProduct = new Map();
  const sameSitePrefix = `https://${site.hostname}/`;
  for (const handoff of handoffs) {
    if (typeof handoff.url !== 'string' || !handoff.url.startsWith(sameSitePrefix)) {
      throw new Error('INVALID_SITE_PROJECTION');
    }
    if (!/[?&]utm_source=wechat-mini-program(?:&|$)/u.test(handoff.url)) {
      throw new Error('INVALID_SITE_PROJECTION');
    }
    handoffByProduct.set(
      `${handoff.productRef.productId}:${handoff.productRef.version}`,
      handoff.url
    );
  }
  const services = (Array.isArray(site.services) ? site.services : [])
    .filter((service) => service.visibility === 'PUBLIC')
    .map((service) => ({
      key: `${service.productRef.productId}:${service.productRef.version}`,
      title: 'Trademark planning and filing support',
      detail: `Available for ${service.markets.join(', ')} in ${service.locales.join(', ')}.`,
      meta: `Service version ${service.productRef.version} · ${service.fulfillmentMode}`,
      handoffUrl: handoffByProduct.get(
        `${service.productRef.productId}:${service.productRef.version}`
      )
    }))
    .filter((service) => typeof service.handoffUrl === 'string');
  const content = (Array.isArray(site.contentSlots) ? site.contentSlots : []).filter(
    (slot) => slot.route === '/' && slot.locale === site.localization.defaultLocale
  );
  return {
    siteId: site.siteId,
    configurationVersion: site.configurationVersion,
    brandName: site.brand.displayName,
    primaryColor: site.brand.theme.primaryColor,
    market: site.localization.defaultMarket,
    hero: content.find((slot) => slot.slot === 'home.hero') || content[0],
    details: content.filter((slot) => slot.slot !== 'home.hero'),
    services,
    state: services.length === 0 ? 'empty' : content.length === 0 ? 'partial' : 'success'
  };
}

module.exports = { buildAdapterUrl, presentProjection };
