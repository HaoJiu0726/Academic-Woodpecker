from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.auth import RegisterRequest, TokenResponse, UserInfo
from app.core.security import get_password_hash, verify_password, create_access_token
from fastapi import HTTPException, status
from app.core.logging import get_logger

logger = get_logger("auth_service")


async def register(db: AsyncSession, req: RegisterRequest) -> User:
    """Register a new user. Raises 400 if username exists."""
    logger.info(f"Register attempt with username: {req.username}, nickname: {req.nickname}, email: {req.email}, studentId: {req.studentId}")
    
    # Validate username
    if not req.username or len(req.username) < 2 or len(req.username) > 50:
        raise HTTPException(status_code=400, detail="用户名必须在2-50个字符之间")
    
    # Validate nickname
    if not req.nickname or len(req.nickname) < 1 or len(req.nickname) > 50:
        raise HTTPException(status_code=400, detail="昵称必须在1-50个字符之间")
    
    # Validate password
    if not req.password or len(req.password) < 6 or len(req.password) > 100:
        raise HTTPException(status_code=400, detail="密码必须在6-100个字符之间")
    
    # Check if username exists
    result = await db.execute(select(User).where(User.username == req.username))
    existing = result.scalar_one_or_none()
    if existing:
        logger.warning(f"Username {req.username} already exists")
        raise HTTPException(status_code=400, detail="用户名已存在")

    # Convert empty strings to None
    email = req.email if req.email and req.email.strip() else None
    student_id = req.studentId if req.studentId and req.studentId.strip() else None
    
    user = User(
        username=req.username,
        password_hash=get_password_hash(req.password),
        nickname=req.nickname,
        email=email,
        student_id=student_id,
        role="student",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info(f"User {req.username} registered successfully with id: {user.id}")
    return user


async def login(db: AsyncSession, username: str, password: str) -> tuple[str, User]:
    """Authenticate user and return JWT token + user. Raises 401 on failure."""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token(data={"sub": str(user.id)})
    return token, user


async def get_current_user_info(user: User) -> UserInfo:
    """Map User model to UserInfo schema."""
    return UserInfo(
        id=user.id,
        username=user.username,
        nickname=user.nickname,
        avatar=user.avatar,
        role=user.role.value if hasattr(user.role, 'value') else user.role,
    )
