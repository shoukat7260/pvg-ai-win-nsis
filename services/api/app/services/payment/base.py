"""Payment provider protocol and sandbox implementation."""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.rls import set_auth_lookup, set_rls_context
from app.errors import UnauthorizedError, ValidationAppError
from app.models.billing import BillingCustomer, Invoice, Payment, SubscriptionEvent
from app.models.enums import InvoiceStatus, PaymentStatus
from app.services.subscription_service import SubscriptionService


@dataclass
class CheckoutSession:
    checkout_id: str
    checkout_url: str
    plan_code: str


class PaymentProvider(Protocol):
    async def create_checkout(
        self,
        *,
        user_id: uuid.UUID,
        email: str,
        plan_code: str,
    ) -> CheckoutSession: ...

    async def verify_webhook(
        self, *, payload: bytes, signature: str
    ) -> dict[str, Any]: ...


class SandboxPaymentProvider:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self.db = session
        self.settings = settings

    async def create_checkout(
        self,
        *,
        user_id: uuid.UUID,
        email: str,
        plan_code: str,
    ) -> CheckoutSession:
        await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        customer = await self._ensure_customer(user_id, email)
        checkout_id = f"cs_sandbox_{uuid.uuid4().hex[:16]}"
        payment = Payment(
            id=uuid.uuid4(),
            user_id=user_id,
            billing_customer_id=customer.id,
            amount_cents=0,
            currency="USD",
            status=PaymentStatus.PENDING.value,
            provider_payment_id=checkout_id,
            idempotency_key=f"checkout:{checkout_id}",
        )
        self.db.add(payment)
        await self.db.flush()
        return CheckoutSession(
            checkout_id=checkout_id,
            checkout_url=f"{self.settings.web_origin}/billing/sandbox-checkout?id={checkout_id}&plan={plan_code}",
            plan_code=plan_code,
        )

    async def verify_webhook(self, *, payload: bytes, signature: str) -> dict[str, Any]:
        secret = self.settings.payment_webhook_secret
        if not secret:
            raise UnauthorizedError("Webhook secret not configured")
        expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            raise UnauthorizedError("Invalid webhook signature")
        try:
            return json.loads(payload.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValidationAppError("Invalid webhook payload") from exc

    async def handle_event(self, event: dict[str, Any]) -> SubscriptionEvent | None:
        event_id = str(event.get("id") or event.get("event_id") or "")
        event_type = str(event.get("type") or "")
        if not event_id or not event_type:
            raise ValidationAppError("Webhook event missing id or type")

        await set_auth_lookup(self.db, enabled=True)
        try:
            existing = await self.db.execute(
                select(SubscriptionEvent).where(
                    SubscriptionEvent.provider_event_id == event_id
                )
            )
            if existing.scalar_one_or_none() is not None:
                return None  # idempotent no-op
        finally:
            await set_auth_lookup(self.db, enabled=False)

        data = event.get("data") or {}
        user_id_raw = data.get("user_id")
        user_id = uuid.UUID(str(user_id_raw)) if user_id_raw else None
        plan_code = data.get("plan_code")
        subscription_id = None

        if user_id:
            await set_rls_context(self.db, user_id=user_id, workspace_ids=[])
        else:
            await set_auth_lookup(self.db, enabled=True)

        if event_type in ("checkout.completed", "subscription.updated") and user_id and plan_code:
            sub = await SubscriptionService(self.db).change_plan(user_id, str(plan_code))
            subscription_id = sub.id
            self.db.add(
                Invoice(
                    id=uuid.uuid4(),
                    user_id=user_id,
                    subscription_id=sub.id,
                    amount_cents=int(data.get("amount_cents") or 0),
                    currency=str(data.get("currency") or "USD"),
                    status=InvoiceStatus.PAID.value,
                    provider_invoice_id=f"inv_sandbox_{uuid.uuid4().hex[:12]}",
                    period_start=sub.current_period_start,
                    period_end=sub.current_period_end,
                )
            )

        if event_type == "subscription.canceled" and user_id:
            await SubscriptionService(self.db).cancel(user_id, at_period_end=False)

        row = SubscriptionEvent(
            id=uuid.uuid4(),
            user_id=user_id,
            subscription_id=subscription_id,
            event_type=event_type,
            provider_event_id=event_id,
            payload=event,
            processed_at=datetime.now(UTC),
        )
        self.db.add(row)
        await self.db.flush()
        return row

    async def _ensure_customer(self, user_id: uuid.UUID, email: str) -> BillingCustomer:
        result = await self.db.execute(
            select(BillingCustomer).where(BillingCustomer.user_id == user_id)
        )
        customer = result.scalar_one_or_none()
        if customer:
            return customer
        customer = BillingCustomer(
            id=uuid.uuid4(),
            user_id=user_id,
            email=email,
            provider_customer_id=f"cus_sandbox_{uuid.uuid4().hex[:12]}",
        )
        self.db.add(customer)
        await self.db.flush()
        return customer


def get_payment_provider(session: AsyncSession, settings: Settings) -> SandboxPaymentProvider:
    return SandboxPaymentProvider(session, settings)
