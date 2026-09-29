/**
 * Branded UUID string helpers.
 * Public IDs in PVG are UUIDs — never sequential integers.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare const __brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** Opaque UUID brand used for all public resource identifiers. */
export type UUID = Brand<string, "UUID">;

export type UserId = Brand<string, "UserId">;
export type WorkspaceId = Brand<string, "WorkspaceId">;
export type ProjectId = Brand<string, "ProjectId">;
export type AssetId = Brand<string, "AssetId">;
export type GenerationJobId = Brand<string, "GenerationJobId">;
export type ProviderConnectionId = Brand<string, "ProviderConnectionId">;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function asUuid(value: string): UUID {
  if (!isUuid(value)) {
    throw new TypeError(`Invalid UUID: ${value}`);
  }
  return value as UUID;
}

export function asUserId(value: string): UserId {
  return asUuid(value) as unknown as UserId;
}

export function asWorkspaceId(value: string): WorkspaceId {
  return asUuid(value) as unknown as WorkspaceId;
}

export function asProjectId(value: string): ProjectId {
  return asUuid(value) as unknown as ProjectId;
}

export function asAssetId(value: string): AssetId {
  return asUuid(value) as unknown as AssetId;
}

export function asGenerationJobId(value: string): GenerationJobId {
  return asUuid(value) as unknown as GenerationJobId;
}

export function asProviderConnectionId(value: string): ProviderConnectionId {
  return asUuid(value) as unknown as ProviderConnectionId;
}
