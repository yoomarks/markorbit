import React from 'react';
import ReactDOM from 'react-dom/client';
import { OperationsConsoleShell } from './index.tsx';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <OperationsConsoleShell />
  </React.StrictMode>
);
