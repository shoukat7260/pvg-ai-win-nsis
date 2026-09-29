/**
 * Structured API error shape for /api/v1 responses.
 */

export interface ApiErrorDetail {
  field?: string;
  code?: string;
  message: string;
}

export interface ApiError {
  /** Machine-readable error code, e.g. "unauthorized", "validation_error". */
  code: string;
  /** Human-readable summary suitable for UI display. */
  message: string;
  /** Optional field-level details. */
  details?: ApiErrorDetail[];
  /** Correlation id mirrored from `X-Request-Id` / response body. */
  request_id: string;
  /** Optional HTTP status when known client-side. */
  status?: number;
}

export function isApiError(value: unknown): value is ApiError {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.code === "string" &&
    typeof v.message === "string" &&
    typeof v.request_id === "string"
  );
}
