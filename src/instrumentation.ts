import { registerOTel } from "@vercel/otel";

/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * We register two separate OTel subsystems:
 *   1. @vercel/otel — traces (auto-instrumentation for HTTP, fetch, etc.)
 *   2. @opentelemetry/sdk-logs — logs (manual wiring, since @vercel/otel
 *      doesn't cover logs as of v2.x).
 *
 * Both export OTLP/HTTP to the collector on the docker network
 * (OTEL_EXPORTER_OTLP_ENDPOINT = http://otel-collector:4318 in prod).
 * The collector forwards everything to Dash0.
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is unset (e.g. `bun dev` on dev
 * machine without the otel-collector running), log emission silently
 * no-ops — `log.*` calls still print to stdout via src/lib/logger.ts.
 */
export async function register() {
  registerOTel({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "malarkrets-app",
  });

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;

  // Dynamic imports so these heavy SDK modules only load in the Node runtime
  // (Next.js instrumentation also runs in edge runtime where they'd fail).
  const { logs } = await import("@opentelemetry/api-logs");
  const { LoggerProvider, BatchLogRecordProcessor } = await import(
    "@opentelemetry/sdk-logs"
  );
  const { OTLPLogExporter } = await import(
    "@opentelemetry/exporter-logs-otlp-http"
  );

  const provider = new LoggerProvider({
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
      ),
    ],
  });
  logs.setGlobalLoggerProvider(provider);
}
