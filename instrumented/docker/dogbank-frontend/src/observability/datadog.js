import { datadogLogs } from '@datadog/browser-logs';
import { datadogRum } from '@datadog/browser-rum';

const applicationId = '75c8178b-be55-4aa4-a023-47d3efa27538';
const clientToken = 'pub9db46832ed6a466e3a1ab28915ad67cd';
const site = 'datadoghq.com';
const service = 'dogbank-frontend';
const env = 'dogbank';
const version = '1.0.0';

const tracingUrls = [
  { match: /^http:\/\/localhost:8080\/api\//, propagatorTypes: ['tracecontext', 'datadog'] },
  { match: /^http:\/\/127\.0\.0\.1:8080\/api\//, propagatorTypes: ['tracecontext', 'datadog'] },
  { match: /\/api\//, propagatorTypes: ['tracecontext', 'datadog'] },
];

const redactSensitiveText = (value) => {
  if (typeof value !== 'string') return value;

  return value
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '***.***.***-**')
    .replace(/(["']?(?:password|senha)["']?\s*[:=]\s*["']?)[^"',}\s]+/gi, '$1[REDACTED]');
};

const sanitizeLogEvent = (event) => {
  event.message = redactSensitiveText(event.message);
  if (event.view?.url) {
    event.view.url = redactSensitiveText(event.view.url);
  }
  if (event.http?.url) {
    event.http.url = redactSensitiveText(event.http.url);
  }
  return true;
};

const globalScope = typeof window !== 'undefined' ? window : {};

if (!globalScope.__DOGBANK_FRONTEND_DATADOG_INITIALIZED__) {
  datadogLogs.init({
    clientToken,
    site,
    service,
    env,
    version,
    sessionSampleRate: 100,
    forwardErrorsToLogs: true,
    forwardConsoleLogs: ['log', 'info', 'warn', 'error'],
    beforeSend: sanitizeLogEvent,
  });

  datadogRum.init({
    applicationId,
    clientToken,
    site,
    service,
    env,
    version,
    sessionSampleRate: 100,
    sessionReplaySampleRate: 100,
    defaultPrivacyLevel: 'allow',
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    allowedTracingUrls: tracingUrls,
    traceSampleRate: 100,
  });

  datadogRum.startSessionReplayRecording();
  datadogLogs.logger.info('dogbank.frontend.logs.initialized', {
    route: globalScope.location?.pathname,
    source: 'react',
  });

  globalScope.__DOGBANK_FRONTEND_DATADOG_INITIALIZED__ = true;
}

export { datadogLogs, datadogRum };
