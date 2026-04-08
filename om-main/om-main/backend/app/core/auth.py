from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_access_token


bearer_scheme = HTTPBearer(auto_error=False)


def _get_token_payload(
    credentials: Optional[HTTPAuthorizationCredentials],
    required: bool = True,
) -> Optional[dict]:
    token = credentials.credentials if credentials else ""
    if not token:
        if required:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
        return None
    return decode_access_token(token)


def get_optional_auth_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Optional[dict]:
    return _get_token_payload(credentials, required=False)


def get_current_auth_payload(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    payload = _get_token_payload(credentials, required=True)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return payload


def require_roles(*allowed_roles: str):
    def dependency(payload: dict = Depends(get_current_auth_payload)) -> dict:
        role = str(payload.get("role") or "").lower()
        normalized_roles = {str(item).lower() for item in allowed_roles}
        if normalized_roles and role not in normalized_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return payload

    return dependency


def require_subject_match(
    requested_id: str,
    payload: dict,
    allow_roles: tuple[str, ...] = (),
) -> None:
    role = str(payload.get("role") or "").lower()
    if allow_roles and role in {item.lower() for item in allow_roles}:
        return
    subject_id = str(payload.get("sub") or "")
    if str(requested_id) != subject_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
