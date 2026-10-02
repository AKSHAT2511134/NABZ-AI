from enum import Enum
from typing import Optional
from pydantic import BaseModel, EmailStr


class RoleEnum(str, Enum):
    DOCTOR = "doctor"
    ADMIN = "admin"


class LoginRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: str
    role: Optional[RoleEnum] = None


class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    role: RoleEnum
    ward: Optional[str] = "Aliganj Ward 3, Lucknow"
    ward_id: Optional[str] = "w-aliganj"
    facility: Optional[str] = "Aliganj Community Health Center"
    station: Optional[str] = "Station LKO-03"


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserProfile
