import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { TypeormInstrumentation } from '@opentelemetry/instrumentation-typeorm';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

function parseHeaders(rawHeaders?: string): Record<string, string> | undefined {
  if (!rawHeaders) {
    return undefined;
  }

  const entries = rawHeaders
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => pair.split('=').map((item) => item.trim()))
    .filter(([key, value]) => key && value);

  return entries.length ? Object.fromEntries(entries as [string, string][]) : undefined;
}

function resolveDiagLogLevel(logLevel?: string): DiagLogLevel {
  switch (logLevel?.toLowerCase()) {
    case 'all':
      return DiagLogLevel.ALL;
    case 'verbose':
      return DiagLogLevel.VERBOSE;
    case 'debug':
      return DiagLogLevel.DEBUG;
    case 'info':
      return DiagLogLevel.INFO;
    case 'warn':
      return DiagLogLevel.WARN;
    case 'error':
      return DiagLogLevel.ERROR;
    default:
      return DiagLogLevel.NONE;
  }
}

const sdkDisabled = process.env.OTEL_SDK_DISABLED === 'true';
const tracingDisabled = process.env.OTEL_ENABLED === 'false';

if (!sdkDisabled && !tracingDisabled) {
  const otelLogLevel = resolveDiagLogLevel(process.env.OTEL_LOG_LEVEL);
  if (otelLogLevel !== DiagLogLevel.NONE) {
    diag.setLogger(new DiagConsoleLogger(), otelLogLevel);
  }

  const traceEndpoint =
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
    'http://localhost:4318/v1/traces';

  const traceExporter = new OTLPTraceExporter({
    url: traceEndpoint,
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
  });

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'pintar-pintar-be',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || 'unknown',
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
      new NestInstrumentation(),
      new TypeormInstrumentation(),
    ],
  });

  sdk.start();

  const shutdown = () => {
    sdk
      .shutdown()
      .catch((error: unknown) => {
        console.error('[OpenTelemetry] Failed to shutdown SDK', error);
      })
      .finally(() => {
        process.exit(0);
      });
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}