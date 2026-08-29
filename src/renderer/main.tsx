import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { initMockElectronAPI } from './mockElectronAPI';

// Initialize mock API for browser environment (development and E2E testing)
initMockElectronAPI();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
