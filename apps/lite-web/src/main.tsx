import React from 'react';
import ReactDOM from 'react-dom/client';
import { LiteTodayShell } from './index.tsx';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <LiteTodayShell />
  </React.StrictMode>
);
