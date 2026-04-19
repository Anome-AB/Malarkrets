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
  // When attrs contains a `stack` field (usually from errAttrs), pull it
  // out so the stdout mirror can print it on separate lines — JSON-
  // escaped newlines are unreadable in a dev terminal. The full attrs
  // object (stack included) is still sent to OTel so Dash0 has it.
  const stack =
    attrs && typeof attrs.stack === "string" ? attrs.stack : undefined;
  const displayAttrs = stack ? { ...attrs, stack: undefined } : attrs;
  // Strip the now-undefined stack so JSON.stringify doesn't emit
  // `"stack":undefined` (it wouldn't anyway, but keep the shape tight).
  const hasOther =
    displayAttrs &&
    Object.entries(displayAttrs).some(([, v]) => v !== undefined);
  const line = hasOther
    ? `${message} ${JSON.stringify(displayAttrs, (_k, v) => (v === undefined ? undefined : v))}`
    : message;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);

  // Print the stack on its own lines so it renders as an actual stack.
  if (stack) {
    const out = level === "error" ? console.error : console.warn;
    out(stack);
  }

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

/**
 * Unwrap an `unknown` caught error to a searchable string. Use when you
 * only want the message (e.g. user-facing validation errors where the
 * stack would be noise):
 *
 *   log.warn("form validation failed", { err: errMsg(err) });
 */
export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Full error context for catch blocks — message, type name, and stack.
 * The `emit` function pulls the stack out to print it on separate lines
 * in the stdout mirror so dev terminals show real, readable stack
 * traces. In Dash0 the stack remains a queryable attribute.
 *
 *   try { ... } catch (err) {
 *     log.error("createActivity failed", errAttrs(err));
 *   }
 *
 * Merge with extra attributes when needed:
 *
 *   log.error("email send failed", { ...errAttrs(err), email });
 */
export function errAttrs(err: unknown): {
  err: string;
  errName?: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return {
      err: err.message,
      errName: err.name,
      stack: err.stack,
    };
  }
  return { err: String(err) };
}
