import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { CustomerPortalPreview } from './CustomerPortalPreview.js';

const channel =
  new URL(window.location.href).searchParams.get('channel') === 'mini' ? 'mini' : 'web';
const locale =
  new URL(window.location.href).searchParams.get('locale') === 'en-US' ? 'en-US' : 'zh-CN';
const root = document.getElementById('root');
if (!root) throw new Error('Customer Portal preview root was not found.');

createRoot(root).render(
  <StrictMode>
    <CustomerPortalPreview defaultChannel={channel} defaultLocale={locale} />
  </StrictMode>
);
