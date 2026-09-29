"""Subscription and plan helpers."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.db.rls import set_rls_context
from app.models.billing import Entitlement, Plan, PlanFeature, Subscription
from app.models.enums import PlanCode, SubscriptionStatus


class SubscriptionService:
    def __init__(self, session: AsyncSession) -> None:
        self.db = session

    async def get_plan_by_code(self, code: str) -> Plan | None:
        result = await self.db.execute(
            select(Plan).where(Plan.code == code.upper())
        )
        return result.scalar_one_or_none()

    async def list_plans(self) -> list[Plan]:
        result = await self.db.execute(
            select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order)
        )
        return list(result.scalars().all())

    async def ensure_free_subscription(self, user_id: uuid.UUID) -> Subscription:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        existing = await self.get_current(user_id)
        if existing:
            return existing
        plan = await self.get_plan_by_code(PlanCode.FREE.value)
        if plan is None:
            raise NotFoundError("FREE plan is not seeded")
        now = datetime.now(UTC)
        sub = Subscription(
            id=uuid.uuid4(),
            user_id=user_id,
            plan_id=plan.id,
            status=SubscriptionStatus.ACTIVE.value,
            current_period_start=now,
            current_period_end=now + timedelta(days=3650),
        )
        self.db.add(sub)
        await self.db.flush()
        await self._sync_entitlements(user_id, plan)
        return sub

    async def get_current(self, user_id: uuid.UUID) -> Subscription | None:
        result = await self.db.execute(
            select(Subscription)
            .where(
                Subscription.user_id == user_id,
                Subscription.status.in_(
                    [
                        SubscriptionStatus.ACTIVE.value,
                        SubscriptionStatus.TRIALING.value,
                        SubscriptionStatus.PAST_DUE.value,
                    ]
                ),
            )
            .order_by(Subscription.created_at.desc())
        )
        return result.scalars().first()

    async def cancel(self, user_id: uuid.UUID, *, at_period_end: bool = True) -> Subscription:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        sub = await self.get_current(user_id)
        if sub is None:
            raise NotFoundError("No active subscription")
        sub.cancel_at_period_end = at_period_end
        if not at_period_end:
            sub.status = SubscriptionStatus.CANCELED.value
            sub.canceled_at = datetime.now(UTC)
        await self.db.flush()
        return sub

    async def change_plan(self, user_id: uuid.UUID, plan_code: str) -> Subscription:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        plan = await self.get_plan_by_code(plan_code)
        if plan is None:
            raise NotFoundError("Plan not found")
        sub = await self.get_current(user_id)
        now = datetime.now(UTC)
        if sub is None:
            sub = Subscription(
                id=uuid.uuid4(),
                user_id=user_id,
                plan_id=plan.id,
                status=SubscriptionStatus.ACTIVE.value,
                current_period_start=now,
                current_period_end=now + timedelta(days=30),
            )
            self.db.add(sub)
        else:
            sub.plan_id = plan.id
            sub.status = SubscriptionStatus.ACTIVE.value
            sub.cancel_at_period_end = False
            sub.canceled_at = None
            sub.current_period_start = now
            sub.current_period_end = now + timedelta(days=30)
        await self.db.flush()
        await self._sync_entitlements(user_id, plan)
        return sub

    async def _sync_entitlements(self, user_id: uuid.UUID, plan: Plan) -> None:
        result = await self.db.execute(select(Entitlement).where(Entitlement.user_id == user_id))
        for row in result.scalars().all():
            await self.db.delete(row)
        features = await self.db.execute(
            select(PlanFeature).where(PlanFeature.plan_id == plan.id)
        )
        for feat in features.scalars().all():
            self.db.add(
                Entitlement(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    feature_key=feat.feature_key,
                    feature_value=feat.feature_value,
                    limit_value=feat.limit_value,
                    source_plan_id=plan.id,
                )
            )
        await self.db.flush()
