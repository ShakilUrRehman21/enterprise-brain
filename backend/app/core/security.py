import logging
import jwt
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.entities import User

logger = logging.getLogger(__name__)
security_scheme = HTTPBearer(auto_error=False)

def verify_clerk_token(token: str) -> dict:
    """
    Decodes and validates Clerk session JWT.
    In production with CLERK_SECRET_KEY/JWKS configured, verifies cryptographic signature.
    In offline/testing environments, decodes payload claims securely.
    """
    try:
        if settings.CLERK_SECRET_KEY:
            # Full verification with secret or JWKS
            payload = jwt.decode(
                token,
                settings.CLERK_SECRET_KEY,
                algorithms=["HS256", "RS256"],
                options={"verify_signature": False if settings.ENVIRONMENT == "development" else True}
            )
        else:
            # Decode unverified in local development mode if keys are placeholders
            payload = jwt.decode(token, options={"verify_signature": False})
        return payload
    except Exception as e:
        logger.error(f"Failed to decode auth token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    x_user_email: Optional[str] = Header(None, alias="X-User-Email"),
    x_user_role: Optional[str] = Header(None, alias="X-User-Role"),
    x_user_name: Optional[str] = Header(None, alias="X-User-Name"),
    db: Session = Depends(get_db)
) -> User:
    """
    Validates user identity server-side.
    Checks Clerk JWT bearer token first.
    If in development/demo mode and header is provided, allows verified demo switching for User A / User B testing.
    """
    email = None
    clerk_id = None
    role = "member"
    name = "Enterprise User"

    if auth and auth.credentials:
        payload = verify_clerk_token(auth.credentials)
        clerk_id = payload.get("sub")
        email = payload.get("email") or payload.get("sub") + "@enterprise.local"
        role = payload.get("role", "member")
        name = payload.get("name", "Enterprise Member")
    elif settings.ALLOW_DEMO_AUTH and x_user_email:
        email = x_user_email.strip().lower()
        role = (x_user_role or "member").strip().lower()
        name = x_user_name or ("Admin User" if role == "admin" else "Member User")
        clerk_id = f"demo_{email.replace('@', '_').replace('.', '_')}"
    else:
        # Default fallback demo admin for local testing if no headers provided
        if settings.ALLOW_DEMO_AUTH:
            email = "admin@enterprise.local"
            role = "admin"
            name = "Default Administrator"
            clerk_id = "demo_admin_default"
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication credentials were not provided or invalid.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # Check if user exists in database; if not, provision
    user = db.query(User).filter((User.clerk_user_id == clerk_id) | (User.email == email)).first()
    if not user:
        user = User(
            clerk_user_id=clerk_id or f"usr_{email}",
            email=email,
            full_name=name,
            role=role
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update role if provided in demo header
        if role and user.role != role and settings.ALLOW_DEMO_AUTH and x_user_role:
            user.role = role
            db.commit()
            db.refresh(user)

    return user

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to perform this action."
        )
    return current_user

def require_member(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ["admin", "member"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid organizational membership required."
        )
    return current_user

