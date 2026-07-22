import { NextResponse } from "next/server";

const DATABASE_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

export function ok(data, init) {
  return NextResponse.json(data, init);
}

export function fail(message, status = 400, extra = {}) {
  return NextResponse.json(
    {
      error: message,
      ...extra,
    },
    { status },
  );
}

function stringifyError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error.message === "string") {
    return error.message;
  }

  return String(error);
}

export function isDatabaseUnavailableError(error) {
  if (DATABASE_UNAVAILABLE_CODES.has(error?.code)) {
    return true;
  }

  const message = stringifyError(error).toLowerCase();

  return [
    "can't reach database server",
    "timed out fetching a new connection",
    "connection error",
    "connection refused",
    "server closed the connection unexpectedly",
    "remaining connection slots are reserved",
    "enotfound",
    "econnreset",
  ].some((fragment) => message.includes(fragment));
}

export function handleRouteError(error, fallbackMessage = "Unexpected server error.", options = {}) {
  if (error?.code === "P2025") {
    return fail(options.notFoundMessage || "Record not found.", 404);
  }

  if (error?.code === "P2002" && options.conflictMessage) {
    return fail(options.conflictMessage, 409);
  }

  if (isDatabaseUnavailableError(error)) {
    return fail(
      options.databaseMessage || "Database is unreachable right now. Check your Neon connection and try again.",
      503,
    );
  }

  return fail(fallbackMessage, 500);
}
