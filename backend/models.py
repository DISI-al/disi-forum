"""
SQLAlchemy ORM 模型 — 定义数据库表结构
"""
import uuid
import bcrypt
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from database import Base


def gen_id():
    """生成短唯一 ID（12 字符）"""
    return uuid.uuid4().hex[:12]


class User(Base):
    __tablename__ = "users"

    id              = Column(String(12), primary_key=True, default=gen_id)
    username        = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role            = Column(String(10), default="user")
    avatar_url      = Column(String(500), nullable=True)
    login_version   = Column(String(12), default="1")
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    posts    = relationship("Post", back_populates="author_rel", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="user_rel", cascade="all, delete-orphan")

    @staticmethod
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    def verify_password(self, password: str) -> bool:
        return bcrypt.checkpw(password.encode(), self.hashed_password.encode())


class Post(Base):
    __tablename__ = "posts"

    id         = Column(String(12), primary_key=True, default=gen_id)
    title      = Column(String(200), nullable=False)
    content    = Column(Text, default="")
    tags       = Column(JSON, default=list)
    pinned     = Column(Boolean, default=False)
    author_id  = Column(String(12), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    author_rel = relationship("User", back_populates="posts")
    comments   = relationship("Comment", back_populates="post_rel", cascade="all, delete-orphan")
    media_rel  = relationship("Media", back_populates="post_rel", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id         = Column(String(12), primary_key=True, default=gen_id)
    post_id    = Column(String(12), ForeignKey("posts.id"), nullable=False)
    user_id    = Column(String(12), ForeignKey("users.id"), nullable=False)
    content    = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    post_rel = relationship("Post", back_populates="comments")
    user_rel = relationship("User", back_populates="comments")


class Like(Base):
    __tablename__ = "likes"

    post_id = Column(String(12), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(12), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Favorite(Base):
    __tablename__ = "favorites"

    post_id = Column(String(12), ForeignKey("posts.id", ondelete="CASCADE"), primary_key=True)
    user_id = Column(String(12), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)


class Media(Base):
    __tablename__ = "media"

    id         = Column(String(12), primary_key=True, default=gen_id)
    post_id    = Column(String(12), ForeignKey("posts.id"), nullable=False)
    url        = Column(String(500), nullable=False)
    name       = Column(String(255), default="")
    type       = Column(String(10), default="file")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    post_rel = relationship("Post", back_populates="media_rel")
