import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { AdConfigProvider } from './contexts/AdConfigContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AdConfigProvider>
        <App />
      </AdConfigProvider>
    </BrowserRouter>
  </React.StrictMode>
);