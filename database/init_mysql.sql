-- ============================================================
-- DISI 技术论坛 — MySQL 数据库初始化脚本
-- 适用于 Linux 服务器（MySQL 5.7+ / MariaDB 10.3+）
--
-- 使用方法：
--   mysql -u root -p < init_mysql.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS disi_forum
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE disi_forum;

-- ============================================================
-- 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(12) PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role            VARCHAR(10) DEFAULT 'user',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 帖子表
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
    id          VARCHAR(12) PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    content     TEXT,
    tags        JSON DEFAULT NULL,           -- MySQL 5.7+ 支持 JSON 类型
    pinned      TINYINT(1) DEFAULT 0,
    author_id   VARCHAR(12) NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_posts_author  ON posts(author_id);
CREATE INDEX idx_posts_pinned  ON posts(pinned);
CREATE INDEX idx_posts_created ON posts(created_at);

-- ============================================================
-- 评论表
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
    id          VARCHAR(12) PRIMARY KEY,
    post_id     VARCHAR(12) NOT NULL,
    user_id     VARCHAR(12) NOT NULL,
    content     TEXT NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_comments_post ON comments(post_id);

-- ============================================================
-- 点赞表
-- ============================================================
CREATE TABLE IF NOT EXISTS likes (
    post_id     VARCHAR(12) NOT NULL,
    user_id     VARCHAR(12) NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 收藏表
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
    post_id     VARCHAR(12) NOT NULL,
    user_id     VARCHAR(12) NOT NULL,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- 媒体文件表
-- ============================================================
CREATE TABLE IF NOT EXISTS media (
    id          VARCHAR(12) PRIMARY KEY,
    post_id     VARCHAR(12) NOT NULL,
    url         VARCHAR(500) NOT NULL,
    name        VARCHAR(255) DEFAULT '',
    type        VARCHAR(10) DEFAULT 'file',
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_media_post ON media(post_id);

-- ============================================================
-- 插入默认管理员（密码: disi0001）
-- ============================================================
INSERT IGNORE INTO users (id, username, hashed_password, role)
VALUES (
    'u-admin',
    'admin',
    '$2b$12$LJ3m4ys3Lk0TSwHCpNqrCOZ4IVcZRLkbYrGFhfIovmU0C2xGmXFhK',
    'admin'
);
