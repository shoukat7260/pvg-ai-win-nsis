"""Email transport abstraction."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

import aiosmtplib

from app.config import Settings
from app.logging import get_logger

logger = get_logger(__name__)


@dataclass
class EmailMessage:
    to: str
    subject: str
    body_text: str
    body_html: str | None = None


class EmailProvider(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


@dataclass
class ConsoleEmailProvider:
    """Development/test transport — stores messages in memory and logs metadata only."""

    outbox: list[EmailMessage] = field(default_factory=list)

    async def send(self, message: EmailMessage) -> None:
        self.outbox.append(message)
        logger.info(
            "email_console_send",
            to=message.to,
            subject=message.subject,
            # Never log body (may contain tokens)
        )


@dataclass
class SmtpEmailProvider:
    settings: Settings

    async def send(self, message: EmailMessage) -> None:
        from email.message import EmailMessage as MimeEmail

        mime = MimeEmail()
        mime["From"] = self.settings.smtp_from
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.body_text)
        if message.body_html:
            mime.add_alternative(message.body_html, subtype="html")
        await aiosmtplib.send(
            mime,
            hostname=self.settings.smtp_host,
            port=self.settings.smtp_port,
            username=self.settings.smtp_username or None,
            password=self.settings.smtp_password or None,
            start_tls=self.settings.smtp_use_tls,
        )


_console_singleton = ConsoleEmailProvider()


def get_email_provider(settings: Settings) -> EmailProvider:
    if settings.email_transport == "smtp":
        return SmtpEmailProvider(settings=settings)
    return _console_singleton


def get_console_outbox() -> list[EmailMessage]:
    return _console_singleton.outbox


def clear_console_outbox() -> None:
    _console_singleton.outbox.clear()


class EmailService:
    def __init__(self, settings: Settings, provider: EmailProvider | None = None) -> None:
        self.settings = settings
        self.provider = provider or get_email_provider(settings)

    async def send_verification(self, *, to: str, token: str) -> None:
        link = f"{self.settings.web_origin}/verify-email?token={token}"
        await self.provider.send(
            EmailMessage(
                to=to,
                subject="Verify your PVG AI email",
                body_text=f"Verify your email: {link}\n\nIf you did not sign up, ignore this message.",
            )
        )

    async def send_password_reset(self, *, to: str, token: str) -> None:
        link = f"{self.settings.web_origin}/reset-password?token={token}"
        await self.provider.send(
            EmailMessage(
                to=to,
                subject="Reset your PVG AI password",
                body_text=f"Reset your password: {link}\n\nIf you did not request this, ignore this message.",
            )
        )

    async def send_email_change(self, *, to: str, token: str) -> None:
        link = f"{self.settings.web_origin}/confirm-email-change?token={token}"
        await self.provider.send(
            EmailMessage(
                to=to,
                subject="Confirm your new PVG AI email",
                body_text=f"Confirm email change: {link}",
            )
        )
