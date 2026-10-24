"""
INSIST 接口：技能 / 卡片 / 打卡 / 结算 / 晋升 / 统计 / AI 审核（预留）
挂载前缀 /api/insist，全部按登录用户隔离。
"""
from datetime import date, datetime, timedelta, timezone
import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from auth import require_user
from database import get_db
from insist_ai import review_promotion, review_prompt_payload
from insist_models import InsistCard, InsistHabitLog, InsistSetting, InsistSkill, InsistXpEvent
from insist_rules import (
    DAILY_XP, DEFAULT_CONFIG, IMPORTANCE, LEVELS, LEVEL_MIN, STREAK_BONUS, TIERS,
    apply_xp, checklist_done, checklist_for_level, daily_xp, day_decay, forget_percent,
    merge_config, promotion_checklist, segment_max, segment_start, streak_bonus,
)
from insist_schemas import AiReviewRequest, CardCreate, CardUpdate, SettingsUpdate, SkillCreate, SkillUpdate
from models import User

router = APIRouter(prefix="/api/insist", tags=["insist"])


# ====================== 序列化 ======================
def skill_payload(skill: InsistSkill, db: Session, cfg: dict | None = None) -> dict:
    cap = segment_max(skill.level, cfg)
    start = segment_start(skill.level, cfg)
    if cap:
        progress = max(0.0, min(100.0, (skill.xp - start) / (cap - start) * 100))
    else:
        progress = 100.0
    last = skill.last_active.date() if skill.last_active else None
    return {
        "id": skill.id,
        "name": skill.name,
        "category": skill.category,
        "tier": skill.tier,
        "importance": skill.importance,
        "level": skill.level,
        "levelName": LEVELS[skill.level],
        "xp": round(skill.xp, 2),
        "overflow": round(skill.overflow or 0, 2),
        "saturated": bool(cap is not None and skill.xp >= cap),
        "forget": forget_percent(skill, cfg=cfg),
        "progress": round(progress, 1),
        "nextNeed": round(max(0, cap - skill.xp), 1) if cap else 0,
        "daysAgo": (date.today() - last).days if last else 0,
        "records": db.query(InsistXpEvent).filter(InsistXpEvent.skill_id == skill.id).count(),
        "isFocus": bool(skill.is_focus),
    }


def card_payload(card: InsistCard) -> dict:
    return {
        "id": card.id,
        "kind": card.kind,
        "title": card.title,
        "detail": card.detail or "",
        "tier": card.tier,
        "status": card.status,
        "progress": round(card.progress or 0, 1),
        "xpValue": round(card.xp_value or 0, 1),
        "skillId": card.skill_id,
        "cycleDays": card.cycle_days,
        "dailyTarget": card.daily_target,
        "streak": card.streak or 0,
        "totalDays": card.total_days or 0,
        "lastCheckin": card.last_checkin.isoformat() if card.last_checkin else None,
        "phase": card.phase,
    }


def _skill_or_404(db: Session, user: User, skill_id: str) -> InsistSkill:
    skill = db.query(InsistSkill).filter(InsistSkill.id == skill_id, InsistSkill.user_id == user.id).first()
    if not skill:
        raise HTTPException(status_code=404, detail="技能不存在")
    return skill


def _card_or_404(db: Session, user: User, card_id: str) -> InsistCard:
    card = db.query(InsistCard).filter(InsistCard.id == card_id, InsistCard.user_id == user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="卡片不存在")
    return card


def _user_config(db: Session, user: User) -> dict:
    """读取当前用户的规则配置（没存过就用默认值）"""
    row = db.query(InsistSetting).filter(InsistSetting.user_id == user.id).first()
    return merge_config(row.config if row else None)


def _event(db: Session, user: User, skill_id: str, xp: float, source: str, note: str, card_id=None):
    db.add(InsistXpEvent(
        user_id=user.id, skill_id=skill_id, card_id=card_id,
        source=source, xp=xp, note=note, occurred_on=date.today(),
    ))


# ====================== 技能 ======================
@router.get("/skills")
def list_skills(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.query(InsistSkill).filter(InsistSkill.user_id == current_user.id).order_by(InsistSkill.updated_at.desc()).all()
    cfg = _user_config(db, current_user)
    return [skill_payload(s, db, cfg) for s in rows]


@router.post("/skills")
def create_skill(req: SkillCreate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    exists = db.query(InsistSkill).filter(InsistSkill.user_id == current_user.id, InsistSkill.name == req.name).first()
    if exists:
        raise HTTPException(status_code=400, detail="已经有同名的技能")
    skill = InsistSkill(
        user_id=current_user.id, name=req.name.strip(), category=req.category or "未分类",
        tier=req.tier, importance=req.importance, level=req.level,
        xp=max(0.0, float(req.xp)), last_active=datetime.now(timezone.utc),
    )
    db.add(skill)
    db.flush()
    # 第一个技能自动成为近期目标
    has_focus = db.query(InsistSkill).filter(
        InsistSkill.user_id == current_user.id, InsistSkill.is_focus.is_(True)
    ).first()
    if not has_focus:
        skill.is_focus = True
    db.commit()
    db.refresh(skill)
    return skill_payload(skill, db, _user_config(db, current_user))


@router.get("/skills/{skill_id}")
def get_skill(skill_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    return skill_payload(_skill_or_404(db, current_user, skill_id), db, _user_config(db, current_user))


@router.patch("/skills/{skill_id}")
def update_skill(skill_id: str, req: SkillUpdate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    skill = _skill_or_404(db, current_user, skill_id)
    if req.name is not None:
        dup = db.query(InsistSkill).filter(
            InsistSkill.user_id == current_user.id, InsistSkill.name == req.name, InsistSkill.id != skill.id
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="已经有同名的技能")
        skill.name = req.name.strip()
    if req.category is not None:
        skill.category = req.category
    if req.tier is not None:
        skill.tier = req.tier
    if req.importance is not None:
        skill.importance = req.importance
    if req.level is not None:
        cfg = _user_config(db, current_user)
        skill.level = req.level
        skill.xp = float(cfg["levelMin"][req.level])
        skill.overflow = 0
        skill.overflow_since = None
    if req.xp is not None:
        skill.xp = max(0.0, float(req.xp))
    if req.forget_manual is not None:
        skill.forget_manual = req.forget_manual
    db.commit()
    db.refresh(skill)
    return skill_payload(skill, db, _user_config(db, current_user))


@router.post("/skills/{skill_id}/focus")
def set_focus(skill_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    """设为近期目标（核心技能），同一用户只保留一个"""
    skill = _skill_or_404(db, current_user, skill_id)
    db.query(InsistSkill).filter(InsistSkill.user_id == current_user.id).update({InsistSkill.is_focus: False})
    skill.is_focus = True
    db.commit()
    db.refresh(skill)
    return skill_payload(skill, db)


@router.delete("/skills/{skill_id}")
def delete_skill(skill_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    skill = _skill_or_404(db, current_user, skill_id)
    db.delete(skill)
    db.commit()
    return {"ok": True}


# ====================== 卡片 ======================
@router.get("/cards")
def list_cards(
    status: str | None = None,
    kind: str | None = None,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    query = db.query(InsistCard).filter(InsistCard.user_id == current_user.id)
    if status:
        query = query.filter(InsistCard.status == status)
    if kind:
        query = query.filter(InsistCard.kind == kind)
    rows = query.order_by(InsistCard.created_at.desc()).all()
    return [card_payload(c) for c in rows]


@router.post("/cards")
def create_card(req: CardCreate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    if req.skill_id:
        _skill_or_404(db, current_user, req.skill_id)
    card = InsistCard(
        user_id=current_user.id, skill_id=req.skill_id, kind=req.kind,
        title=req.title.strip(), detail=req.detail, tier=req.tier,
        xp_value=req.xp_value, cycle_days=req.cycle_days, daily_target=req.daily_target,
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    return card_payload(card)


@router.get("/cards/{card_id}")
def get_card(card_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    return card_payload(_card_or_404(db, current_user, card_id))


@router.patch("/cards/{card_id}")
def update_card(card_id: str, req: CardUpdate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    card = _card_or_404(db, current_user, card_id)
    for field in ("title", "detail", "tier", "progress", "status", "phase", "xp_value"):
        value = getattr(req, field)
        if value is not None:
            setattr(card, field, value)
    if req.status == "done":
        card.progress = 100
        card.done_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(card)
    return card_payload(card)


@router.delete("/cards/{card_id}")
def delete_card(card_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    card = _card_or_404(db, current_user, card_id)
    db.delete(card)
    db.commit()
    return {"ok": True}


# ====================== 打卡 ======================
@router.post("/cards/{card_id}/checkin")
def checkin(card_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    card = _card_or_404(db, current_user, card_id)
    if card.kind != "habit":
        raise HTTPException(status_code=400, detail="只有打卡卡可以打卡")
    today = date.today()
    if card.last_checkin == today:
        raise HTTPException(status_code=400, detail="今天已经打过卡了")

    base = DAILY_XP.get(card.tier, 1.5)
    multiplier = day_decay(card.total_days or 0)
    gained = round(base * multiplier, 3)

    if card.last_checkin and (today - card.last_checkin).days == 1:
        card.streak = (card.streak or 0) + 1
    else:
        card.streak = 1
    card.total_days = (card.total_days or 0) + 1
    card.last_checkin = today

    bonus = streak_bonus(card.streak, cfg)
    total = round(gained + bonus, 3)

    log = InsistHabitLog(
        card_id=card.id, user_id=current_user.id, day=today,
        base_xp=base, multiplier=multiplier, xp=total,
    )
    db.add(log)

    applied = {"progress": 0.0, "overflow": 0.0, "saturated": False}
    skill_payload_out = None
    if card.skill_id:
        skill = _skill_or_404(db, current_user, card.skill_id)
        applied = apply_xp(skill, total)
        _event(db, current_user, skill.id, total, "habit", f"打卡《{card.title}》", card.id)
        skill_payload_out = skill_payload(skill, db)

    db.commit()
    db.refresh(card)
    return {
        "xp": total,
        "base": base,
        "multiplier": multiplier,
        "streakBonus": bonus,
        "streak": card.streak,
        "totalDays": card.total_days,
        "applied": applied,
        "card": card_payload(card),
        "skill": skill_payload_out,
    }


# ====================== 任务 / 项目结算 ======================
@router.post("/cards/{card_id}/complete")
def complete_card(card_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    card = _card_or_404(db, current_user, card_id)
    if card.kind == "habit":
        raise HTTPException(status_code=400, detail="打卡卡用打卡接口结算")
    if card.status == "done":
        raise HTTPException(status_code=400, detail="这张卡已经结算过了")

    card.status = "done"
    card.progress = 100
    card.done_at = datetime.now(timezone.utc)

    applied = {"progress": 0.0, "overflow": 0.0, "saturated": False}
    skill_out = None
    if card.skill_id and card.xp_value:
        skill = _skill_or_404(db, current_user, card.skill_id)
        applied = apply_xp(skill, card.xp_value)
        _event(db, current_user, skill.id, card.xp_value, card.kind, f"完成《{card.title}》", card.id)
        skill_out = skill_payload(skill, db)

    db.commit()
    db.refresh(card)
    return {"applied": applied, "card": card_payload(card), "skill": skill_out}


# ====================== 晋升 ======================
@router.get("/skills/{skill_id}/promotion")
def promotion_status(skill_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    skill = _skill_or_404(db, current_user, skill_id)
    cards = db.query(InsistCard).filter(InsistCard.user_id == current_user.id, InsistCard.skill_id == skill.id).all()
    cfg = _user_config(db, current_user)
    checklist = checklist_for_level(promotion_checklist(cards), skill.level)
    cap = segment_max(skill.level, cfg)
    xp_ok = cap is None or skill.xp >= cap
    return {
        "level": skill.level,
        "nextLevel": min(skill.level + 1, 4),
        "levelName": LEVELS[skill.level],
        "nextLevelName": LEVELS[min(skill.level + 1, 4)],
        "xpOk": xp_ok,
        "checklist": checklist,
        "checklistOk": checklist_done(checklist) if checklist else True,
        "canPromote": xp_ok and (checklist_done(checklist) if checklist else True) and skill.level < 4,
    }


@router.post("/skills/{skill_id}/promote")
def promote(skill_id: str, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    skill = _skill_or_404(db, current_user, skill_id)
    if skill.level >= 4:
        raise HTTPException(status_code=400, detail="已经是最高段位")

    cards = db.query(InsistCard).filter(InsistCard.user_id == current_user.id, InsistCard.skill_id == skill.id).all()
    checklist = checklist_for_level(promotion_checklist(cards), skill.level)
    cap = segment_max(skill.level)
    if cap is not None and skill.xp < cap:
        raise HTTPException(status_code=400, detail="本段 XP 还没打满")
    if checklist and not checklist_done(checklist):
        raise HTTPException(status_code=400, detail="晋升凭证还不够")

    transferred = round(skill.overflow or 0, 3)
    skill.level += 1
    new_start = segment_start(skill.level)
    new_cap = segment_max(skill.level)
    skill.xp = round(new_start + transferred, 3)
    if new_cap is not None:
        skill.xp = min(skill.xp, new_cap)
    skill.overflow = 0
    skill.overflow_since = None
    skill.last_active = datetime.now(timezone.utc)

    _event(db, current_user, skill.id, transferred, "promotion", f"晋升到{LEVELS[skill.level]}，转入溢出 {transferred}")
    db.commit()
    db.refresh(skill)
    return {"skill": skill_payload(skill, db, cfg), "transferred": transferred}


# ====================== 统计 ======================
@router.get("/stats/checkins")
def stats_checkins(days: int = 14, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    days = max(1, min(60, days))
    today = date.today()
    start = today - timedelta(days=days - 1)

    habits = db.query(InsistCard).filter(
        InsistCard.user_id == current_user.id, InsistCard.kind == "habit"
    ).all()
    logs = db.query(InsistHabitLog).filter(
        InsistHabitLog.user_id == current_user.id, InsistHabitLog.day >= start
    ).all()
    done_map = {(l.card_id, l.day) for l in logs}

    result = []
    for h in habits:
        cells = []
        for i in range(days):
            day = start + timedelta(days=i)
            cells.append(1 if (h.id, day) in done_map else 0)
        done_count = sum(cells)
        result.append({
            "id": h.id,
            "title": h.title,
            "tier": h.tier,
            "streak": h.streak or 0,
            "totalDays": h.total_days or 0,
            "todayDone": h.last_checkin == today,
            "cells": cells,
            "doneCount": done_count,
            "rate": round(done_count / days * 100),
        })
    return {"days": days, "start": start.isoformat(), "items": result}


@router.get("/overview")
def overview(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    skills = db.query(InsistSkill).filter(InsistSkill.user_id == current_user.id).all()
    cards = db.query(InsistCard).filter(InsistCard.user_id == current_user.id).all()
    today = date.today()
    start = today - timedelta(days=13)
    events = db.query(InsistXpEvent).filter(
        InsistXpEvent.user_id == current_user.id, InsistXpEvent.occurred_on >= start
    ).all()

    daily = {start + timedelta(days=i): 0.0 for i in range(14)}
    for e in events:
        if e.occurred_on in daily:
            daily[e.occurred_on] += e.xp or 0

    focus = next((s for s in skills if s.is_focus), skills[0] if skills else None)
    return {
        "focusId": focus.id if focus else None,
        "skillCount": len(skills),
        "cardCount": len(cards),
        "totalXp": round(sum(s.xp or 0 for s in skills), 1),
        "saturatedCount": sum(1 for s in skills if segment_max(s.level, _user_config(db, current_user)) is not None and s.xp >= segment_max(s.level, _user_config(db, current_user))),
        "achievementCount": sum(1 for c in cards if c.kind == "achievement" and c.status == "done"),
        "todayCheckins": sum(1 for c in cards if c.kind == "habit" and c.last_checkin == today),
        "dailyXp": [round(v, 1) for v in daily.values()],
    }


# ====================== AI 审核（预留） ======================
@router.post("/ai/review")
def ai_review(req: AiReviewRequest, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    skill = _skill_or_404(db, current_user, req.skill_id)
    cards = db.query(InsistCard).filter(
        InsistCard.user_id == current_user.id, InsistCard.skill_id == skill.id
    ).all()
    checklist = checklist_for_level(promotion_checklist(cards), skill.level)
    payload = review_prompt_payload(skill_payload(skill, db, _user_config(db, current_user)), [card_payload(c) for c in cards])
    payload["checklist"] = checklist
    payload["target_level"] = req.target_level
    payload["note"] = req.note
    return review_promotion(payload)


# ====================== 设置 ======================
@router.get("/settings")
def get_settings(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    row = db.query(InsistSetting).filter(InsistSetting.user_id == current_user.id).first()
    return {
        "config": _user_config(db, current_user),
        "defaults": DEFAULT_CONFIG,
        "customized": bool(row),
    }


@router.patch("/settings")
def update_settings(req: SettingsUpdate, current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    cfg = merge_config(req.config)
    row = db.query(InsistSetting).filter(InsistSetting.user_id == current_user.id).first()
    if row:
        row.config = cfg
    else:
        db.add(InsistSetting(user_id=current_user.id, config=cfg))
    db.commit()
    return {"config": _user_config(db, current_user), "defaults": DEFAULT_CONFIG, "customized": True}


@router.delete("/settings")
def reset_settings(current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    row = db.query(InsistSetting).filter(InsistSetting.user_id == current_user.id).first()
    if row:
        db.delete(row)
        db.commit()
    return {"config": DEFAULT_CONFIG, "customized": False}


# ====================== 导出 ======================
@router.get("/export")
def export_data(format: str = "json", current_user: User = Depends(require_user), db: Session = Depends(get_db)):
    """
    format=json      全量 JSON（技能、卡片、打卡记录、XP 事件）
    format=csv       技能表 CSV（Excel 可直接打开，带 BOM）
    format=csv-cards 卡片表 CSV
    """
    skills = db.query(InsistSkill).filter(InsistSkill.user_id == current_user.id).all()
    cards = db.query(InsistCard).filter(InsistCard.user_id == current_user.id).all()
    logs = db.query(InsistHabitLog).filter(InsistHabitLog.user_id == current_user.id).all()
    events = db.query(InsistXpEvent).filter(InsistXpEvent.user_id == current_user.id).all()

    if format in ("csv", "csv-cards"):
        buf = io.StringIO()
        writer = csv.writer(buf)
        if format == "csv":
            writer.writerow(["名称", "分类", "难度阶", "重要程度", "段位", "XP", "溢出", "遗忘%", "记录数", "最近活跃"])
            for s in skills:
                last = s.last_active.strftime("%Y-%m-%d") if s.last_active else ""
                writer.writerow([
                    s.name, s.category, TIERS[s.tier - 1], IMPORTANCE[s.importance - 1],
                    LEVELS[s.level], round(s.xp or 0, 2), round(s.overflow or 0, 2),
                    forget_percent(s, cfg=_user_config(db, current_user)), sum(1 for e in events if e.skill_id == s.id), last,
                ])
            filename = "insist-skills.csv"
        else:
            writer.writerow(["标题", "类型", "难度阶", "状态", "进度%", "奖励XP", "连续天数", "累计天数", "最近打卡"])
            for c in cards:
                writer.writerow([
                    c.title, c.kind, TIERS[c.tier - 1], c.status, round(c.progress or 0, 1),
                    round(c.xp_value or 0, 1), c.streak or 0, c.total_days or 0,
                    c.last_checkin.isoformat() if c.last_checkin else "",
                ])
            filename = "insist-cards.csv"
        body = "\ufeff" + buf.getvalue()  # BOM，Excel 打开不乱码
        return Response(
            body,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    payload = {
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "user": current_user.username,
        "skills": [skill_payload(s, db, _user_config(db, current_user)) for s in skills],
        "cards": [card_payload(c) for c in cards],
        "habitLogs": [
            {"cardId": l.card_id, "day": l.day.isoformat(), "xp": round(l.xp or 0, 3)}
            for l in logs
        ],
        "xpEvents": [
            {"skillId": e.skill_id, "cardId": e.card_id, "source": e.source,
             "xp": round(e.xp or 0, 3), "note": e.note, "day": e.occurred_on.isoformat()}
            for e in events
        ],
    }
    return Response(
        json.dumps(payload, ensure_ascii=False, indent=2),
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="insist.json"'},
    )
