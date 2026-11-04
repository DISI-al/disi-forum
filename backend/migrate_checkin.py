"""
INSIST 数据库迁移：habit → checkin、表改名、结算字段、唯一约束、周期兜底

用法（在服务器上）：
    cd /opt/disi-forum/backend && python3 migrate_checkin.py
脚本会先备份 disi_forum.db 到 disi_forum.db.bak-<时间戳>
"""
import os
import shutil
import sqlite3
import time

DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "disi_forum.db")


def columns(cur, table):
    return [r[1] for r in cur.execute(f"PRAGMA table_info({table})")]


def main():
    if not os.path.exists(DB):
        print("没有数据库文件，跳过：", DB)
        return

    backup = f"{DB}.bak-{time.strftime('%Y%m%d-%H%M%S')}"
    shutil.copy2(DB, backup)
    print("已备份 ->", backup)

    conn = sqlite3.connect(DB)
    cur = conn.cursor()

    # 1) 结算字段
    cols = columns(cur, "insist_cards")
    for name, ddl in (
        ("settle_reason", "VARCHAR(12)"),
        ("settled_at", "DATETIME"),
        ("locked_xp", "FLOAT"),
    ):
        if name not in cols:
            cur.execute(f"ALTER TABLE insist_cards ADD COLUMN {name} {ddl}")
            print("加字段 insist_cards." + name)

    # 2) kind 改名
    cur.execute("UPDATE insist_cards SET kind='checkin' WHERE kind='habit'")
    print("kind habit -> checkin：", cur.rowcount)

    # 3) XP 事件 source 改名
    cur.execute("UPDATE insist_xp_events SET source='checkin' WHERE source='habit'")
    print("source habit -> checkin：", cur.rowcount)

    # 4) 打卡卡周期兜底
    cur.execute("UPDATE insist_cards SET cycle_days=30 WHERE kind='checkin' AND (cycle_days IS NULL OR cycle_days <= 0)")
    print("周期兜底：", cur.rowcount)

    # 5) 表改名
    tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    if "insist_habit_logs" in tables and "insist_checkin_logs" not in tables:
        cur.execute("ALTER TABLE insist_habit_logs RENAME TO insist_checkin_logs")
        print("表改名 insist_habit_logs -> insist_checkin_logs")

    # 6) 去重后加唯一约束
    cur.execute("""
        DELETE FROM insist_checkin_logs
        WHERE rowid NOT IN (
            SELECT MIN(rowid) FROM insist_checkin_logs GROUP BY card_id, day
        )
    """)
    if cur.rowcount:
        print("清理重复打卡记录：", cur.rowcount)
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_log_card_day ON insist_checkin_logs (card_id, day)")

    conn.commit()
    conn.close()
    print("迁移完成")


if __name__ == "__main__":
    main()
