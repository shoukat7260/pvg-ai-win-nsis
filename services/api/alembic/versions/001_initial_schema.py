"""Initial schema: tenant tables, roles, grants, and RLS policies.

Revision ID: 001_initial_schema
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Roles (idempotent for local/dev). Passwords match compose defaults.
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvg_migrator') THEN
            CREATE ROLE pvg_migrator LOGIN PASSWORD 'pvg_migrator_dev_change_me';
          END IF;
          IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pvg_app') THEN
            CREATE ROLE pvg_app LOGIN PASSWORD 'pvg_dev_change_me';
          END IF;
        END
        $$;
        """
    )
    op.execute("GRANT USAGE ON SCHEMA public TO pvg_app")
    op.execute("GRANT USAGE ON SCHEMA public TO pvg_migrator")
    # Migrator owns schema and must bypass RLS; app role remains subject to FORCE RLS
    op.execute("ALTER ROLE pvg_migrator BYPASSRLS")
    op.execute("ALTER ROLE pvg_app NOBYPASSRLS")

    uuid_type = postgresql.UUID(as_uuid=True)
    jsonb = postgresql.JSONB(astext_type=sa.Text())

    op.create_table(
        "users",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("normalized_email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("password_hash", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("normalized_email", name="uq_users_normalized_email"),
        sa.CheckConstraint("length(email) > 0", name="ck_users_email_nonempty"),
    )

    op.create_table(
        "workspaces",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(32), nullable=False, server_default="personal"),
        sa.Column("owner_id", uuid_type, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(name) > 0", name="ck_workspaces_name_nonempty"),
    )
    op.create_index("ix_workspaces_owner_id", "workspaces", ["owner_id"])
    op.create_index(
        "ix_workspaces_active",
        "workspaces",
        ["id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "workspace_members",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "workspace_id",
            uuid_type,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(32), nullable=False, server_default="viewer"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("workspace_id", "user_id", name="uq_workspace_members_ws_user"),
    )
    op.create_index("ix_workspace_members_workspace_id", "workspace_members", ["workspace_id"])
    op.create_index("ix_workspace_members_user_id", "workspace_members", ["user_id"])

    op.create_table(
        "projects",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "workspace_id",
            uuid_type,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column(
            "created_by",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(name) > 0", name="ck_projects_name_nonempty"),
    )
    op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"])
    op.create_index("ix_projects_created_by", "projects", ["created_by"])
    op.create_index(
        "ix_projects_active",
        "projects",
        ["workspace_id"],
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.create_table(
        "project_members",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "project_id",
            uuid_type,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(32), nullable=False, server_default="viewer"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("project_id", "user_id", name="uq_project_members_project_user"),
    )
    op.create_index("ix_project_members_project_id", "project_members", ["project_id"])
    op.create_index("ix_project_members_user_id", "project_members", ["user_id"])

    op.create_table(
        "assets",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "workspace_id",
            uuid_type,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            uuid_type,
            sa.ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False, server_default="other"),
        sa.Column("content_type", sa.String(128), nullable=True),
        sa.Column("storage_ref", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_assets_workspace_id", "assets", ["workspace_id"])
    op.create_index("ix_assets_project_id", "assets", ["project_id"])
    op.create_index("ix_assets_created_by", "assets", ["created_by"])

    op.create_table(
        "generation_jobs",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "workspace_id",
            uuid_type,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            uuid_type,
            sa.ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("provider_type", sa.String(32), nullable=False, server_default="other"),
        sa.Column(
            "created_by",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("request_metadata", jsonb, nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_generation_jobs_workspace_id", "generation_jobs", ["workspace_id"])
    op.create_index("ix_generation_jobs_project_id", "generation_jobs", ["project_id"])
    op.create_index("ix_generation_jobs_created_by", "generation_jobs", ["created_by"])

    op.create_table(
        "provider_connections",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "workspace_id",
            uuid_type,
            sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider_type", sa.String(32), nullable=False, server_default="other"),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("credential_ref", sa.Text(), nullable=True),
        sa.Column(
            "created_by",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_provider_connections_workspace_id", "provider_connections", ["workspace_id"])
    op.create_index("ix_provider_connections_created_by", "provider_connections", ["created_by"])

    op.create_table(
        "devices",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("device_name", sa.String(255), nullable=False),
        sa.Column("device_fingerprint", sa.String(255), nullable=False),
        sa.Column("platform", sa.String(64), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("device_fingerprint", name="uq_devices_device_fingerprint"),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"])

    op.create_table(
        "sessions",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            uuid_type,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "device_id",
            uuid_type,
            sa.ForeignKey("devices.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("refresh_token_hash", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])
    op.create_index("ix_sessions_device_id", "sessions", ["device_id"])

    op.create_table(
        "audit_logs",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("actor_user_id", uuid_type, nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource_type", sa.String(64), nullable=False),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("workspace_id", uuid_type, nullable=True),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("metadata_json", jsonb, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("message", sa.Text(), nullable=True),
    )
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_workspace_id", "audit_logs", ["workspace_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    op.create_table(
        "security_events",
        sa.Column("id", uuid_type, primary_key=True, nullable=False),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False, server_default="warning"),
        sa.Column("actor_user_id", uuid_type, nullable=True),
        sa.Column("target_user_id", uuid_type, nullable=True),
        sa.Column("resource_type", sa.String(64), nullable=True),
        sa.Column("resource_id", sa.String(64), nullable=True),
        sa.Column("workspace_id", uuid_type, nullable=True),
        sa.Column("request_id", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("details", jsonb, nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_security_events_event_type", "security_events", ["event_type"])
    op.create_index("ix_security_events_actor_user_id", "security_events", ["actor_user_id"])
    op.create_index("ix_security_events_created_at", "security_events", ["created_at"])

    # Grants: pvg_app is subject to RLS; pvg_migrator owns / bypasses
    for table in (
        "users",
        "workspaces",
        "workspace_members",
        "projects",
        "project_members",
        "assets",
        "generation_jobs",
        "provider_connections",
        "devices",
        "sessions",
        "audit_logs",
        "security_events",
    ):
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE {table} TO pvg_app")
        op.execute(f"GRANT ALL ON TABLE {table} TO pvg_migrator")

    # RLS helper: membership OR workspace id in session GUC list
    workspace_policy = """
        id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = workspaces.id
            AND wm.user_id::text = current_setting('app.current_user_id', true)
        )
    """
    tenant_workspace_id_policy = """
        workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = {table}.workspace_id
            AND wm.user_id::text = current_setting('app.current_user_id', true)
        )
    """

    def enable_rls(table: str, policy_sql: str) -> None:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        # SELECT / DELETE / UPDATE use USING; INSERT uses WITH CHECK only
        for cmd in ("SELECT", "DELETE"):
            op.execute(
                f"""
                CREATE POLICY {table}_{cmd.lower()}_policy ON {table}
                  FOR {cmd}
                  TO pvg_app
                  USING ({policy_sql})
                """
            )
        op.execute(
            f"""
            CREATE POLICY {table}_insert_policy ON {table}
              FOR INSERT
              TO pvg_app
              WITH CHECK ({policy_sql})
            """
        )
        op.execute(
            f"""
            CREATE POLICY {table}_update_policy ON {table}
              FOR UPDATE
              TO pvg_app
              USING ({policy_sql})
              WITH CHECK ({policy_sql})
            """
        )

    enable_rls("workspaces", workspace_policy)
    # Replace workspace INSERT policy: allow create when authenticated user is owner
    op.execute("DROP POLICY IF EXISTS workspaces_insert_policy ON workspaces")
    op.execute(
        """
        CREATE POLICY workspaces_insert_policy ON workspaces
          FOR INSERT TO pvg_app
          WITH CHECK (
            owner_id::text = current_setting('app.current_user_id', true)
          )
        """
    )
    for tbl in ("projects", "assets", "generation_jobs", "provider_connections"):
        enable_rls(tbl, tenant_workspace_id_policy.format(table=tbl))

    # workspace_members: user can see memberships for their workspaces or their own rows
    op.execute("ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE workspace_members FORCE ROW LEVEL SECURITY")
    members_policy = """
        user_id::text = current_setting('app.current_user_id', true)
        OR workspace_id::text = ANY(string_to_array(current_setting('app.current_workspace_ids', true), ','))
    """
    op.execute(
        f"""
        CREATE POLICY workspace_members_select_policy ON workspace_members
          FOR SELECT TO pvg_app USING ({members_policy})
        """
    )
    op.execute(
        f"""
        CREATE POLICY workspace_members_insert_policy ON workspace_members
          FOR INSERT TO pvg_app WITH CHECK ({members_policy})
        """
    )
    op.execute(
        f"""
        CREATE POLICY workspace_members_update_policy ON workspace_members
          FOR UPDATE TO pvg_app USING ({members_policy}) WITH CHECK ({members_policy})
        """
    )
    op.execute(
        f"""
        CREATE POLICY workspace_members_delete_policy ON workspace_members
          FOR DELETE TO pvg_app USING ({members_policy})
        """
    )


def downgrade() -> None:
    for table in (
        "workspaces",
        "projects",
        "assets",
        "generation_jobs",
        "provider_connections",
        "workspace_members",
    ):
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    for table in (
        "security_events",
        "audit_logs",
        "sessions",
        "devices",
        "provider_connections",
        "generation_jobs",
        "assets",
        "project_members",
        "projects",
        "workspace_members",
        "workspaces",
        "users",
    ):
        op.drop_table(table)
