"""
Auth Router for NABZ AI
Supports Doctor and Admin roles with standard tokens.
"""

from fastapi import APIRouter, HTTPException
from ..models.auth import LoginRequest, LoginResponse, UserProfile, RoleEnum

router = APIRouter(prefix="/auth", tags=["Authentication"])

MOCK_USERS = {
    "doctor@nabz.ai": UserProfile(
        id="usr-dr-48291",
        name="Dr. Ananya Sharma",
        email="doctor@nabz.ai",
        role=RoleEnum.DOCTOR,
        ward="Aliganj Ward 3, Lucknow",
        ward_id="w-aliganj",
        facility="Aliganj Community Health Center",
        station="Station LKO-03",
    ),
    "admin@nabz.ai": UserProfile(
        id="usr-adm-00108",
        name="Dr. Rajesh Saxena",
        email="admin@nabz.ai",
        role=RoleEnum.ADMIN,
        ward="Lucknow District Health Authority",
        ward_id="w-district",
        facility="District Surveillance Command",
        station="HQ Terminal Alpha",
    ),
}


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    identifier = (request.email or request.username or "").lower().strip()
    user = MOCK_USERS.get(identifier)

    if not user:
        # If logging in as role or admin
        if request.role == RoleEnum.ADMIN or "admin" in identifier:
            user = MOCK_USERS["admin@nabz.ai"]
        else:
            user = MOCK_USERS["doctor@nabz.ai"]

    token = f"nabz_token_{user.role}_{user.id}"
    return LoginResponse(access_token=token, token_type="bearer", user=user)
