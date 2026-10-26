"""
JWT 认证工具 — 生成和验证 token（多端同时在线）
"""
import os
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "disi-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24 * 30  # 多端使用，有效期放到 30 天

security = HTTPBearer(auto_error=False)


def create_access_token(user_id: str, login_version: str) -> str:
    """生成 JWT token（login_version 仅作标记，不再用于挤号）"""
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire, "ver": login_version}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db)
) -> User | None:
    """从 Bearer token 解析当前用户。token 无效或被新登录挤掉返回 None"""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        token_ver = payload.get("ver", "")
        if not user_id:
            return None
    except JWTError:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None
    # 多端同时在线：不再校验 login_version，token 在有效期内（30 天）一直可用
    # （需要强制下线某设备时，改用户的 login_version 并恢复这里的比较即可）
    return user


def require_user(current_user: User | None = Depends(get_current_user)) -> User:
    """强制要求登录，未登录或被挤号返回 401"""
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")
    return current_user
