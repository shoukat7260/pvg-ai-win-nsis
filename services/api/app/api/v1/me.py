"""GET /api/v1/me"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUserDep, DbSessionDep
from app.repositories import UserRepository
from app.schemas.user import UserRead

router = APIRouter(tags=["me"])


@router.get("/me", response_model=UserRead)
async def get_me(user: CurrentUserDep, session: DbSessionDep) -> UserRead:
    db_user = await UserRepository(session).get_by_id(user.id)
    assert db_user is not None
    return UserRead.model_validate(db_user)
