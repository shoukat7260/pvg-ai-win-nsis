"""Billing endpoints (sandbox payment provider)."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Header, Request
from pydantic import BaseModel, Field

from app.api.deps import CurrentUserDep, DbSessionDep, SettingsDep
from app.schemas.common import MessageResponse
from app.services.entitlement_service import EntitlementService
from app.services.payment import get_payment_provider
from app.services.subscription_service import SubscriptionService

router = APIRouter(prefix="/billing", tags=["billing"])


class PlanRead(BaseModel):
    id: UUID
    code: str
    name: str
    description: str | None
    price_cents: int
    currency: str
    billing_interval: str

    model_config = {"from_attributes": True}


class SubscriptionRead(BaseModel):
    id: UUID
    plan_id: UUID
    status: str
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancel_at_period_end: bool

    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    plan_code: str = Field(min_length=1, max_length=32)


class CheckoutResponse(BaseModel):
    checkout_id: str
    checkout_url: str
    plan_code: str


class InvoiceRead(BaseModel):
    id: UUID
    amount_cents: int
    currency: str
    status: str
    hosted_invoice_url: str | None
    period_start: datetime | None
    period_end: datetime | None

    model_config = {"from_attributes": True}


class EntitlementRead(BaseModel):
    feature_key: str
    feature_value: str
    limit_value: int | None

    model_config = {"from_attributes": True}


@router.get("/plans", response_model=list[PlanRead])
async def list_plans(session: DbSessionDep, user: CurrentUserDep) -> list[PlanRead]:
    await SubscriptionService(session).ensure_free_subscription(user.id)
    plans = await SubscriptionService(session).list_plans()
    return [PlanRead.model_validate(p) for p in plans]


@router.get("/subscription", response_model=SubscriptionRead)
async def current_subscription(
    user: CurrentUserDep, session: DbSessionDep
) -> SubscriptionRead:
    sub = await SubscriptionService(session).ensure_free_subscription(user.id)
    return SubscriptionRead.model_validate(sub)


@router.get("/entitlements", response_model=list[EntitlementRead])
async def entitlements(user: CurrentUserDep, session: DbSessionDep) -> list[EntitlementRead]:
    await SubscriptionService(session).ensure_free_subscription(user.id)
    rows = await EntitlementService(session).list_for_user(user.id)
    return [EntitlementRead.model_validate(r) for r in rows]


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    user: CurrentUserDep,
    session: DbSessionDep,
    settings: SettingsDep,
) -> CheckoutResponse:
    result = await get_payment_provider(session, settings).create_checkout(
        user_id=user.id, email=user.email, plan_code=body.plan_code
    )
    return CheckoutResponse(
        checkout_id=result.checkout_id,
        checkout_url=result.checkout_url,
        plan_code=result.plan_code,
    )


@router.post("/cancel", response_model=SubscriptionRead)
async def cancel_subscription(
    user: CurrentUserDep, session: DbSessionDep
) -> SubscriptionRead:
    sub = await SubscriptionService(session).cancel(user.id, at_period_end=True)
    return SubscriptionRead.model_validate(sub)


@router.get("/invoices", response_model=list[InvoiceRead])
async def list_invoices(user: CurrentUserDep, session: DbSessionDep) -> list[InvoiceRead]:
    from sqlalchemy import select
    from app.models.billing import Invoice

    result = await session.execute(
        select(Invoice).where(Invoice.user_id == user.id).order_by(Invoice.created_at.desc())
    )
    return [InvoiceRead.model_validate(r) for r in result.scalars().all()]


@router.post("/webhook", response_model=MessageResponse)
async def payment_webhook(
    request: Request,
    session: DbSessionDep,
    settings: SettingsDep,
    x_pvg_signature: str | None = Header(default=None, alias="X-PVG-Signature"),
) -> MessageResponse:
    payload = await request.body()
    signature = x_pvg_signature or ""
    provider = get_payment_provider(session, settings)
    event = await provider.verify_webhook(payload=payload, signature=signature)
    await provider.handle_event(event)
    return MessageResponse(message="ok")
