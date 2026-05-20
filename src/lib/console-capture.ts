// Klient-sidan ring buffer som fångar console.log/info/warn/error i bakgrunden.
// Aktiveras tidigt i layout via <ConsoleCaptureProvider>. När testaren skickar
// ett tips läggs snapshot:en med i feedback_tips.console_log.
//
// 200 entries räcker för ~5-6 separata felhändelser (en nested stack trace
// kan vara 15-20 rader). Vid 200+ rullas äldsta ut.

const MAX_ENTRIES = 200;
type Level = "log" | "info" | "warn" | "error";

interface CapturedEntry {
  level: Level;
  ts: number;
  message: string;
}

let buffer: CapturedEntry[] = [];
let installed = false;

function safeStringify(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}${arg.stack ? "\n" + arg.stack : ""}`;
  }
  try {
    return JSON.stringify(arg, replacer, 2);
  } catch {
    return String(arg);
  }
}

function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

function format(args: unknown[]): string {
  return args.map(safeStringify).join(" ");
}

function push(level: Level, args: unknown[]) {
  const entry: CapturedEntry = {
    level,
    ts: Date.now(),
    message: format(args),
  };
  buffer.push(entry);
  // Trimma bara när vi går över för att undvika varje-call-overhead
  if (buffer.length > MAX_ENTRIES) {
    buffer = buffer.slice(buffer.length - MAX_ENTRIES);
  }
}

export function installConsoleCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  console.log = (...args: unknown[]) => {
    push("log", args);
    original.log(...args);
  };
  console.info = (...args: unknown[]) => {
    push("info", args);
    original.info(...args);
  };
  console.warn = (...args: unknown[]) => {
    push("warn", args);
    original.warn(...args);
  };
  console.error = (...args: unknown[]) => {
    push("error", args);
    original.error(...args);
  };

  // Fånga ohanterade fel också. De är ofta de mest värdefulla för buggar.
  window.addEventListener("error", (event) => {
    push("error", [
      `Unhandled error: ${event.message}`,
      `at ${event.filename}:${event.lineno}:${event.colno}`,
      event.error,
    ]);
  });

  window.addEventListener("unhandledrejection", (event) => {
    push("error", ["Unhandled promise rejection:", event.reason]);
  });
}

export function getConsoleLogSnapshot(): string {
  if (buffer.length === 0) return "";
  return buffer
    .map((e) => {
      const t = new Date(e.ts).toISOString();
      return `[${t}] [${e.level.toUpperCase()}] ${e.message}`;
    })
    .join("\n");
}

export function clearConsoleLog() {
  buffer = [];
}
