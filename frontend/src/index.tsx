import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';
import App from './App';
import './styles/global.css';

datadogRum.init({
  applicationId: process.env.REACT_APP_DD_APPLICATION_ID || 'rum-shop-app-id',
  clientToken: process.env.REACT_APP_DD_CLIENT_TOKEN || 'pub_rum_shop_client_token',
  site: process.env.REACT_APP_DD_SITE || 'datadoghq.com',
  service: 'rum-shop-frontend',
  env: process.env.REACT_APP_DD_ENV || 'production',
  version: '1.0.0',
  sessionSampleRate: 100,
  sessionReplaySampleRate: 100,
  trackUserInteractions: true,
  trackResources: true,
  trackLongTasks: true,
  defaultPrivacyLevel: 'mask-user-input',
  allowedTracingUrls: [
    { match: /http:\/\/localhost/, propagatorTypes: ['datadog', 'tracecontext'] },
    { match: /https:\/\/api\.rumshop\.com/, propagatorTypes: ['datadog', 'tracecontext'] },
  ],
});

datadogLogs.init({
  clientToken: process.env.REACT_APP_DD_CLIENT_TOKEN || 'pub_rum_shop_client_token',
  site: process.env.REACT_APP_DD_SITE || 'datadoghq.com',
  service: 'rum-shop-frontend',
  env: process.env.REACT_APP_DD_ENV || 'production',
  forwardErrorsToLogs: true,
  sessionSampleRate: 100,
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
