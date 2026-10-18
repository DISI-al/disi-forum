-- ============================================================
-- DISI 技术论坛 — 直接在数据库添加用户（SQL 方式）
-- 适用于 Linux 服务器，直接用 psql/mysql 执行
--
-- 注意：密码的 bcrypt hash 需要用 Python 生成，
--       下面提供生成方法和 SQL 模板
-- ============================================================

-- ============================================================
-- 方法一：用 Python 生成 bcrypt hash 后，手动 INSERT
-- ============================================================
-- 先在服务器上运行：
--   python3 -c "from passlib.context import CryptContext; print(CryptContext(schemes=['bcrypt'], deprecated='auto').hash('你的密码'))"
--
-- 拿到 hash 后执行下面的 SQL（替换 YOUR_HASH 和用户名）：

-- PostgreSQL:
-- INSERT INTO users (id, username, hashed_password, role)
-- VALUES ('u-zhangsan', 'zhangsan', 'YOUR_HASH', 'user')
-- ON CONFLICT (id) DO NOTHING;

-- MySQL:
-- INSERT IGNORE INTO users (id, username, hashed_password, role)
-- VALUES ('u-zhangsan', 'zhangsan', 'YOUR_HASH', 'user');


-- ============================================================
-- 方法二（推荐）：用项目自带的 add_user.py 脚本
-- ============================================================
-- cd /opt/disi-forum/backend
-- python3 add_user.py zhangsan mypass123          # 添加普通用户
-- python3 add_user.py zhangsan mypass123 admin    # 添加管理员
-- python3 add_user.py --list                      # 查看所有用户
