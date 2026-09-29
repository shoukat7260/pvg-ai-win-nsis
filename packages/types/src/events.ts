/**
 * Audit and security event type constants (foundation).
 */

export type AuditEventType =
  | "user.login"
  | "user.logout"
  | "workspace.created"
  | "workspace.updated"
  | "workspace.member_added"
  | "workspace.member_removed"
  | "workspace.member_role_changed"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "project.exported"
  | "asset.created"
  | "asset.updated"
  | "asset.deleted"
  | "connection.created"
  | "connection.updated"
  | "connection.deleted"
  | "generation.queued"
  | "generation.completed"
  | "generation.failed";

export const AUDIT_EVENT_TYPES: readonly AuditEventType[] = Object.freeze([
  "user.login",
  "user.logout",
  "workspace.created",
  "workspace.updated",
  "workspace.member_added",
  "workspace.member_removed",
  "workspace.member_role_changed",
  "project.created",
  "project.updated",
  "project.deleted",
  "project.exported",
  "asset.created",
  "asset.updated",
  "asset.deleted",
  "connection.created",
  "connection.updated",
  "connection.deleted",
  "generation.queued",
  "generation.completed",
  "generation.failed",
]);

export type SecurityEventType =
  | "AUTH_FAILURE"
  | "AUTHORIZATION_DENIED"
  | "TOKEN_REPLAY_SUSPECTED"
  | "RATE_LIMIT_EXCEEDED"
  | "PATH_TRAVERSAL_REJECTED"
  | "INVALID_CREDENTIAL_REF"
  | "SECRET_REDACTION_TRIGGERED"
  | "SUSPICIOUS_IDOR_ATTEMPT";

export const SECURITY_EVENT_TYPES: readonly SecurityEventType[] = Object.freeze([
  "AUTH_FAILURE",
  "AUTHORIZATION_DENIED",
  "TOKEN_REPLAY_SUSPECTED",
  "RATE_LIMIT_EXCEEDED",
  "PATH_TRAVERSAL_REJECTED",
  "INVALID_CREDENTIAL_REF",
  "SECRET_REDACTION_TRIGGERED",
  "SUSPICIOUS_IDOR_ATTEMPT",
]);

export function isAuditEventType(value: unknown): value is AuditEventType {
  return (
    typeof value === "string" &&
    (AUDIT_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export function isSecurityEventType(value: unknown): value is SecurityEventType {
  return (
    typeof value === "string" &&
    (SECURITY_EVENT_TYPES as readonly string[]).includes(value)
  );
}

export interface AuditEvent {
  type: AuditEventType;
  actorUserId: string | null;
  workspaceId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  occurredAt: string;
}

export interface SecurityEvent {
  type: SecurityEventType;
  actorUserId: string | null;
  workspaceId: string | null;
  reason: string;
  metadata: Record<string, unknown>;
  requestId: string | null;
  occurredAt: string;
}
