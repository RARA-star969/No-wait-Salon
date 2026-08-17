import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminApp} from './components/AdminApp.tsx';
import './index.css';

const RootApp = import.meta.env.VITE_APP_MODE === 'admin' ? AdminApp : App;
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
