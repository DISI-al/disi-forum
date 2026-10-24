"""
数据库连接配置 — 默认使用 SQLite，方便本地开发。
部署到 Linux 服务器时可切换到 PostgreSQL，只需修改 DATABASE_URL 环境变量即可。
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

# 默认用 SQLite，部署时通过环境变量切换 PostgreSQL
# 例: export DATABASE_URL=postgresql://user:pass@localhost/disi_forum
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./disi_forum.db")

# SQLite 需要 check_same_thread=False，PostgreSQL 不需要
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI 依赖注入：每次请求获取一个数据库会话，请求结束自动关闭"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库：创建所有表，并插入默认管理员账号"""
    from models import User  # 延迟导入避免循环引用
    Base.metadata.create_all(bind=engine)

    # 首次建库时的管理员口令，可用环境变量覆盖（部署脚本会生成随机值）
    init_password = os.getenv("ADMIN_INIT_PASSWORD", "disi0001")

    db = SessionLocal()
    try:
        # 给缺少 login_version 的旧用户补上默认值
        for u in db.query(User).filter(User.login_version == None).all():
            u.login_version = "1"
        db.commit()

        # 确保默认管理员存在
        admin = db.query(User).filter(User.username == "disi").first()
        if not admin:
            # 兼容旧数据：检查是否有名为 admin 的用户，有则改名
            old_admin = db.query(User).filter(User.username == "admin").first()
            if old_admin:
                old_admin.username = "disi"
                db.commit()
            else:
                admin = User(
                    id="u-admin",
                    username="disi",
                    hashed_password=User.hash_password(init_password),
                    role="admin"
                )
                db.add(admin)
                db.commit()
    finally:
        db.close()
