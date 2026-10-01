import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { CustomerPortalPreview } from './CustomerPortalPreview.js';

const requestedChannel = new URL(window.location.href).searchParams.get('channel');
const channel = requestedChannel === 'mini' || requestedChannel === 'h5' ? requestedChannel : 'web';
const locale =
  new URL(window.location.href).searchParams.get('locale') === 'en-US' ? 'en-US' : 'zh-CN';
const fixtureMode =
  new URL(window.location.href).searchParams.get('fixture') === 'quote-expired'
    ? 'quote-expired'
    : 'success';
const journeyStepParam = new URL(window.location.href).searchParams.get('journeyStep');
const requestedJourneyStep = journeyStepParam === null ? Number.NaN : Number(journeyStepParam);
const journeyProps = Number.isInteger(requestedJourneyStep)
  ? { defaultApplicationStep: requestedJourneyStep }
  : {};
const defaultJourneyOpen = new URL(window.location.href).searchParams.get('journey') === 'open';
const root = document.getElementById('root');
if (!root) throw new Error('Customer Portal preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <CustomerPortalPreview
      defaultChannel={channel}
      defaultLocale={locale}
      fixtureMode={fixtureMode}
      defaultJourneyOpen={defaultJourneyOpen}
      {...journeyProps}
    />
  </StrictMode>
);
