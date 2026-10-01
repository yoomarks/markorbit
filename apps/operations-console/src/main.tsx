import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { OperationsApp } from './App.js';
import { SuperAdminV2 } from './super-admin-v2/SuperAdminV2.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
const isV2Preview = window.location.pathname.startsWith('/super-admin-v2');
createRoot(root).render(
  <StrictMode>{isV2Preview ? <SuperAdminV2 /> : <OperationsApp />}</StrictMode>
);
