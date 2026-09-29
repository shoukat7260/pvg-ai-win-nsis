/** Current on-disk project.json schema version (Phase 4 editor). */
export const CURRENT_PROJECT_SCHEMA_VERSION = 3 as const;

export type ProjectSchemaVersion = typeof CURRENT_PROJECT_SCHEMA_VERSION;
