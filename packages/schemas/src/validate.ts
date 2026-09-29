import { z, type ZodSchema, type ZodError } from "zod";

export class ValidationError extends Error {
  readonly name = "ValidationError";
  readonly issues: ZodError["issues"];

  constructor(message: string, error: ZodError) {
    super(message);
    this.issues = error.issues;
  }
}

export type ValidateSuccess<T> = { success: true; data: T };
export type ValidateFailure = {
  success: false;
  error: ValidationError;
  issues: ZodError["issues"];
};
export type ValidateResult<T> = ValidateSuccess<T> | ValidateFailure;

/** Safe parse that returns a typed result (never throws). */
export function validate<T>(
  schema: ZodSchema<T>,
  data: unknown,
): ValidateResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    error: new ValidationError("Validation failed", result.error),
    issues: result.error.issues,
  };
}

/** Parse or throw ValidationError. */
export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = validate(schema, data);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

export { z };
