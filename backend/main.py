"""
DISI 技术论坛 — FastAPI 后端主程序
运行方式: uvicorn main:app --host 0.0.0.0 --port 8000
"""
import os
import shutil
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from database import get_db, init_db
from models import User, Post, Comment, Like, Favorite, Media
from auth import get_current_user, require_user, create_access_token
from insist_api import router as insist_router
from schemas import (
    LoginRequest, LoginResponse, UserInfo,
    PostResponse, PostAuthor, PostStats, PostMeta,
    CommentItem, MediaGroup,
    PostCreateRequest, PostUpdateRequest, PinRequest,
    CommentCreateRequest, CreateUserRequest, UpdateUserRequest,
)

# ====================== 应用初始化 ======================
app = FastAPI(title="DISI 论坛 API", version="1.0.0")
app.include_router(insist_router)

# CORS — 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 文件上传目录
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ====================== 启动事件 ======================
@app.on_event("startup")
def on_startup():
    """应用启动时初始化数据库"""
    init_db()
    # 确保上传目录存在
    os.makedirs(UPLOAD_DIR, exist_ok=True)


# ====================== 工具函数 ======================
def _users_map(db: Session, user_ids) -> dict:
    """一次查询取回一批用户，避免逐条查询"""
    ids = [i for i in user_ids if i]
    if not ids:
        return {}
    return {u.id: u for u in db.query(User).filter(User.id.in_(ids)).all()}


def _chunked(seq: list, size: int = 400):
    """SQLite 的 IN 参数有上限，分批查询"""
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def _post_payload(post: Post, author, comments, likes, favorites, media_items, users) -> dict:
    """把已经查好的关联数据组装成前端期望的 JSON 结构（不再自己查库）"""
    # 按类型分组媒体文件
    media_group = MediaGroup()
    for m in media_items:
        item = {"url": m.url, "name": m.name}
        if m.type == "image":
            media_group.images.append(item)
        elif m.type == "video":
            media_group.videos.append(item)
        else:
            media_group.files.append(item)

    # 评论列表
    comment_list = []
    for c in comments:
        comment_user = users.get(c.user_id)
        comment_list.append(CommentItem(
            id=c.id,
            userId=c.user_id,
            userName=comment_user.username if comment_user else "未知",
            content=c.content,
            avatarUrl=(comment_user.avatar_url or "") if comment_user else "",
        ).model_dump())

    return {
        "id": post.id,
        "title": post.title,
        "content": post.content or "",
        "tags": post.tags or [],
        "pinned": post.pinned,
        "author": PostAuthor(
            id=author.id,
            name=author.username,
            avatarUrl=author.avatar_url or ""
        ).model_dump() if author else None,
        "stats": PostStats(
            likes=len(likes),
            comments=len(comments),
            favorites=len(favorites)
        ).model_dump(),
        "meta": PostMeta(
            likedBy=[l.user_id for l in likes],
            favoritedBy=[f.user_id for f in favorites]
        ).model_dump(),
        "comments": comment_list,
        "media": media_group.model_dump(),
        "createdAt": post.created_at.isoformat() if post.created_at else None,
    }


def build_post_response(post: Post, db: Session) -> dict:
    """
    将单个 Post ORM 对象转换为前端期望的 JSON 格式。
    包含作者、统计、评论、媒体等所有嵌套数据。
    """
    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post.id)
        .order_by(Comment.created_at)
        .all()
    )
    likes = db.query(Like).filter(Like.post_id == post.id).all()
    favorites = db.query(Favorite).filter(Favorite.post_id == post.id).all()
    media_items = db.query(Media).filter(Media.post_id == post.id).all()
    users = _users_map(db, {post.author_id} | {c.user_id for c in comments})
    return _post_payload(post, users.get(post.author_id), comments, likes, favorites, media_items, users)


def build_posts_response(posts: list, db: Session) -> list:
    """
    批量转换帖子列表。

    原实现每篇帖子都要查作者、评论、点赞、收藏、媒体各一次，
    N 篇帖子 = 5N 次查询（N+1 问题）；现在固定 5 批查询，帖子越多差距越大。
    """
    if not posts:
        return []

    post_ids = [p.id for p in posts]
    comments_by_post = defaultdict(list)
    likes_by_post = defaultdict(list)
    favorites_by_post = defaultdict(list)
    media_by_post = defaultdict(list)

    for chunk in _chunked(post_ids):
        for c in (
            db.query(Comment)
            .filter(Comment.post_id.in_(chunk))
            .order_by(Comment.created_at)
            .all()
        ):
            comments_by_post[c.post_id].append(c)
        for l in db.query(Like).filter(Like.post_id.in_(chunk)).all():
            likes_by_post[l.post_id].append(l)
        for f in db.query(Favorite).filter(Favorite.post_id.in_(chunk)).all():
            favorites_by_post[f.post_id].append(f)
        for m in db.query(Media).filter(Media.post_id.in_(chunk)).all():
            media_by_post[m.post_id].append(m)

    needed_user_ids = {p.author_id for p in posts}
    for comment_list in comments_by_post.values():
        needed_user_ids.update(c.user_id for c in comment_list)
    users = _users_map(db, needed_user_ids)

    return [
        _post_payload(
            post,
            users.get(post.author_id),
            comments_by_post.get(post.id, []),
            likes_by_post.get(post.id, []),
            favorites_by_post.get(post.id, []),
            media_by_post.get(post.id, []),
            users,
        )
        for post in posts
    ]


def build_user_response(user: User) -> dict:
    """将 User ORM 对象转换为前端期望的格式"""
    return {
        "id": user.id,
        "name": user.username,
        "role": user.role,
        "isAdmin": user.role == "admin",
        "avatarUrl": user.avatar_url or "",
    }


# ====================== 文件类型判断 ======================
def guess_media_type(filename: str) -> str:
    """根据文件扩展名判断媒体类型"""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"):
        return "image"
    if ext in ("mp4", "webm", "ogg", "mov", "avi", "mkv"):
        return "video"
    return "file"


# ====================== 登录接口 ======================
@app.post("/api/posts/login", response_model=LoginResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    登录。
    如果传了用户名 → 校验该用户密码。
    如果没传用户名 → 遍历所有用户，匹配密码（单密码登录）。
    """
    user = None
    if req.username:
        user = db.query(User).filter(User.username == req.username).first()
        if not user or not user.verify_password(req.password):
            raise HTTPException(status_code=401, detail="用户名或密码错误")
    else:
        # 单密码模式：遍历用户找匹配密码的
        all_users = db.query(User).all()
        for u in all_users:
            if u.verify_password(req.password):
                user = u
                break
        if not user:
            raise HTTPException(status_code=401, detail="密码错误")

    # 每次登录更新 login_version，旧设备自动失效（单设备登录）
    user.login_version = uuid.uuid4().hex[:12]
    db.commit()

    token = create_access_token(user.id, user.login_version)
    return LoginResponse(
        token=token,
        user=UserInfo(**build_user_response(user))
    )


# ====================== 用户管理（仅管理员可操作）======================
@app.post("/api/posts/users")
def create_user(
    req: CreateUserRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    管理员添加新用户。
    也可以在服务器上直接用 add_user.py 脚本添加。
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")

    # 检查用户名是否已存在
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    new_user = User(
        username=req.username,
        hashed_password=User.hash_password(req.password),
        role=req.role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return build_user_response(new_user)


@app.get("/api/posts/users")
def list_users(
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """管理员查看所有用户列表"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    users = db.query(User).all()
    return [build_user_response(u) for u in users]


@app.delete("/api/posts/users/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """管理员删除用户（不能删除自己）"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    db.delete(user)
    db.commit()
    return {"message": f"用户 {user.username} 已删除"}


@app.patch("/api/posts/users/{user_id}")
def update_user(
    user_id: str,
    req: UpdateUserRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """
    修改昵称：管理员可改任意用户，普通用户只能改自己。
    登录只认口令，昵称仅用于展示，所以改昵称不影响登录。
    """
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="只能修改自己的昵称")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    name = req.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="昵称不能为空")

    exists = db.query(User).filter(User.username == name, User.id != user_id).first()
    if exists:
        raise HTTPException(status_code=400, detail="这个昵称已被占用")

    user.username = name
    db.commit()
    db.refresh(user)
    return build_user_response(user)


# ====================== 当前用户接口 ======================
@app.get("/api/posts/user/me")
def get_current_user_info(
    current_user: User | None = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取当前登录用户信息。
    如果未登录，返回默认游客身份（前端兼容处理）。
    """
    if current_user:
        return build_user_response(current_user)
    # 未登录返回游客身份
    return {
        "id": "guest",
        "name": "游客",
        "role": "user",
        "isAdmin": False,
    }


# ====================== 帖子列表 ======================
@app.get("/api/posts/posts")
def list_posts(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user),
):
    """获取所有帖子列表（按置顶优先 + 时间倒序排列）"""
    posts = db.query(Post).order_by(Post.pinned.desc(), Post.created_at.desc()).all()
    return build_posts_response(posts, db)


# ====================== 帖子详情 ======================
@app.get("/api/posts/posts/{post_id}")
def get_post(post_id: str, db: Session = Depends(get_db)):
    """获取单个帖子详情"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    return build_post_response(post, db)


# ====================== 创建帖子 ======================
@app.post("/api/posts/posts")
def create_post(
    req: PostCreateRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """创建新帖子（需要登录）"""
    # 从内容中提取 #标签
    tags = []
    for word in req.content.split():
        if word.startswith("#") and len(word) > 1:
            tags.append(word[1:].rstrip(",.，。!！?？;；"))

    post = Post(
        title=req.title,
        content=req.content,
        tags=tags,
        author_id=current_user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return build_post_response(post, db)


# ====================== 更新帖子 ======================
@app.patch("/api/posts/posts/{post_id}")
def update_post(
    post_id: str,
    req: PostUpdateRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """更新帖子（仅作者本人可操作）"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if post.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改此帖子")

    if req.title is not None:
        post.title = req.title
    if req.content is not None:
        post.content = req.content
    if req.tags is not None:
        post.tags = req.tags
    post.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(post)
    return build_post_response(post, db)


# ====================== 删除帖子 ======================
@app.delete("/api/posts/posts/{post_id}")
def delete_post(
    post_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """删除帖子（作者或管理员可操作）"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    if post.author_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除此帖子")

    # 删除关联的媒体文件
    for media in db.query(Media).filter(Media.post_id == post_id).all():
        file_path = os.path.join(UPLOAD_DIR, os.path.basename(media.url))
        if os.path.exists(file_path):
            os.remove(file_path)
        db.delete(media)

    db.delete(post)
    db.commit()
    return {"message": "已删除"}


# ====================== 置顶帖子 ======================
@app.post("/api/posts/posts/{post_id}/pin")
def pin_post(
    post_id: str,
    req: PinRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """置顶/取消置顶帖子（仅管理员可操作）"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")

    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")
    post.pinned = req.pinned
    db.commit()
    return {"message": "操作成功", "pinned": post.pinned}


# ====================== 点赞帖子 ======================
@app.post("/api/posts/posts/{post_id}/like")
def like_post(
    post_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """点赞/取消点赞帖子（切换操作）"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    existing = db.query(Like).filter(
        Like.post_id == post_id, Like.user_id == current_user.id
    ).first()
    if existing:
        db.delete(existing)  # 已点赞 → 取消
    else:
        db.add(Like(post_id=post_id, user_id=current_user.id))  # 未点赞 → 点赞
    db.commit()
    return {"message": "操作成功"}


# ====================== 收藏帖子 ======================
@app.post("/api/posts/posts/{post_id}/favorite")
def favorite_post(
    post_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """收藏/取消收藏帖子（切换操作）"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    existing = db.query(Favorite).filter(
        Favorite.post_id == post_id, Favorite.user_id == current_user.id
    ).first()
    if existing:
        db.delete(existing)  # 已收藏 → 取消
    else:
        db.add(Favorite(post_id=post_id, user_id=current_user.id))  # 未收藏 → 收藏
    db.commit()
    return {"message": "操作成功"}


# ====================== 评论列表 ======================
@app.get("/api/posts/posts/{post_id}/comments")
def list_comments(post_id: str, db: Session = Depends(get_db)):
    """获取帖子的评论列表"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    comments = (
        db.query(Comment)
        .filter(Comment.post_id == post_id)
        .order_by(Comment.created_at)
        .all()
    )
    users = _users_map(db, {c.user_id for c in comments})
    result = []
    for c in comments:
        comment_user = users.get(c.user_id)
        result.append(CommentItem(
            id=c.id,
            userId=c.user_id,
            userName=comment_user.username if comment_user else "未知",
            content=c.content,
            avatarUrl=(comment_user.avatar_url or "") if comment_user else "",
        ).model_dump())
    return result


# ====================== 添加评论 ======================
@app.post("/api/posts/posts/{post_id}/comments")
def add_comment(
    post_id: str,
    req: CommentCreateRequest,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """添加评论（需要登录）"""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="帖子不存在")

    comment = Comment(
        post_id=post_id,
        user_id=current_user.id,
        content=req.content,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return CommentItem(
        id=comment.id,
        userId=comment.user_id,
        userName=current_user.username,
        content=comment.content,
        avatarUrl=current_user.avatar_url or ""
    ).model_dump()


# ====================== 删除评论 ======================
@app.delete("/api/posts/posts/{post_id}/comments/{comment_id}")
def delete_comment(
    post_id: str,
    comment_id: str,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """删除评论（评论作者或管理员可操作）"""
    comment = db.query(Comment).filter(
        Comment.id == comment_id, Comment.post_id == post_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="评论不存在")
    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="无权删除此评论")

    db.delete(comment)
    db.commit()
    return {"message": "已删除"}


# ====================== 文件上传 ======================
@app.post("/api/posts/upload")
async def upload_file(
    file: UploadFile = File(...),
    post_id: str = Query(""),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """上传文件（需要登录）。可指定 post_id 关联到帖子"""
    safe_name = file.filename.replace(" ", "_")
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    saved_name = f"{timestamp}_{safe_name}"
    file_path = os.path.join(UPLOAD_DIR, saved_name)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    media_type = guess_media_type(safe_name)
    url = f"/uploads/{saved_name}"

    media = Media(
        url=url,
        name=file.filename,
        type=media_type,
        post_id=post_id,
    )
    db.add(media)
    db.commit()

    return {"url": url, "name": file.filename, "type": media_type, "id": media.id}


# ====================== 头像上传 ======================
@app.post("/api/posts/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """上传头像（需要登录），保存后更新用户 avatar_url"""
    safe_name = f"avatar_{current_user.id}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    url = f"/uploads/{safe_name}"
    current_user.avatar_url = url
    db.commit()
    return {"avatarUrl": url}


# ====================== 用户获赞统计 ======================
@app.get("/api/posts/user/likes-count")
def get_user_likes_count(
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """获取当前用户所有帖子收到的点赞总数"""
    posts = db.query(Post).filter(Post.author_id == current_user.id).all()
    total = 0
    for p in posts:
        total += db.query(Like).filter(Like.post_id == p.id).count()
    return {"likesCount": total}


# ====================== 静态文件服务 ======================
# 挂载 uploads 目录，使上传的文件可访问
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


# ====================== 根路径 ======================
@app.get("/")
def root():
    return {"message": "DISI 技术论坛 API", "version": "1.0.0"}
