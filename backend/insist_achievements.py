"""
INSIST 成就系统：定义表 + 发放引擎 + 成就墙数据

设计：
- DEFS 是唯一的成就定义来源（id / 标题 / 等级 / 分类 / 条件类型 / 阈值）；
- 业务动作调用 on_* 系列函数，引擎按阈值匹配并去重发放（写 kind='achievement' 的卡）；
- wall() 给前端成就墙用：分组、是否获得、当前进度。
"""
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from insist_models import InsistCard, InsistXpEvent, InsistSkill

CATEGORIES = [
    ("checkin", "打卡"),
    ("card", "任务与项目"),
    ("skill", "技能"),
    ("record", "记录"),
    ("hidden", "隐藏"),
]

# type 决定进度怎么算：见 progress_of()
DEFS = [
    # ---- 打卡 ----
    {"id": "streak_7", "title": "连续 7 天", "tier": 1, "category": "checkin",
     "desc": "任意打卡卡连续打卡 7 天", "type": "streak", "need": 7},
    {"id": "streak_30", "title": "连续 30 天", "tier": 3, "category": "checkin",
     "desc": "任意打卡卡连续打卡 30 天", "type": "streak", "need": 30},
    {"id": "streak_100", "title": "连续 100 天", "tier": 4, "category": "checkin",
     "desc": "任意打卡卡连续打卡 100 天", "type": "streak", "need": 100},
    {"id": "total_30", "title": "累计 30 天", "tier": 1, "category": "checkin",
     "desc": "任意打卡卡累计打卡 30 天", "type": "total", "need": 30},
    {"id": "total_100", "title": "累计 100 天", "tier": 2, "category": "checkin",
     "desc": "任意打卡卡累计打卡 100 天", "type": "total", "need": 100},
    {"id": "total_150", "title": "累计 150 天", "tier": 3, "category": "checkin",
     "desc": "任意打卡卡累计打卡 150 天", "type": "total", "need": 150},
    {"id": "total_200", "title": "累计 200 天", "tier": 4, "category": "checkin",
     "desc": "任意打卡卡累计打卡 200 天", "type": "total", "need": 200},
    {"id": "settle_perfect", "title": "周期全满", "tier": 3, "category": "checkin",
     "desc": "打卡卡按周期完整打满并结算", "type": "settle_perfect", "need": 1},
    {"id": "first_settle", "title": "首次结算", "tier": 1, "category": "checkin",
     "desc": "第一次完成打卡卡结算（含提前结算）", "type": "settles", "need": 1},
    {"id": "settle_5", "title": "结算 5 张", "tier": 2, "category": "checkin",
     "desc": "累计结算 5 张打卡卡", "type": "settles", "need": 5},

    # ---- 任务 / 项目 ----
    {"id": "first_task", "title": "首张任务卡", "tier": 1, "category": "card",
     "desc": "完成第一张任务卡", "type": "tasks_done", "need": 1},
    {"id": "first_project", "title": "首个项目", "tier": 2, "category": "card",
     "desc": "完成第一个项目卡", "type": "projects_done", "need": 1},
    {"id": "project_expert", "title": "臻阶项目", "tier": 4, "category": "card",
     "desc": "完成一张臻阶项目卡", "type": "projects_expert", "need": 1},
    {"id": "cards_10", "title": "完成 10 张经验卡", "tier": 2, "category": "card",
     "desc": "累计完成 10 张经验卡", "type": "cards_done", "need": 10},
    {"id": "cards_30", "title": "完成 30 张经验卡", "tier": 3, "category": "card",
     "desc": "累计完成 30 张经验卡", "type": "cards_done", "need": 30},
    {"id": "cards_100", "title": "完成 100 张经验卡", "tier": 4, "category": "card",
     "desc": "累计完成 100 张经验卡", "type": "cards_done", "need": 100},

    # ---- 技能 ----
    {"id": "first_promote", "title": "首次晋升", "tier": 2, "category": "skill",
     "desc": "第一次晋升技能段位", "type": "promotes", "need": 1},
    {"id": "promote_5", "title": "晋升 5 次", "tier": 3, "category": "skill",
     "desc": "累计晋升 5 次", "type": "promotes", "need": 5},
    {"id": "expert", "title": "专家段位", "tier": 4, "category": "skill",
     "desc": "任意技能达到「专家」", "type": "expert", "need": 1},
    {"id": "skill_xp_1000", "title": "单技能 1000 XP", "tier": 3, "category": "skill",
     "desc": "任意技能 XP 累计破 1000", "type": "skill_xp", "need": 1000},

    # ---- 记录 ----
    {"id": "first_post", "title": "首次公开复盘", "tier": 1, "category": "record",
     "desc": "第一次把周报发到论坛", "type": "posts", "need": 1},
    {"id": "posts_10", "title": "复盘 10 篇", "tier": 2, "category": "record",
     "desc": "累计把 10 篇周报发到论坛", "type": "posts", "need": 10},

    # ---- 隐藏 ----
    {"id": "midnight", "title": "凌晨的坚持", "tier": 1, "category": "hidden",
     "desc": "在 0–4 点之间打卡一次", "type": "midnight", "need": 1},
]

DEF_BY_ID = {d["id"]: d for d in DEFS}


# ====================== 发放 ======================

def _grant(db: Session, user, title: str, tier: int, detail: str = ""):
    """同名成就只发一次，返回标题或 None"""
    exists = db.query(InsistCard).filter(
        InsistCard.user_id == user.id,
        InsistCard.kind == "achievement",
        InsistCard.title == title,
    ).first()
    if exists:
        return None
    db.add(InsistCard(
        user_id=user.id, kind="achievement", title=title, tier=tier,
        detail=detail, status="done", progress=100,
        done_at=datetime.now(timezone.utc),
    ))
    return title


def _grant_def(db: Session, user, def_id: str, detail: str = ""):
    d = DEF_BY_ID.get(def_id)
    if not d:
        return None
    return _grant(db, user, d["title"], d["tier"], detail or d["desc"])


# ====================== 事件入口 ======================

def on_checkin(db: Session, user, card) -> list[str]:
    """打卡成功后调用：按 streak / total_days 发成就"""
    got = []
    for d in DEFS:
        if d["type"] == "streak" and (card.streak or 0) >= d["need"]:
            t = _grant_def(db, user, d["id"], f"《{card.title}》连续打卡 {card.streak} 天")
            if t:
                got.append(t)
        elif d["type"] == "total" and (card.total_days or 0) >= d["need"]:
            t = _grant_def(db, user, d["id"], f"《{card.title}》累计打卡 {card.total_days} 天")
            if t:
                got.append(t)
    return got


def on_settle(db: Session, user, card, path: str) -> list[str]:
    """结算后调用：path = perfect | filled | manual"""
    got = []
    if path == "perfect":
        t = _grant_def(db, user, "settle_perfect", f"《{card.title}》周期全满 {card.cycle_days} 天")
        if t:
            got.append(t)

    settles = db.query(InsistCard).filter(
        InsistCard.user_id == user.id, InsistCard.settled_at.isnot(None)
    ).count()
    if settles >= 1:
        t = _grant_def(db, user, "first_settle")
        if t:
            got.append(t)
    if settles >= 5:
        t = _grant_def(db, user, "settle_5")
        if t:
            got.append(t)
    return got


def on_card_done(db: Session, user, card) -> list[str]:
    """任务卡 / 项目卡完成时调用"""
    got = []
    if card.kind == "task":
        t = _grant_def(db, user, "first_task", f"完成任务卡《{card.title}》")
        if t:
            got.append(t)
    if card.kind == "project":
        t = _grant_def(db, user, "first_project", f"完成项目卡《{card.title}》")
        if t:
            got.append(t)
        if (card.tier or 1) >= 4:
            t = _grant_def(db, user, "project_expert", f"完成臻阶项目《{card.title}》")
            if t:
                got.append(t)

    db.flush()
    done = db.query(InsistCard).filter(
        InsistCard.user_id == user.id,
        InsistCard.status == "done",
        InsistCard.kind != "achievement",
    ).count()
    for def_id, need in (("cards_10", 10), ("cards_30", 30), ("cards_100", 100)):
        if done >= need:
            t = _grant_def(db, user, def_id, f"累计完成 {done} 张经验卡")
            if t:
                got.append(t)
    return got


def on_promote(db: Session, user, skill) -> list[str]:
    """技能晋升成功后调用"""
    got = []
    promotes = db.query(InsistXpEvent).filter(
        InsistXpEvent.user_id == user.id, InsistXpEvent.source == "promotion"
    ).count()
    if promotes >= 1:
        t = _grant_def(db, user, "first_promote", f"「{skill.name}」晋升到 {skill.level}")
        if t:
            got.append(t)
    if promotes >= 5:
        t = _grant_def(db, user, "promote_5")
        if t:
            got.append(t)
    if (skill.level or 0) >= 4:
        t = _grant_def(db, user, "expert", f"「{skill.name}」达到专家")
        if t:
            got.append(t)
    if (skill.xp or 0) >= 1000:
        t = _grant_def(db, user, "skill_xp_1000", f"「{skill.name}」累计 {round(skill.xp)} XP")
        if t:
            got.append(t)
    return got


def on_post_published(db: Session, user, count: int) -> list[str]:
    """把周报发到论坛后调用（count = 已发布篇数）"""
    got = []
    if count >= 1:
        t = _grant_def(db, user, "first_post")
        if t:
            got.append(t)
    if count >= 10:
        t = _grant_def(db, user, "posts_10", f"已发布 {count} 篇复盘")
        if t:
            got.append(t)
    return got


def on_midnight_checkin(db: Session, user, hour: int) -> list[str]:
    if 0 <= hour < 4:
        t = _grant_def(db, user, "midnight")
        return [t] if t else []
    return []


# ====================== 进度 / 成就墙 ======================

def progress_of(db: Session, user, def_type: str) -> int:
    """某种条件当前的数值，用于成就墙显示进度"""
    if def_type in ("streak", "total"):
        rows = db.query(InsistCard).filter(InsistCard.user_id == user.id).all()
        field = "streak" if def_type == "streak" else "total_days"
        best = max(((getattr(c, field) or 0) for c in rows), default=0)
        return int(best)
    if def_type == "cards_done":
        return db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.status == "done",
            InsistCard.kind.notin_(("achievement", "checkin")),
        ).count()
    if def_type == "tasks_done":
        return db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.status == "done",
            InsistCard.kind == "task", InsistCard.settled_at.is_(None),
        ).count()
    if def_type == "projects_done":
        return db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.status == "done", InsistCard.kind == "project"
        ).count()
    if def_type == "projects_expert":
        return db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.status == "done",
            InsistCard.kind == "project", InsistCard.tier >= 4,
        ).count()
    if def_type == "settles":
        return db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.settled_at.isnot(None)
        ).count()
    if def_type == "settle_perfect":
        return db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.settle_reason == "perfect"
        ).count()
    if def_type == "promotes":
        return db.query(InsistXpEvent).filter(
            InsistXpEvent.user_id == user.id, InsistXpEvent.source == "promotion"
        ).count()
    if def_type == "expert":
        return 1 if db.query(InsistSkill).filter(
            InsistSkill.user_id == user.id, InsistSkill.level >= 4
        ).count() else 0
    if def_type == "skill_xp":
        row = db.query(func.max(InsistSkill.xp)).filter(InsistSkill.user_id == user.id).first()
        return int(row[0] or 0) if row else 0
    if def_type == "posts":
        return 0  # 由论坛侧回填，暂时不统计
    if def_type == "midnight":
        return 0
    return 0


def wall(db: Session, user) -> dict:
    """成就墙：按分类分组，返回是否获得与进度"""
    obtained = {
        c.title: c for c in db.query(InsistCard).filter(
            InsistCard.user_id == user.id, InsistCard.kind == "achievement"
        ).all()
    }

    groups = []
    for key, label in CATEGORIES:
        items = []
        for d in DEFS:
            if d["category"] != key:
                continue
            card = obtained.get(d["title"])
            cur = progress_of(db, user, d["type"])
            items.append({
                "id": d["id"],
                "title": d["title"],
                "tier": d["tier"],
                "desc": d["desc"],
                "obtained": bool(card),
                "obtainedAt": card.done_at.isoformat() if card and card.done_at else None,
                "detail": card.detail if card else "",
                "progress": min(cur, d["need"]),
                "need": d["need"],
            })
        items.sort(key=lambda x: (not x["obtained"], x["tier"], x["id"]))
        groups.append({"key": key, "label": label, "items": items})

    total = len(DEFS)
    got = len([c for c in obtained.values()])
    return {"groups": groups, "total": total, "obtained": got}
