export type ProjectFormatErrorCode =
  | "PROJECT_CORRUPT"
  | "PROJECT_INVALID"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "MISSING_REFERENCE"
  | "DUPLICATE_ID";

export abstract class ProjectFormatError extends Error {
  abstract readonly code: ProjectFormatErrorCode;
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

/** Non-JSON or structurally unreadable project payload. */
export class ProjectCorrupt extends ProjectFormatError {
  readonly code = "PROJECT_CORRUPT" as const;
}

/** Schema validation failed (shape/types). */
export class ProjectInvalid extends ProjectFormatError {
  readonly code = "PROJECT_INVALID" as const;
}

/** schemaVersion not supported and no migration path. */
export class UnsupportedSchemaVersion extends ProjectFormatError {
  readonly code = "UNSUPPORTED_SCHEMA_VERSION" as const;
}

/** Asset or other reference points at a missing id. */
export class MissingReference extends ProjectFormatError {
  readonly code = "MISSING_REFERENCE" as const;
}

/** Duplicate entity ids within the project document. */
export class DuplicateId extends ProjectFormatError {
  readonly code = "DUPLICATE_ID" as const;
}
