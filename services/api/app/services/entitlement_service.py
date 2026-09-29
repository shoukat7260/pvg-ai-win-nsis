"""Entitlement lookups (from materialized entitlements or plan features)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Entitlement, PlanFeature, Subscription
from app.services.subscription_service import SubscriptionService


class EntitlementService:
    def __init__(self, session: AsyncSession) -> None:
        self.db = session

    async def list_for_user(self, user_id: uuid.UUID) -> list[Entitlement]:
        result = await self.db.execute(
            select(Entitlement).where(Entitlement.user_id == user_id)
        )
        entitlements = list(result.scalars().all())
        if entitlements:
            return entitlements
        # Derive from current plan features if not materialized
        sub = await SubscriptionService(self.db).get_current(user_id)
        if sub is None:
            return []
        feats = await self.db.execute(
            select(PlanFeature).where(PlanFeature.plan_id == sub.plan_id)
        )
        derived: list[Entitlement] = []
        for feat in feats.scalars().all():
            derived.append(
                Entitlement(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    feature_key=feat.feature_key,
                    feature_value=feat.feature_value,
                    limit_value=feat.limit_value,
                    source_plan_id=sub.plan_id,
                )
            )
        return derived

    async def has_feature(self, user_id: uuid.UUID, feature_key: str) -> bool:
        ents = await self.list_for_user(user_id)
        return any(e.feature_key == feature_key for e in ents)
