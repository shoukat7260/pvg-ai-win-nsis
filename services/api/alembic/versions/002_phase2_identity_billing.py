"""Phase 2 identity, MFA, OAuth, billing schema.

Revision ID: 002_phase2_identity_billing
Revises: 001_initial_schema
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "002_phase2_identity_billing"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

uuid_type = postgresql.UUID(as_uuid=True)
jsonb = postgresql.JSONB(astext_type=sa.Text())


def _user_owned_rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    # Normal user scope OR trusted server-side auth_lookup for hash-based token exchange
    policy = (
        f"(user_id::text = current_setting('app.current_user_id', true) "
        f"OR current_setting('app.auth_lookup', true) = '1')"
    )
    for cmd in ("SELECT", "DELETE"):
        op.execute(
            f"""
            CREATE POLICY {table}_{cmd.lower()}_policy ON {table}
              FOR {cmd} TO pvg_app USING ({policy})
            """
        )
    op.execute(
        f"""
        CREATE POLICY {table}_insert_policy ON {table}
          FOR INSERT TO pvg_app WITH CHECK (
            user_id::text = current_setting('app.current_user_id', true)
            OR current_setting('app.auth_lookup', true) = '1'
          )
        """
    )
    op.execute(
        f"""
        CREATE POLICY {table}_update_policy ON {table}
          FOR UPDATE TO pvg_app USING ({policy}) WITH CHECK ({policy})
        """
    )


def upgrade() -> None:
    # --- sessions extensions ---
    op.add_column(
        "sessions",
        sa.Column("family_id", uuid_type, nullable=True),
    )
    op.execute("UPDATE sessions SET family_id = id WHERE family_id IS NULL")
    op.alter_column("sessions", "family_id", nullable=False)
    op.create_index("ix_sessions_family_id", "sessions", ["family_id"])
    op.add_column("sessions", sa.Column("access_jti", sa.String(64), nullable=True))
    op.create_index("ix_sessions_access_jti", "sessions", ["access_jti"])
    op.add_column("sessions", sa.Column("revoke_reason", sa.String(64), nullable=True))
    op.add_column("sessions", sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("sessions", sa.Column("created_from", sa.String(32), nullable=True))

    # --- devices extensions ---
    op.add_column("devices", sa.Column("device_public_id", sa.String(64), nullable=True))
    op.execute(
        "UPDATE devices SET device_public_id = replace(id::text, '-', '') WHERE device_public_id IS NULL"
    )
    op.alter_column("devices", "device_public_id", nullable=False)
    op.create_unique_constraint("uq_devices_device_public_id", "devices", ["device_public_id"])
    op.add_column("devices", sa.Column("os_version", sa.String(64), nullable=True))
    op.add_column("devices", sa.Column("app_version", sa.String(64), nullable=True))
    op.add_column("devices", sa.Column("architecture", sa.String(32), nullable=True))
    op.add_column(
        "devices",
        sa.Column("trusted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("devices", sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("devices", sa.Column("last_ip", sa.String(64), nullable=True))

    # --- provider_connections dual-scope ---
    # Keep workspace_id for Phase 1 tenant scope; allow NULL for user/device-only rows.
    op.alter_column(
        "provider_connections",
        "workspace_id",
        existing_type=uuid_type,
        nullable=True,
    )
    op.add_column(
        "provider_connections",
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
    )
    op.create_index("ix_provider_connections_user_id", "provider_connections", ["user_id"])
    op.add_column(
        "provider_connections",
        sa.Column("device_id", uuid_type, sa.ForeignKey("devices.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_provider_connections_device_id", "provider_connections", ["device_id"])
    op.add_column(
        "provider_connections",
        sa.Column("connection_method", sa.String(32), nullable=False, server_default="api_key"),
    )
    op.add_column(
        "provider_connections",
        sa.Column("last_validated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "provider_connections",
        sa.Column("account_label", sa.String(255), nullable=True),
    )
    # Backfill user_id from created_by for existing rows
    op.execute("UPDATE provider_connections SET user_id = created_by WHERE user_id IS NULL")

    # Drop old workspace-only RLS policies and recreate dual-scope
    for cmd in ("select", "insert", "update", "delete"):
        op.execute(f"DROP POLICY IF EXISTS provider_connections_{cmd}_policy ON provider_connections")

    dual_policy = """
        (
          workspace_id IS NOT NULL AND (
            workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
            OR EXISTS (
              SELECT 1 FROM workspace_members wm
              WHERE wm.workspace_id = provider_connections.workspace_id
                AND wm.user_id::text = current_setting('app.current_user_id', true)
            )
          )
        )
        OR (
          user_id IS NOT NULL
          AND user_id::text = current_setting('app.current_user_id', true)
        )
    """
    for cmd in ("SELECT", "DELETE"):
        op.execute(
            f"""
            CREATE POLICY provider_connections_{cmd.lower()}_policy ON provider_connections
              FOR {cmd} TO pvg_app USING ({dual_policy})
            """
        )
    op.execute(
        f"""
        CREATE POLICY provider_connections_insert_policy ON provider_connections
          FOR INSERT TO pvg_app WITH CHECK ({dual_policy})
        """
    )
    op.execute(
        f"""
        CREATE POLICY provider_connections_update_policy ON provider_connections
          FOR UPDATE TO pvg_app USING ({dual_policy}) WITH CHECK ({dual_policy})
        """
    )

    # --- identity tables ---
    op.create_table(
        "oauth_identities",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("provider_subject", sa.String(255), nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("raw_profile_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("provider", "provider_subject", name="uq_oauth_provider_subject"),
    )
    op.create_index("ix_oauth_identities_user_id", "oauth_identities", ["user_id"])

    op.create_table(
        "mfa_methods",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", sa.String(32), nullable=False, server_default="totp"),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("enabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_mfa_methods_user_id", "mfa_methods", ["user_id"])

    op.create_table(
        "mfa_recovery_codes",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_mfa_recovery_codes_user_id", "mfa_recovery_codes", ["user_id"])

    op.create_table(
        "email_verification_tokens",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_email_verification_tokens_token_hash"),
    )
    op.create_index("ix_email_verification_tokens_user_id", "email_verification_tokens", ["user_id"])

    op.create_table(
        "password_reset_tokens",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("token_hash", name="uq_password_reset_tokens_token_hash"),
    )
    op.create_index("ix_password_reset_tokens_user_id", "password_reset_tokens", ["user_id"])

    op.create_table(
        "auth_login_challenges",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("challenge_hash", sa.Text(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("device_fingerprint", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("challenge_hash", name="uq_auth_login_challenges_challenge_hash"),
    )
    op.create_index("ix_auth_login_challenges_user_id", "auth_login_challenges", ["user_id"])

    op.create_table(
        "desktop_auth_codes",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("session_id", uuid_type, sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("code_challenge", sa.String(128), nullable=False),
        sa.Column("code_challenge_method", sa.String(16), nullable=False, server_default="S256"),
        sa.Column("state_hash", sa.String(128), nullable=False),
        sa.Column("redirect_uri", sa.String(512), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("code_hash", name="uq_desktop_auth_codes_code_hash"),
    )
    op.create_index("ix_desktop_auth_codes_user_id", "desktop_auth_codes", ["user_id"])

    op.create_table(
        "provider_usage_snapshots",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "connection_id",
            uuid_type,
            sa.ForeignKey("provider_connections.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_provider_usage_snapshots_connection_id", "provider_usage_snapshots", ["connection_id"])
    op.create_index("ix_provider_usage_snapshots_user_id", "provider_usage_snapshots", ["user_id"])

    # --- billing ---
    op.create_table(
        "plans",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
        sa.Column("billing_interval", sa.String(16), nullable=False, server_default="month"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("code", name="uq_plans_code"),
    )

    op.create_table(
        "plan_features",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("plan_id", uuid_type, sa.ForeignKey("plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(64), nullable=False),
        sa.Column("feature_value", sa.String(255), nullable=False),
        sa.Column("limit_value", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("plan_id", "feature_key", name="uq_plan_features_plan_key"),
    )
    op.create_index("ix_plan_features_plan_id", "plan_features", ["plan_id"])

    op.create_table(
        "billing_customers",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider_customer_id", sa.String(128), nullable=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", name="uq_billing_customers_user_id"),
    )
    op.create_index("ix_billing_customers_user_id", "billing_customers", ["user_id"])

    op.create_table(
        "subscriptions",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", uuid_type, sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "billing_customer_id",
            uuid_type,
            sa.ForeignKey("billing_customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("canceled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider_subscription_id", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_plan_id", "subscriptions", ["plan_id"])

    op.create_table(
        "entitlements",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(64), nullable=False),
        sa.Column("feature_value", sa.String(255), nullable=False),
        sa.Column("limit_value", sa.Integer(), nullable=True),
        sa.Column("source_plan_id", uuid_type, sa.ForeignKey("plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("user_id", "feature_key", name="uq_entitlements_user_feature"),
    )
    op.create_index("ix_entitlements_user_id", "entitlements", ["user_id"])

    op.create_table(
        "coupons",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("code", sa.String(64), nullable=False),
        sa.Column("percent_off", sa.Integer(), nullable=True),
        sa.Column("amount_off_cents", sa.Integer(), nullable=True),
        sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
        sa.Column("max_redemptions", sa.Integer(), nullable=True),
        sa.Column("redeemed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("code", name="uq_coupons_code"),
    )

    op.create_table(
        "trials",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", uuid_type, sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("converted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_trials_user_id", "trials", ["user_id"])

    op.create_table(
        "payments",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "billing_customer_id",
            uuid_type,
            sa.ForeignKey("billing_customers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("provider_payment_id", sa.String(128), nullable=True),
        sa.Column("idempotency_key", sa.String(128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("idempotency_key", name="uq_payments_idempotency_key"),
    )
    op.create_index("ix_payments_user_id", "payments", ["user_id"])

    op.create_table(
        "invoices",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "subscription_id",
            uuid_type,
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("amount_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(8), nullable=False, server_default="USD"),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("provider_invoice_id", sa.String(128), nullable=True),
        sa.Column("hosted_invoice_url", sa.Text(), nullable=True),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])

    op.create_table(
        "subscription_events",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "subscription_id",
            uuid_type,
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("provider_event_id", sa.String(128), nullable=False),
        sa.Column("payload", jsonb, nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("provider_event_id", name="uq_subscription_events_provider_event"),
    )
    op.create_index("ix_subscription_events_user_id", "subscription_events", ["user_id"])

    # Grants
    new_tables = (
        "oauth_identities",
        "mfa_methods",
        "mfa_recovery_codes",
        "email_verification_tokens",
        "password_reset_tokens",
        "auth_login_challenges",
        "desktop_auth_codes",
        "provider_usage_snapshots",
        "plans",
        "plan_features",
        "billing_customers",
        "subscriptions",
        "entitlements",
        "coupons",
        "trials",
        "payments",
        "invoices",
        "subscription_events",
    )
    for table in new_tables:
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {table} TO pvg_app")
        op.execute(f"GRANT ALL ON TABLE {table} TO pvg_migrator")

    # User-owned RLS
    for table in (
        "sessions",
        "devices",
        "oauth_identities",
        "mfa_methods",
        "mfa_recovery_codes",
        "email_verification_tokens",
        "password_reset_tokens",
        "auth_login_challenges",
        "desktop_auth_codes",
        "provider_usage_snapshots",
        "billing_customers",
        "subscriptions",
        "entitlements",
        "trials",
        "payments",
        "invoices",
    ):
        _user_owned_rls(table)

    # plans / plan_features / coupons: public catalog reads (no secrets)
    for table in ("plans", "plan_features", "coupons"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY {table}_select_policy ON {table}
              FOR SELECT TO pvg_app
              USING (true)
            """
        )

    # subscription_events: user can see own; inserts via service with RLS context or migrator
    _user_owned_rls("subscription_events")
    # Allow insert when user_id matches OR is null during webhook processing under service role
    # (app role sets user context; webhook handler uses admin/bypass carefully — events still keyed)

    # Seed plans FREE / CREATOR / PRO / AGENCY
    op.execute(
        """
        INSERT INTO plans (id, code, name, description, price_cents, currency, billing_interval, is_active, sort_order)
        VALUES
          (gen_random_uuid(), 'FREE', 'Free', 'Personal starter', 0, 'USD', 'month', true, 0),
          (gen_random_uuid(), 'CREATOR', 'Creator', 'Independent creators', 1900, 'USD', 'month', true, 1),
          (gen_random_uuid(), 'PRO', 'Pro', 'Professional studios', 4900, 'USD', 'month', true, 2),
          (gen_random_uuid(), 'AGENCY', 'Agency', 'Agencies and teams', 14900, 'USD', 'month', true, 3)
        """
    )
    op.execute(
        """
        INSERT INTO plan_features (id, plan_id, feature_key, feature_value, limit_value)
        SELECT gen_random_uuid(), p.id, f.feature_key, f.feature_value, f.limit_value
        FROM plans p
        CROSS JOIN (VALUES
          ('FREE', 'workspaces', '1', 1),
          ('FREE', 'projects', '3', 3),
          ('FREE', 'ai_generations_monthly', '10', 10),
          ('FREE', 'devices', '2', 2),
          ('CREATOR', 'workspaces', '3', 3),
          ('CREATOR', 'projects', '25', 25),
          ('CREATOR', 'ai_generations_monthly', '200', 200),
          ('CREATOR', 'devices', '5', 5),
          ('PRO', 'workspaces', '10', 10),
          ('PRO', 'projects', 'unlimited', NULL),
          ('PRO', 'ai_generations_monthly', '1000', 1000),
          ('PRO', 'devices', '15', 15),
          ('AGENCY', 'workspaces', 'unlimited', NULL),
          ('AGENCY', 'projects', 'unlimited', NULL),
          ('AGENCY', 'ai_generations_monthly', '5000', 5000),
          ('AGENCY', 'devices', 'unlimited', NULL)
        ) AS f(plan_code, feature_key, feature_value, limit_value)
        WHERE p.code = f.plan_code
        """
    )


def downgrade() -> None:
    for table in (
        "subscription_events",
        "invoices",
        "payments",
        "trials",
        "coupons",
        "entitlements",
        "subscriptions",
        "billing_customers",
        "plan_features",
        "plans",
        "provider_usage_snapshots",
        "desktop_auth_codes",
        "auth_login_challenges",
        "password_reset_tokens",
        "email_verification_tokens",
        "mfa_recovery_codes",
        "mfa_methods",
        "oauth_identities",
    ):
        op.drop_table(table)

    op.drop_column("provider_connections", "account_label")
    op.drop_column("provider_connections", "last_validated_at")
    op.drop_column("provider_connections", "connection_method")
    op.drop_index("ix_provider_connections_device_id", table_name="provider_connections")
    op.drop_column("provider_connections", "device_id")
    op.drop_index("ix_provider_connections_user_id", table_name="provider_connections")
    op.drop_column("provider_connections", "user_id")
    op.alter_column("provider_connections", "workspace_id", existing_type=uuid_type, nullable=False)

    op.drop_column("devices", "last_ip")
    op.drop_column("devices", "revoked_at")
    op.drop_column("devices", "trusted")
    op.drop_column("devices", "architecture")
    op.drop_column("devices", "app_version")
    op.drop_column("devices", "os_version")
    op.drop_constraint("uq_devices_device_public_id", "devices", type_="unique")
    op.drop_column("devices", "device_public_id")

    op.drop_column("sessions", "created_from")
    op.drop_column("sessions", "last_seen_at")
    op.drop_column("sessions", "revoke_reason")
    op.drop_index("ix_sessions_access_jti", table_name="sessions")
    op.drop_column("sessions", "access_jti")
    op.drop_index("ix_sessions_family_id", table_name="sessions")
    op.drop_column("sessions", "family_id")
