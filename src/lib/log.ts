type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE_KEY = /(token|secret|password|authorization|api[-_]?key|webhook)/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[deep]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }
  if (Array.isArray(value)) return value.map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: Level, msg: string, data?: Record<string, unknown>): void {
  const entry = JSON.stringify({
    level,
    msg,
    time: new Date().toISOString(),
    ...(data ? (sanitize(data) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export const log = {
  debug: (msg: string, data?: Record<string, unknown>) =>
    emit("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
};
