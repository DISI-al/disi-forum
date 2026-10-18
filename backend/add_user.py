"""
在服务器上直接添加用户（命令行方式，不依赖 API）
用法:
    python add_user.py <用户名> <密码> [角色: admin/user，默认 user]

示例:
    python add_user.py zhangsan mypass123          # 添加普通用户
    python add_user.py lisi mypass456 admin        # 添加管理员
"""
import sys
import os

# 确保能找到同目录下其他模块
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, init_db
from models import User


def add_user(username: str, password: str, role: str = "user"):
    """在数据库中直接添加用户"""
    init_db()  # 确保数据库表存在

    db = SessionLocal()
    try:
        # 检查用户名是否已存在
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            print(f"[错误] 用户名 '{username}' 已存在")
            return False

        user = User(
            username=username,
            hashed_password=User.hash_password(password),
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[成功] 已添加用户: {username}")
        print(f"  ID:   {user.id}")
        print(f"  角色: {user.role}")
        print(f"  登录: 用户名={username}, 密码={password}")
        return True
    finally:
        db.close()


def list_users():
    """列出所有用户"""
    init_db()
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("（暂无用户）")
            return
        print(f"{'ID':<15} {'用户名':<20} {'角色':<10}")
        print("-" * 50)
        for u in users:
            print(f"{u.id:<15} {u.username:<20} {u.role:<10}")
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        print("=" * 50)
        list_users()
        sys.exit(0)

    if len(sys.argv) == 2:
        if sys.argv[1] in ("-l", "--list"):
            list_users()
            sys.exit(0)
        print("用法: python add_user.py <用户名> <密码> [admin|user]")
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    role = sys.argv[3] if len(sys.argv) >= 4 else "user"

    if role not in ("admin", "user"):
        print(f"[错误] 角色必须是 'admin' 或 'user'，不能是 '{role}'")
        sys.exit(1)

    success = add_user(username, password, role)
    if not success:
        sys.exit(1)
