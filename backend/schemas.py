"""
Pydantic 请求/响应模型 — 定义 API 的输入输出结构
"""
from pydantic import BaseModel, Field
from typing import Optional


# ====================== 登录 ======================
class LoginRequest(BaseModel):
    username: Optional[str] = None    # 不传用户名则匹配所有用户密码
    password: str


# ====================== 用户管理 ======================
class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1, max_length=100)
    role: str = "user"  # "admin" 或 "user"


class UserInfo(BaseModel):
    id: str
    name: str
    role: str
    isAdmin: bool
    avatarUrl: Optional[str] = None

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str
    user: UserInfo


# ====================== 帖子 ======================
class PostAuthor(BaseModel):
    id: str
    name: str
    avatarUrl: Optional[str] = None


class PostStats(BaseModel):
    likes: int = 0
    comments: int = 0
    favorites: int = 0


class PostMeta(BaseModel):
    likedBy: list[str] = []
    favoritedBy: list[str] = []


class CommentItem(BaseModel):
    id: str
    userId: str
    userName: str
    content: str
    avatarUrl: Optional[str] = None


class MediaGroup(BaseModel):
    images: list[dict] = []
    videos: list[dict] = []
    files: list[dict] = []


class PostResponse(BaseModel):
    id: str
    title: str
    content: str = ""
    tags: list[str] = []
    pinned: bool = False
    author: Optional[PostAuthor] = None
    stats: PostStats = PostStats()
    meta: PostMeta = PostMeta()
    comments: list[CommentItem] = []
    media: MediaGroup = MediaGroup()
    createdAt: Optional[str] = None

    class Config:
        from_attributes = True


class PostCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = ""


class PostUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None


class PinRequest(BaseModel):
    pinned: bool


# ====================== 评论 ======================
class CommentCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)
