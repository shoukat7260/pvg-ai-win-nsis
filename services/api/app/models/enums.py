"""Domain enumerations."""

from __future__ import annotations

from enum import StrEnum


class UserStatus(StrEnum):
    PENDING_VERIFICATION = "pending_verification"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DISABLED = "disabled"
    DELETED = "deleted"
    # Phase 1 alias kept for any lingering fixtures
    PENDING = "pending_verification"


class WorkspaceType(StrEnum):
    PERSONAL = "personal"
    CLIENT = "client"
    AGENCY = "agency"
    TEAM = "team"


class WorkspaceRole(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    CREATOR = "creator"
    REVIEWER = "reviewer"
    VIEWER = "viewer"


class ProjectStatus(StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class AssetKind(StrEnum):
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"
    DOCUMENT = "document"
    OTHER = "other"


class GenerationStatus(StrEnum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProviderType(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL = "local"
    OTHER = "other"


class ProviderConnectionStatus(StrEnum):
    ACTIVE = "active"
    INVALID = "invalid"
    REVOKED = "revoked"
    PENDING = "pending"


class ConnectionMethod(StrEnum):
    API_KEY = "api_key"
    OAUTH = "oauth"
    LOCAL = "local"
    OTHER = "other"


class DeviceStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"
    PENDING = "pending"


class SessionStatus(StrEnum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"


class MfaMethodType(StrEnum):
    TOTP = "totp"


class PlanCode(StrEnum):
    FREE = "FREE"
    CREATOR = "CREATOR"
    PRO = "PRO"
    AGENCY = "AGENCY"


class SubscriptionStatus(StrEnum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"
    EXPIRED = "expired"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    PAID = "paid"
    VOID = "void"
    UNCOLLECTIBLE = "uncollectible"


class AuditAction(StrEnum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    AUTHORIZE = "authorize"
    DENY = "deny"
    PASSWORD_RESET = "password_reset"
    EMAIL_VERIFY = "email_verify"
    MFA_ENABLE = "mfa_enable"
    MFA_DISABLE = "mfa_disable"
    SUBSCRIPTION_CHANGE = "subscription_change"


class SecurityEventType(StrEnum):
    AUTHORIZATION_DENIED = "authorization_denied"
    AUTHENTICATION_FAILED = "authentication_failed"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"
    SUSPICIOUS_INPUT = "suspicious_input"
    TEST_AUTH_REFUSED = "test_auth_refused"
    SECRET_ACCESS_ATTEMPT = "secret_access_attempt"
    REFRESH_REUSE_DETECTED = "refresh_reuse_detected"
    MFA_FAILED = "mfa_failed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    OAUTH_STATE_MISMATCH = "oauth_state_mismatch"
