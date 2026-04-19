import { logs, SeverityNumber } from "@opentelemetry/api-logs";

/**
 * Central logger that emits to BOTH stdout and OTel Logs.
 *
 *   - stdout: so `docker compose logs app` and `bun dev` still show
 *     entries in the terminal.
 *   - OTel:   so entries flow to the collector → Dash0 for search,
 *     alerts, and correlation with traces.
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is unset (dev without collector),
 * the OTel side no-ops silently — stdout remains the canonical output.
 *
 * Usage (server-side only — Server Components, Route Handlers, Server
 * Actions, lib code):
 *
 *   import { log } from "@/lib/logger";
 *
 *   log.info("user logged in", { userId });
 *   log.warn("slow query", { queryMs: 420 });
 *   log.error("db connection failed", { err: err.message });
 *
 * Attribute values are stringified when emitted, so keep them small and
 * searchable (ids, counts, error messages — not full objects).
 *
 * Do NOT use this in client components — it imports Node-only OTel
 * modules. Use console.* client-side; those already show up in browser
 * devtools.
 */

const otelLogger = logs.getLogger("malarkrets-app");

type Attrs = Record<string, string | number | boolean | null | undefined>;

function emit(
  level: "info" | "warn" | "error" | "debug",
  severity: SeverityNumber,
  message: string,
  attrs?: Attrs,
) {
  // Mirror to stdout so operators with shell access can still see the stream.
  const line = attrs ? `${message} ${JSON.stringify(attrs)}` : message;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);

  // Emit to OTel (no-ops until the global provider is set via instrumentation.ts).
  otelLogger.emit({
    severityNumber: severity,
    severityText: level.toUpperCase(),
    body: message,
    attributes: attrs,
  });
}

export const log = {
  info: (message: string, attrs?: Attrs) =>
    emit("info", SeverityNumber.INFO, message, attrs),
  warn: (message: string, attrs?: Attrs) =>
    emit("warn", SeverityNumber.WARN, message, attrs),
  error: (message: string, attrs?: Attrs) =>
    emit("error", SeverityNumber.ERROR, message, attrs),
  debug: (message: string, attrs?: Attrs) =>
    emit("debug", SeverityNumber.DEBUG, message, attrs),
};
