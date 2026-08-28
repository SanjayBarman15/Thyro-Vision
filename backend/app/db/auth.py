# app/db/auth.py
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db.supabase import supabase_auth
import base64
import json

security = HTTPBearer()


def verify_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Verify JWT and return authenticated user."""
    token = credentials.credentials

    try:
        res = supabase_auth.auth.get_user(token)
        if not res or not res.user:
            print(f"❌ Auth Check Failed: Invalid or empty user response for token {token[:10]}...")
            raise HTTPException(status_code=401, detail="Invalid token")
        return res.user

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Auth Check Error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")


def decode_jwt_payload(token: str) -> dict:
    """
    Safely decode JWT payload without verification.
    Used only to read custom claims (user_role) after
    the token has already been verified by verify_user().
    """
    try:
        # JWT is header.payload.signature
        payload_part = token.split('.')[1]

        # Fix base64url padding
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += '=' * padding

        # base64url → base64
        payload_part = payload_part.replace('-', '+').replace('_', '/')
        decoded = base64.b64decode(payload_part)
        return json.loads(decoded)

    except Exception:
        return {}


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """
    Verify JWT + check user_role = admin.
    Use as a dependency on all admin-only endpoints.

    Usage:
        @router.post("/admin/something")
        async def endpoint(admin = Depends(require_admin)):
            ...
    """
    token = credentials.credentials

    # Step 1 — verify token is valid
    try:
        res = supabase_auth.auth.get_user(token)
        if not res or not res.user:
            print(f"❌ Admin Check Failed: Invalid token {token[:10]}...")
            raise HTTPException(status_code=401, detail="Invalid token")
        user = res.user
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Admin Check Error: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Unauthorized: {str(e)}")

    # Step 2 — decode JWT to get user_role
    payload = decode_jwt_payload(token)
    user_role = payload.get('user_role', 'doctor')

    # Step 3 — check admin role
    if user_role != 'admin':
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )

    # Return user info for use in endpoint
    return {
        "sub": str(user.id),
        "email": user.email,
        "role": user_role,
    }