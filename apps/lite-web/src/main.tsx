import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@markorbit/ui/styles.css';
import { LiteApp } from './App.js';
const root = document.querySelector('#root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <LiteApp />
  </StrictMode>
);
