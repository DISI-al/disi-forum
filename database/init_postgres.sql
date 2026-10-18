-- ============================================================
-- DISI 技术论坛 — PostgreSQL 数据库初始化脚本
-- 适用于 Linux 服务器部署
--
-- 使用方法（在 Linux 服务器上以 postgres 用户执行）：
--   sudo -u postgres psql -f init_postgres.sql
--
-- 或者先创建数据库再执行：
--   sudo -u postgres createdb disi_forum
--   sudo -u postgres psql -d disi_forum -f init_postgres.sql
-- ============================================================

-- 创建数据库（如果不存在）
-- 注意：CREATE DATABASE 不能在事务块中执行，单独运行
-- CREATE DATABASE disi_forum WITH ENCODING 'UTF8';

-- ============================================================
-- 创建用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id          VARCHAR(12) PRIMARY KEY,
    username    VARCHAR(50) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role        VARCHAR(10) DEFAULT 'user',   -- 'admin' 或 'user'
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- 创建帖子表
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    id          VARCHAR(12) PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT DEFAULT '',
    tags        JSONB DEFAULT '[]'::jsonb,     -- 标签列表
    pinned      BOOLEAN DEFAULT FALSE,
    author_id   VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_author    ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_pinned    ON posts(pinned);
CREATE INDEX IF NOT EXISTS idx_posts_created   ON posts(created_at DESC);

-- ============================================================
-- 创建评论表
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id          VARCHAR(12) PRIMARY KEY,
    post_id     VARCHAR(12) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

-- ============================================================
-- 创建点赞表（复合主键，确保每人每帖只能点赞一次）
-- ============================================================
CREATE TABLE IF NOT EXISTS likes (
    post_id     VARCHAR(12) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);

-- ============================================================
-- 创建收藏表
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
    post_id     VARCHAR(12) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id     VARCHAR(12) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, user_id)
);

-- ============================================================
-- 创建媒体文件表
-- ============================================================
CREATE TABLE IF NOT EXISTS media (
    id          VARCHAR(12) PRIMARY KEY,
    post_id     VARCHAR(12) NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url         VARCHAR(500) NOT NULL,
    name        VARCHAR(255) DEFAULT '',
    type        VARCHAR(10) DEFAULT 'file',   -- 'image' / 'video' / 'file'
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_post ON media(post_id);

-- ============================================================
-- 插入默认管理员账号
-- 密码: disi0001 (bcrypt 加密)
-- 如果在 Python 端已创建，此 SQL 可能报唯一键冲突，故用 ON CONFLICT
-- ============================================================
INSERT INTO users (id, username, hashed_password, role)
VALUES (
    'u-admin',
    'admin',
    -- bcrypt hash of 'disi0001'（与 Python passlib 一致）
    '$2b$12$LJ3m4ys3Lk0TSwHCpNqrCOZ4IVcZRLkbYrGFhfIovmU0C2xGmXFhK',
    'admin'
) ON CONFLICT (id) DO NOTHING;
