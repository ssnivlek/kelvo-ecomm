import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { datadogRum } from '@datadog/browser-rum';
import { datadogLogs } from '@datadog/browser-logs';
import App from './App';
import './styles/global.css';

const DD_APPLICATION_ID = process.env.REACT_APP_DD_APPLICATION_ID || '';
const DD_CLIENT_TOKEN = process.env.REACT_APP_DD_CLIENT_TOKEN || '';
const DD_SITE = process.env.REACT_APP_DD_SITE || 'datadoghq.com';
const DD_SERVICE = process.env.REACT_APP_DD_SERVICE || 'kelvo-ecomm';
const DD_ENV = process.env.REACT_APP_DD_ENV || 'production';
const DD_VERSION = process.env.REACT_APP_DD_VERSION || '1.0.0';

if (DD_APPLICATION_ID && DD_CLIENT_TOKEN) {
  datadogRum.init({
    applicationId: DD_APPLICATION_ID,
    clientToken: DD_CLIENT_TOKEN,
    site: DD_SITE,
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input',
    allowedTracingUrls: [
      { match: /^http:\/\/localhost/, propagatorTypes: ['datadog', 'tracecontext'] },
      { match: (url: string) => url.includes('.amazonaws.com'), propagatorTypes: ['datadog', 'tracecontext'] },
      { match: (url: string) => url.includes('.cloudfront.net'), propagatorTypes: ['datadog', 'tracecontext'] },
    ],
  });

  datadogLogs.init({
    clientToken: DD_CLIENT_TOKEN,
    site: DD_SITE,
    service: DD_SERVICE,
    env: DD_ENV,
    version: DD_VERSION,
    forwardErrorsToLogs: true,
    sessionSampleRate: 100,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
