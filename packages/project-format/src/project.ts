import { formatZodIssues } from "@pvg/schemas";
import {
  ProjectDocumentSchema,
  ProjectDocumentVersionProbeSchema,
  type ProjectDocument,
} from "./schema.js";
import {
  ProjectCorrupt,
  ProjectInvalid,
  UnsupportedSchemaVersion,
} from "./errors.js";
import { assertProjectIntegrity } from "./integrity.js";
import {
  defaultMigrationRegistry,
  type MigrationRegistry,
} from "./migrate.js";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "./version.js";

export interface ValidateProjectOptions {
  /** Skip integrity (duplicates / refs / timestamps). Default false. */
  skipIntegrity?: boolean;
}

export interface LoadProjectOptions extends ValidateProjectOptions {
  /** Target schema version after migration. Defaults to CURRENT. */
  targetVersion?: number;
  migrationRegistry?: MigrationRegistry;
}

function parseJsonInput(input: unknown): unknown {
  if (typeof input === "string") {
    try {
      return JSON.parse(input) as unknown;
    } catch (err) {
      throw new ProjectCorrupt("project.json is not valid JSON", {
        cause: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ProjectCorrupt("Project payload must be a JSON object", {
      received: Array.isArray(input) ? "array" : typeof input,
    });
  }
  return input;
}

/**
 * Validate a project document against the current schema + integrity rules.
 * Does not migrate — use loadProject / migrateProject for version upgrades.
 */
export function validateProject(
  data: unknown,
  options: ValidateProjectOptions = {},
): ProjectDocument {
  const parsed = ProjectDocumentSchema.safeParse(data);
  if (!parsed.success) {
    // Distinguish unsupported version from general invalidity when possible
    if (
      data !== null &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      "schemaVersion" in data
    ) {
      const v = (data as { schemaVersion: unknown }).schemaVersion;
      if (
        typeof v === "number" &&
        Number.isInteger(v) &&
        v !== CURRENT_PROJECT_SCHEMA_VERSION
      ) {
        throw new UnsupportedSchemaVersion(
          `Unsupported schemaVersion ${v}; current is ${CURRENT_PROJECT_SCHEMA_VERSION}`,
          { schemaVersion: v, current: CURRENT_PROJECT_SCHEMA_VERSION },
        );
      }
    }
    throw new ProjectInvalid(formatZodIssues(parsed.error), {
      issues: parsed.error.issues,
    });
  }

  if (!options.skipIntegrity) {
    assertProjectIntegrity(parsed.data);
  }
  return parsed.data;
}

/**
 * Migrate a raw project object toward targetVersion using the registry.
 * Throws UnsupportedSchemaVersion when no path exists.
 * Does not silently reinterpret incompatible data.
 */
export function migrateProject(
  data: unknown,
  targetVersion: number = CURRENT_PROJECT_SCHEMA_VERSION,
  registry: MigrationRegistry = defaultMigrationRegistry,
): ProjectDocument {
  const obj = parseJsonInput(data) as Record<string, unknown>;
  const probe = ProjectDocumentVersionProbeSchema.safeParse(obj);
  if (!probe.success) {
    throw new ProjectInvalid("Missing or invalid schemaVersion", {
      issues: probe.error.issues,
    });
  }

  const fromVersion = probe.data.schemaVersion;
  if (fromVersion > CURRENT_PROJECT_SCHEMA_VERSION && fromVersion > targetVersion) {
    throw new UnsupportedSchemaVersion(
      `Project schemaVersion ${fromVersion} is newer than supported ${CURRENT_PROJECT_SCHEMA_VERSION}`,
      { schemaVersion: fromVersion, current: CURRENT_PROJECT_SCHEMA_VERSION },
    );
  }

  const migrated = registry.migrate(obj, fromVersion, targetVersion);
  return validateProject(migrated);
}

/**
 * Load a project from a plain object or JSON string.
 * Migrates when needed, then validates + integrity-checks.
 */
export function loadProject(
  input: unknown,
  options: LoadProjectOptions = {},
): ProjectDocument {
  const obj = parseJsonInput(input) as Record<string, unknown>;
  const probe = ProjectDocumentVersionProbeSchema.safeParse(obj);
  if (!probe.success) {
    throw new ProjectCorrupt("Missing or invalid schemaVersion", {
      issues: probe.error.issues,
    });
  }

  const fromVersion = probe.data.schemaVersion;
  const target = options.targetVersion ?? CURRENT_PROJECT_SCHEMA_VERSION;
  const registry = options.migrationRegistry ?? defaultMigrationRegistry;

  if (fromVersion > CURRENT_PROJECT_SCHEMA_VERSION) {
    throw new UnsupportedSchemaVersion(
      `Project schemaVersion ${fromVersion} is newer than supported ${CURRENT_PROJECT_SCHEMA_VERSION}`,
      { schemaVersion: fromVersion, current: CURRENT_PROJECT_SCHEMA_VERSION },
    );
  }

  let candidate: unknown = obj;
  if (fromVersion !== target) {
    candidate = registry.migrate(obj, fromVersion, target);
  }

  return validateProject(candidate, { skipIntegrity: options.skipIntegrity });
}

/** Serialize a validated project document to pretty JSON. */
export function saveProject(doc: ProjectDocument): string {
  const validated = validateProject(doc);
  return `${JSON.stringify(validated, null, 2)}\n`;
}
