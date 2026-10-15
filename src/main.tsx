import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { useSim } from './sim/store';

// dev-only handle for automated tests
if (import.meta.env.DEV) (window as unknown as { __sim: typeof useSim }).__sim = useSim;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
