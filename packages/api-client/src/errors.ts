import type { ApiError } from "@pvg/types";
import { isApiError } from "@pvg/types";

export class ApiClientError extends Error {
  readonly name = "ApiClientError";
  readonly status: number;
  readonly apiError: ApiError;

  constructor(apiError: ApiError, status: number) {
    super(apiError.message);
    this.status = status;
    this.apiError = apiError;
  }
}

export function createRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatValidationMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const errors = Array.isArray(details)
    ? details
    : Array.isArray((details as { errors?: unknown }).errors)
      ? (details as { errors: unknown[] }).errors
      : null;
  if (!errors?.length) return null;
  const first = errors[0];
  if (!first || typeof first !== "object") return null;
  const row = first as { loc?: unknown; msg?: unknown; ctx?: { min_length?: number } };
  const loc = Array.isArray(row.loc)
    ? row.loc.filter((p) => p !== "body").join(".")
    : "";
  const field = loc || "field";
  if (typeof row.msg === "string") {
    if (row.msg.includes("at least") && field === "password") {
      return "Password must be at least 10 characters";
    }
    if (row.msg.toLowerCase().includes("email")) {
      return "Enter a valid email address";
    }
    return field === "field" ? row.msg : `${field}: ${row.msg}`;
  }
  if (row.ctx?.min_length && field === "password") {
    return `Password must be at least ${row.ctx.min_length} characters`;
  }
  return null;
}

/**
 * Parse a failed response body into ApiError.
 * Prefer JSON body; fall back to statusText with request_id from header/body.
 */
export async function parseApiError(
  response: Response,
  fallbackRequestId: string,
): Promise<ApiError> {
  const headerId = response.headers.get("x-request-id") ?? fallbackRequestId;
  let body: unknown;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return {
        code: "http_error",
        message: text.slice(0, 500) || response.statusText || "Request failed",
        request_id: headerId,
        status: response.status,
      };
    }
  }

  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    // Support { error: ApiError } envelope or flat ApiError
    const candidate =
      obj.error && typeof obj.error === "object"
        ? (obj.error as Record<string, unknown>)
        : obj;

    const friendly = formatValidationMessage(candidate.details);

    if (isApiError(candidate)) {
      return {
        ...candidate,
        message: friendly || candidate.message,
        request_id: candidate.request_id || headerId,
        status: response.status,
      };
    }

    if (typeof candidate.message === "string" || typeof candidate.code === "string") {
      return {
        code: typeof candidate.code === "string" ? candidate.code : "http_error",
        message:
          friendly ||
          (typeof candidate.message === "string"
            ? candidate.message
            : response.statusText || "Request failed"),
        details:
          candidate.details && typeof candidate.details === "object"
            ? (candidate.details as ApiError["details"])
            : undefined,
        request_id:
          typeof candidate.request_id === "string"
            ? candidate.request_id
            : headerId,
        status: response.status,
      };
    }
  }

  return {
    code: "http_error",
    message: response.statusText || `HTTP ${response.status}`,
    request_id: headerId,
    status: response.status,
  };
}
