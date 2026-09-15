import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { ResolvedPublicSiteV1 } from '@markorbit/contracts/site';
import { Alert, Button, Card, LoadingState } from '@markorbit/ui';
import { MarkregAccountEntry } from './AccountEntry.js';
import { ProductionIntakePlanning } from './ProductionIntakePlanning.js';
import { MarkregWorkspaceHome } from './WorkspaceHome.js';
import { createSiteProductionIntakeClient } from './api/production-intake.js';
import type { MarkregAccountApi } from './account-api.js';
import './site-entry.css';

export interface PublicSiteClient {
  resolve(): Promise<ResolvedPublicSiteV1>;
}

export const publicSiteClient: PublicSiteClient = {
  async resolve() {
    const response = await fetch('/api/site', { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error('SITE_UNAVAILABLE');
    return (await response.json()) as ResolvedPublicSiteV1;
  }
};

type Destination = 'home' | 'intake' | 'portal';

export function SiteEntry({
  client = publicSiteClient,
  accountApi
}: {
  client?: PublicSiteClient;
  accountApi?: MarkregAccountApi;
}) {
  const [site, setSite] = useState<ResolvedPublicSiteV1>();
  const [failed, setFailed] = useState(false);
  const [destination, setDestination] = useState<Destination>('home');
  const load = () => {
    setFailed(false);
    setSite(undefined);
    void client
      .resolve()
      .then(setSite)
      .catch(() => setFailed(true));
  };

  useEffect(() => {
    let active = true;
    void client
      .resolve()
      .then((value) => active && setSite(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [client]);

  if (failed)
    return (
      <main className="site-entry site-entry--status">
        <Alert tone="danger" title="This service site is unavailable">
          The host could not be matched to a current, authorized Site. No fallback brand or service
          has been substituted.
        </Alert>
        <Button onClick={load}>Try again</Button>
      </main>
    );
  if (!site)
    return (
      <main className="site-entry site-entry--status">
        <LoadingState label="Opening service site" />
      </main>
    );
  if (destination !== 'home')
    return (
      <BrandedAccount
        site={site}
        destination={destination}
        {...(accountApi ? { accountApi } : {})}
        onHome={() => setDestination('home')}
      />
    );
  return <PublicHome site={site} onDestination={setDestination} />;
}

function BrandedAccount({
  site,
  destination,
  accountApi,
  onHome
}: {
  site: ResolvedPublicSiteV1;
  destination: Exclude<Destination, 'home'>;
  accountApi?: MarkregAccountApi;
  onHome: () => void;
}) {
  return (
    <div style={theme(site)}>
      <nav className="site-entry__return" aria-label="Service site">
        <Button variant="secondary" onClick={onHome}>
          Back to {site.brand.displayName}
        </Button>
      </nav>
      <MarkregAccountEntry
        {...(accountApi ? { api: accountApi } : {})}
        brandName={site.brand.displayName}
        intro="Sign in or create your customer Workspace to continue. The Site owner does not become a member of your Workspace."
        renderProduct={
          destination === 'intake'
            ? () => (
                <ProductionIntakePlanning
                  client={createSiteProductionIntakeClient()}
                  storageScope={site.siteId}
                />
              )
            : () => <MarkregWorkspaceHome />
        }
      />
    </div>
  );
}

function PublicHome({
  site,
  onDestination
}: {
  site: ResolvedPublicSiteV1;
  onDestination: (destination: Destination) => void;
}) {
  const services = site.services.filter((service) => service.visibility === 'PUBLIC');
  const content = useMemo(
    () =>
      site.contentSlots.filter(
        (slot) => slot.route === '/' && slot.locale === site.localization.defaultLocale
      ),
    [site]
  );
  const hero = content.find((slot) => slot.slot === 'home.hero') ?? content[0];
  const details = content.filter((slot) => slot !== hero);
  return (
    <div className="site-entry" style={theme(site)}>
      <header className="site-entry__header">
        <a className="site-entry__brand" href="/" aria-label={`${site.brand.displayName} home`}>
          {site.brand.displayName}
        </a>
        <Button variant="secondary" onClick={() => onDestination('portal')}>
          Customer portal
        </Button>
      </header>
      <main>
        <section className="site-entry__hero" aria-labelledby="site-hero-title">
          <div>
            <p className="site-entry__eyebrow">
              Trademark services · {site.localization.defaultMarket}
            </p>
            <h1 id="site-hero-title">
              {hero?.title ?? 'Plan your trademark filing with clarity.'}
            </h1>
            <p>
              {hero?.description ??
                'Share your goals, receive a governed recommendation, and review a quote before any order is created.'}
            </p>
            <div className="site-entry__actions">
              <Button disabled={services.length === 0} onClick={() => onDestination('intake')}>
                Start a consultation
              </Button>
              <Button variant="secondary" onClick={() => onDestination('portal')}>
                View existing work
              </Button>
            </div>
          </div>
          <Card className="site-entry__promise">
            <p className="site-entry__eyebrow">What happens next</p>
            <ol>
              <li>Your answers are recorded as customer-supplied Intake.</li>
              <li>You review any recommendation and quote before selecting.</li>
              <li>No order, payment, filing, or legal approval is created automatically.</li>
            </ol>
          </Card>
        </section>
        <section className="site-entry__services" aria-labelledby="site-services-title">
          <div>
            <p className="site-entry__eyebrow">Available services</p>
            <h2 id="site-services-title">A governed path from questions to action</h2>
          </div>
          {services.length === 0 ? (
            <Alert tone="warning" title="Services are not currently available">
              This Site is active, but it has no public service available for this market.
            </Alert>
          ) : (
            <div className="site-entry__service-grid">
              {services.map((service) => (
                <Card key={`${service.productRef.productId}:${service.productRef.version}`}>
                  <h3>Trademark planning and filing support</h3>
                  <p>
                    Available for {service.markets.join(', ')} in {service.locales.join(', ')}.
                    Pricing and fulfillment remain governed by the service owner.
                  </p>
                  <span className="site-entry__meta">
                    Service version {service.productRef.version} · {service.fulfillmentMode}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </section>
        {details.length > 0 && (
          <section className="site-entry__content" aria-label="Service information">
            {details.map((slot) => (
              <Card
                key={`${slot.slot}:${slot.publishPackageRef.id}:${slot.publishPackageRef.version}`}
              >
                <h2>{slot.title}</h2>
                {slot.description && <p>{slot.description}</p>}
              </Card>
            ))}
          </section>
        )}
      </main>
      <footer className="site-entry__footer">
        <span>{site.brand.displayName}</span>
        <span>
          Site {site.siteId} · configuration {site.configurationVersion}
        </span>
      </footer>
    </div>
  );
}

function theme(site: ResolvedPublicSiteV1): CSSProperties {
  return {
    '--site-primary': site.brand.theme.primaryColor,
    '--site-accent': site.brand.theme.accentColor
  } as CSSProperties;
}
