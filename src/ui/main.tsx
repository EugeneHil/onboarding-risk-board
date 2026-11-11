import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEMO_AS_OF, DEMO_EMPLOYEES } from '../data/demo';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App employees={DEMO_EMPLOYEES} asOf={DEMO_AS_OF} />
  </StrictMode>,
);
