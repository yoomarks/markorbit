import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { CustomerPortalPreview } from './CustomerPortalPreview.js';

const requestedChannel = new URL(window.location.href).searchParams.get('channel');
const channel = requestedChannel === 'mini' || requestedChannel === 'h5' ? requestedChannel : 'web';
const locale =
  new URL(window.location.href).searchParams.get('locale') === 'en-US' ? 'en-US' : 'zh-CN';
const root = document.getElementById('root');
if (!root) throw new Error('Customer Portal preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <CustomerPortalPreview defaultChannel={channel} defaultLocale={locale} />
  </StrictMode>
);
